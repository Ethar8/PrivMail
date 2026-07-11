import * as net from 'net';
import * as tls from 'tls';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { SMTPParser } from './parser';
import { SMTPHandler, OnMessage } from './handlers';
import { SMTPResponse } from './response';
import { createSMTPSession, SMTPSession, resetTransaction } from './session';
import { SMTP_MAX_LINE, SMTP_MAX_MESSAGE_SIZE } from '../../config/constants';
import { getSecureContext } from '../tls-context';

export class SMTPServer {
  private server: net.Server;
  private port: number;
  private onMessage: OnMessage;

  constructor(onMessage: OnMessage, port: number = config.smtpPort) {
    this.port = port;
    this.onMessage = onMessage;
    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  private handleConnection(socket: net.Socket): void {
    const session = createSMTPSession(socket);
    socket.write(SMTPResponse.ready(config.domain));
    this.bindSocket(socket, session);
  }

  /**
   * Attaches line-based command processing to a socket. Called for the initial
   * plaintext socket and again for the upgraded TLSSocket after STARTTLS.
   */
  private bindSocket(socket: net.Socket, session: SMTPSession): void {
    socket.setEncoding('utf8');
    socket.setTimeout(60_000);

    let buffer = '';
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();

      // Guard against an unbounded single line (no CRLF) -> memory DoS.
      if (buffer.length > SMTP_MAX_LINE && buffer.indexOf('\r\n') === -1) {
        logger.warn(`SMTP line-length limit exceeded from ${session.remoteAddress}; closing`);
        socket.write(SMTPResponse.lineTooLong());
        socket.destroy();
        buffer = '';
        return;
      }

      let idx: number;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!session.inData && line.length + 2 > SMTP_MAX_LINE) {
          socket.write(SMTPResponse.lineTooLong());
          socket.destroy();
          buffer = '';
          return;
        }
        void this.processLine(line, session, () => {
          // On STARTTLS: stop feeding this (plaintext) socket and hand the
          // remaining buffer over is not needed — the client must wait for the
          // 220 before starting the handshake (RFC 3207). Any pipelined bytes
          // after STARTTLS are discarded for safety.
          buffer = '';
          socket.removeListener('data', onData);
          this.upgradeToTls(socket, session);
        });
      }
    };

    socket.on('data', onData);
    socket.on('timeout', () => {
      logger.warn(`SMTP idle timeout from ${session.remoteAddress}; closing`);
      socket.destroy();
    });
    socket.on('error', (err) => {
      logger.warn(`SMTP socket error from ${session.remoteAddress}`, err.message);
    });
    socket.on('close', () => {
      logger.debug(`SMTP connection closed from ${session.remoteAddress}`);
    });
  }

  /**
   * Upgrades a plaintext socket to TLS (STARTTLS). The original socket's data
   * listener has already been removed. After a successful handshake the session
   * is reset (RFC 3207 §4.2) and command processing resumes on the TLSSocket.
   */
  private upgradeToTls(socket: net.Socket, session: SMTPSession): void {
    const secureContext = getSecureContext();
    if (!secureContext) {
      socket.write(SMTPResponse.tlsNotAvailable());
      return;
    }

    const secureSocket = new tls.TLSSocket(socket, {
      isServer: true,
      secureContext,
    });

    secureSocket.on('secure', () => {
      logger.debug(`SMTP STARTTLS established from ${session.remoteAddress}`);
      // RFC 3207: discard all prior state; client must send EHLO again.
      resetTransaction(session);
      session.clientHostname = null;
      session.authenticated = false;
      session.user = null;
      session.tlsActive = true;
      session.socket = secureSocket;
      this.bindSocket(secureSocket, session);
    });

    secureSocket.on('error', (err) => {
      logger.warn(`SMTP TLS handshake failed from ${session.remoteAddress}: ${err.message}`);
      secureSocket.destroy();
    });
  }

  private async processLine(
    line: string,
    session: SMTPSession,
    onStartTls: () => void,
  ): Promise<void> {
    if (session.inData) {
      if (line === '.') {
        session.inData = false;
        if (session.dataExceeded) {
          session.socket.write(SMTPResponse.messageTooBig());
          session.data = '';
          session.dataBytes = 0;
          session.dataExceeded = false;
          return;
        }
        const response = await SMTPHandler.completeData(session, this.onMessage);
        session.socket.write(response);
        return;
      }
      if (session.dataExceeded) return;

      const unstuffed = line.startsWith('..') ? line.slice(1) : line;
      session.dataBytes += Buffer.byteLength(unstuffed) + 2;
      if (session.dataBytes > SMTP_MAX_MESSAGE_SIZE) {
        logger.warn(`SMTP DATA size limit exceeded from ${session.remoteAddress}`);
        session.dataExceeded = true;
        session.data = '';
        return;
      }
      session.data += unstuffed + '\r\n';
      return;
    }

    // Continuation line for an in-progress AUTH exchange (base64 or "*").
    if (session.authState) {
      const { response, closeAfter } = await SMTPHandler.completeAuth(line, session);
      session.socket.write(response);
      if (closeAfter) session.socket.end();
      return;
    }

    const command = SMTPParser.parse(line);
    const { response, closeAfter, startTls } = await SMTPHandler.handle(
      command,
      session,
      this.onMessage,
    );
    session.socket.write(response);
    if (startTls) {
      onStartTls();
      return;
    }
    if (closeAfter) {
      session.socket.end();
    }
  }

  start(): void {
    this.server.listen(this.port, '0.0.0.0', () => {
      logger.info(`📧 SMTP-Server läuft auf Port ${this.port}`);
    });
  }

  stop(): void {
    this.server.close();
  }
}
