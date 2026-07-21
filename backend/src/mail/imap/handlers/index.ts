import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { config } from '../../../config/config';
import { isTlsAvailable } from '../../tls-context';
import { handleLogin } from './login';
import { handleLogout } from './logout';
import { handleCapability } from './capability';
import { handleSelect } from './select';
import { handleExamine } from './examine';
import { handleCreate } from './create';
import { handleDelete } from './delete';
import { handleRename } from './rename';
import { handleList } from './list';
import { handleStatus } from './status';
import { handleFetch } from './fetch';
import { handleStore } from './store';
import { handleSearch } from './search';
import { handleAppend } from './append';
import { handleExpunge } from './expunge';
import { handleIdleStart } from './idle';
import { handleCopy } from './copy';
import { handleSubscribe, handleUnsubscribe, handleLsub } from './subscribe';

export interface IMAPHandleResult {
  response: string;
  closeAfter: boolean;
  /** When true, the server must upgrade the socket to TLS after the response. */
  startTls?: boolean;
}

/**
 * Commands that are always allowed before authentication / TLS: they are
 * needed for the STARTTLS handshake and capability negotiation.
 */
const PRE_TLS_ALLOWED = new Set(['CAPABILITY', 'NOOP', 'LOGOUT', 'STARTTLS']);

export class IMAPHandler {
  static async handle(cmd: IMAPCommand, session: IMAPSession): Promise<IMAPHandleResult> {
    const r = (response: string, closeAfter = false): IMAPHandleResult => ({ response, closeAfter });

    // No-Plaintext enforcement: block every non-handshake command until TLS.
    if (config.tls.imapRequireTls && !session.tlsActive && !PRE_TLS_ALLOWED.has(cmd.name)) {
      return r(IMAPResponse.privacyRequired(cmd.tag));
    }

    switch (cmd.name) {
      case 'CAPABILITY':
        return r(handleCapability(cmd, session));
      case 'STARTTLS':
        return IMAPHandler.handleStartTls(cmd, session);
      case 'NOOP':
        return r(IMAPResponse.ok(cmd.tag, 'NOOP completed'));
      case 'LOGIN':
        return r(await handleLogin(cmd, session));
      case 'LOGOUT':
        return r(handleLogout(cmd, session), true);
      case 'SELECT':
        return r(await handleSelect(cmd, session));
      case 'EXAMINE':
        return r(await handleExamine(cmd, session));
      case 'CREATE':
        return r(await handleCreate(cmd, session));
      case 'DELETE':
        return r(await handleDelete(cmd, session));
      case 'RENAME':
        return r(await handleRename(cmd, session));
      case 'LIST':
        return r(await handleList(cmd, session));
      case 'LSUB':
        return r(await handleLsub(cmd, session));
      case 'SUBSCRIBE':
        return r(await handleSubscribe(cmd, session));
      case 'UNSUBSCRIBE':
        return r(await handleUnsubscribe(cmd, session));
      case 'STATUS':
        return r(await handleStatus(cmd, session));
      case 'FETCH':
        return r(await handleFetch(cmd, session));
      case 'STORE':
        return r(await handleStore(cmd, session));
      case 'SEARCH':
        return r(await handleSearch(cmd, session));
      case 'EXPUNGE':
        return r(await handleExpunge(cmd, session));
      case 'IDLE':
        return r(handleIdleStart(cmd, session));
      case 'UID':
        return r(await IMAPHandler.handleUid(cmd, session));
      case 'CLOSE':
        session.selectedMailbox = null;
        session.state = 'authenticated';
        return r(IMAPResponse.ok(cmd.tag, 'CLOSE completed'));
      case 'APPEND':
        // APPEND with an inline literal already buffered by the server layer.
        return r(await handleAppend(cmd, session, ''));
      case 'COPY':
        return r(await handleCopy(cmd, session));
      default:
        return r(IMAPResponse.bad(cmd.tag, `Unknown command: ${cmd.name}`));
    }
  }

  private static handleStartTls(cmd: IMAPCommand, session: IMAPSession): IMAPHandleResult {
    if (session.tlsActive) {
      return { response: IMAPResponse.bad(cmd.tag, 'TLS already active'), closeAfter: false };
    }
    if (!isTlsAvailable()) {
      return { response: IMAPResponse.no(cmd.tag, 'TLS not available'), closeAfter: false };
    }
    return {
      response: IMAPResponse.ok(cmd.tag, 'Begin TLS negotiation now'),
      closeAfter: false,
      startTls: true,
    };
  }

  static async handleUid(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
    const sub = (cmd.args[0] ?? '').toUpperCase();
    switch (sub) {
      case 'FETCH':
        return handleFetch(cmd, session);
      case 'STORE':
        return handleStore(cmd, session);
      case 'SEARCH':
        return handleSearch(cmd, session);
      default:
        return IMAPResponse.bad(cmd.tag, `Unknown UID subcommand: ${sub}`);
    }
  }

  static async completeAppend(session: IMAPSession, literal: string): Promise<string> {
    const pending = session.pendingAppend;
    if (!pending) return IMAPResponse.bad('*', 'no pending APPEND');
    session.pendingAppend = null;
    return handleAppend(pending.command, session, literal);
  }
}
