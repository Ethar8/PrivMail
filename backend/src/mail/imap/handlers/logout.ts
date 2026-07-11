import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';

export function handleLogout(cmd: IMAPCommand, session: IMAPSession): string {
  session.state = 'logout';
  return IMAPResponse.bye() + IMAPResponse.ok(cmd.tag, 'LOGOUT completed');
}
