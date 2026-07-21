import * as net from 'net';
import * as tls from 'tls';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { IMAPParser } from './parser';
import { IMAPHandler } from './handlers';
import { handleIdleDone } from './handlers/idle';
import { IMAPResponse } from './response';
import { createIMAPSession, IMAPSession } from './session';
import { getSecureContext } from '../tls-context';
import { RateLimiter } from '../../api/middleware/rate-limit';
import { RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX } from '../../config/constants';

export class IMAPServer {
  private server: net.Server;
  private port: number;
  private sessions = new Set<IMAPSession>();
  private authLimiter: RateLimiter;

  constructor(port: number = config.imapPort) {
    this.port = port;
    this.authLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX);
    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  private handleConnection(socket: net.Socket): void {
    const session = createIMAPSession(socket);
    this.sessions.add(session);
    socket.write(IMAPResponse.greeting());
    this.bindSocket(socket, session);
  }

  /**
   * Attaches line-based command processing to a socket. Re-used for the
   * upgraded TLSSocket after STARTTLS.
   */
  private bindSocket(socket: net.Socket, session: IMAPSession): void {
    socket.setEncoding('utf8');
    let buffer = '';

    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      let idx: number;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        void this.processLine(line, session, () => {
          buffer = '';
          socket.removeListener('data', onData);
          this.upgradeToTls(socket, session);
        });
      }
    };

    socket.on('data', onData);
    socket.on('error', (err) => {
      logger.warn(`IMAP socket error from ${session.remoteAddress}`, err.message);
    });
    socket.on('close', () => {
      if (session.idleTimeout) clearTimeout(session.idleTimeout);
      this.sessions.delete(session);
      logger.debug(`IMAP connection closed from ${session.remoteAddress}`);
    });
  }

  private upgradeToTls(socket: net.Socket, session: IMAPSession): void {
    const secureContext = getSecureContext();
    if (!secureContext) {
      // Should not happen (handler checks availability first), but be safe.
      socket.destroy();
      return;
    }

    const secureSocket = new tls.TLSSocket(socket, { isServer: true, secureContext });

    secureSocket.on('secure', () => {
      logger.debug(`IMAP STARTTLS established from ${session.remoteAddress}`);
      session.tlsActive = true;
      session.socket = secureSocket;
      this.bindSocket(secureSocket, session);
    });

    secureSocket.on('error', (err) => {
      logger.warn(`IMAP TLS handshake failed from ${session.remoteAddress}: ${err.message}`);
      secureSocket.destroy();
    });
  }

  private async processLine(
    line: string,
    session: IMAPSession,
    onStartTls: () => void,
  ): Promise<void> {
    if (session.idling) {
      if (line.trim().toUpperCase() === 'DONE') {
        session.socket.write(handleIdleDone(session));
      }
      return;
    }

    const cmd = IMAPParser.parse(line);

    if (cmd.name === 'LOGIN') {
      const clientIp = session.remoteAddress;
      if (this.authLimiter.isLimited(clientIp)) {
        session.socket.write(IMAPResponse.no(cmd.tag, 'Too many authentication attempts, try again later'));
        return;
      }
      this.authLimiter.hit(clientIp);
    }

    const { response, closeAfter, startTls } = await IMAPHandler.handle(cmd, session);
    session.socket.write(response);
    if (startTls) {
      onStartTls();
      return;
    }
    if (closeAfter) session.socket.end();
  }

  /** Notify all idling sessions of a given user that new mail arrived. */
  notifyUser(userId: string, mailbox: string, total: number): void {
    for (const session of this.sessions) {
      if (session.userId === userId && session.selectedMailbox === mailbox && session.idling) {
        session.socket.write(IMAPResponse.untagged(`${total} EXISTS`));
        session.socket.write(IMAPResponse.untagged(`1 RECENT`));
      }
    }
  }

  start(): void {
    this.server.listen(this.port, '0.0.0.0', () => {
      logger.info(`📨 IMAP-Server läuft auf Port ${this.port}`);
    });
  }

  stop(): void {
    this.server.close();
  }
}
