import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { verifyCredentials } from '../../../models/user';

export async function handleLogin(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  const [username, password] = cmd.args;
  if (!username || !password) {
    return IMAPResponse.bad(cmd.tag, 'LOGIN requires username and password');
  }
  const user = await verifyCredentials(username.toLowerCase(), password);
  if (!user) {
    return IMAPResponse.no(cmd.tag, 'invalid credentials');
  }
  session.state = 'authenticated';
  session.user = user.email;
  session.userId = user.id;
  return IMAPResponse.ok(cmd.tag, 'LOGIN completed');
}
