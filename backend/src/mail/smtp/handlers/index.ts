import { config } from '../../../config/config';
import { SMTPCommand } from '../parser';
import { SMTPResponse } from '../response';
import { SMTPSession, resetTransaction } from '../session';
import { VirusRejectedError } from '../../av/clamav';
import { isTlsAvailable } from '../../tls-context';
import { handleEhlo } from './ehlo';
import { handleMail } from './mail';
import { handleRcpt } from './rcpt';
import { handleDataStart } from './data';
import { handleQuit } from './quit';
import { handleNoop } from './noop';
import { handleRset } from './rset';
import { handleVrfy } from './vrfy';
import { handleExpn } from './expn';
import { handleAuth, handleAuthContinuation } from './auth';

export type OnMessage = (session: SMTPSession, rawData: string) => Promise<void> | void;

export interface HandleResult {
  response: string;
  closeAfter: boolean;
  /** When true, the server must upgrade the socket to TLS after writing the response. */
  startTls?: boolean;
}

/**
 * Commands that require an encrypted channel when TLS enforcement is on.
 * EHLO/HELO, STARTTLS, QUIT, NOOP, RSET stay open for the STARTTLS handshake.
 */
const TLS_PROTECTED = new Set(['MAIL', 'RCPT', 'DATA', 'AUTH']);

export class SMTPHandler {
  static async handle(
    command: SMTPCommand,
    session: SMTPSession,
    _onMessage: OnMessage,
  ): Promise<HandleResult> {
    // No-Plaintext enforcement: block auth/mail commands before STARTTLS.
    if (
      config.tls.smtpRequireTls &&
      !session.tlsActive &&
      TLS_PROTECTED.has(command.verb)
    ) {
      return { response: SMTPResponse.mustStartTls(), closeAfter: false };
    }

    switch (command.verb) {
      case 'EHLO':
      case 'HELO':
        return { response: handleEhlo(command, session), closeAfter: false };
      case 'STARTTLS':
        return SMTPHandler.handleStartTls(command, session);
      case 'AUTH': {
        const result = await handleAuth(command, session);
        return { response: result.response, closeAfter: result.closeAfter };
      }
      case 'MAIL':
        return { response: handleMail(command, session), closeAfter: false };
      case 'RCPT':
        return { response: handleRcpt(command, session), closeAfter: false };
      case 'DATA':
        return { response: handleDataStart(session), closeAfter: false };
      case 'RSET':
        return { response: handleRset(command, session), closeAfter: false };
      case 'NOOP':
        return { response: handleNoop(), closeAfter: false };
      case 'VRFY':
        return { response: await handleVrfy(command, session), closeAfter: false };
      case 'EXPN':
        return { response: handleExpn(command, session), closeAfter: false };
      case 'QUIT':
        return { response: handleQuit(session), closeAfter: true };
      case 'HELP':
        return { response: '214 See https://ethartech.de/privmail\r\n', closeAfter: false };
      default:
        return {
          response: SMTPResponse.syntaxError(`Unknown command: ${command.verb}`),
          closeAfter: false,
        };
    }
  }

  private static handleStartTls(command: SMTPCommand, session: SMTPSession): HandleResult {
    if (command.arg) {
      // RFC 3207: STARTTLS takes no parameters.
      return { response: SMTPResponse.paramError('STARTTLS takes no arguments'), closeAfter: false };
    }
    if (session.tlsActive) {
      return { response: SMTPResponse.badSequence('TLS already active'), closeAfter: false };
    }
    if (!isTlsAvailable()) {
      return { response: SMTPResponse.tlsNotAvailable(), closeAfter: false };
    }
    // Server writes "220 Ready to start TLS" and then upgrades the socket.
    return { response: SMTPResponse.readyToStartTls(), closeAfter: false, startTls: true };
  }

  /** Handles a continuation line while an AUTH exchange is in progress. */
  static async completeAuth(line: string, session: SMTPSession): Promise<HandleResult> {
    const result = await handleAuthContinuation(line, session);
    return { response: result.response, closeAfter: result.closeAfter };
  }

  static async completeData(session: SMTPSession, onMessage: OnMessage): Promise<string> {
    try {
      await onMessage(session, session.data);
      resetTransaction(session);
      return SMTPResponse.ok('Message accepted for delivery');
    } catch (err) {
      resetTransaction(session);
      if (err instanceof VirusRejectedError) {
        // Temporary (scanner unavailable / too large under fail-closed) -> 451
        // so the sending MTA retries later. Permanent (infection) -> 554.
        if (err.temporary) {
          return SMTPResponse.tempFailure('Virus scanner unavailable, try again later');
        }
        return SMTPResponse.virusRejected(err.signature);
      }
      return SMTPResponse.transactionFailed('Failed to store message');
    }
  }
}
