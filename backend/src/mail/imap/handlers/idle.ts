import * as net from 'net';
import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { IMAP_IDLE_TIMEOUT_MS } from '../../../config/constants';

/**
 * IDLE (RFC 2177). Puts the connection into idle mode; the server pushes
 * untagged EXISTS/RECENT notifications when new mail arrives, and the client
 * ends idling by sending "DONE".
 */
export function handleIdleStart(cmd: IMAPCommand, session: IMAPSession): string {
  if (session.state !== 'selected') {
    return IMAPResponse.bad(cmd.tag, 'IDLE requires a selected mailbox');
  }
  session.idling = true;
  session.idleTag = cmd.tag;
  if (session.idleTimeout) clearTimeout(session.idleTimeout);
  session.idleTimeout = setTimeout(() => {
    if (session.idling) {
      session.socket.write(IMAPResponse.bye());
      session.socket.end();
    }
  }, IMAP_IDLE_TIMEOUT_MS);
  return '+ idling\r\n';
}

export function handleIdleDone(session: IMAPSession): string {
  const tag = session.idleTag ?? '*';
  session.idling = false;
  session.idleTag = null;
  if (session.idleTimeout) {
    clearTimeout(session.idleTimeout);
    session.idleTimeout = null;
  }
  return IMAPResponse.ok(tag, 'IDLE terminated');
}

/**
 * Push a "new message" notification to an idling session.
 */
export function notifyNewEmail(session: IMAPSession, total: number): void {
  if (session.idling && session.socket && !(session.socket as net.Socket).destroyed) {
    session.socket.write(IMAPResponse.untagged(`${total} EXISTS`));
    session.socket.write(IMAPResponse.untagged(`1 RECENT`));
  }
}
