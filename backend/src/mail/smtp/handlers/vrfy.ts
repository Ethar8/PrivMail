import { SMTPCommand } from '../parser';
import { SMTPSession } from '../session';
import { findByEmail } from '../../../models/user';
import { extractAddress } from '../../../utils/validator';

/**
 * VRFY verifies whether a mailbox exists locally. For privacy we return the
 * cannot-VRFY response (252) unless the address resolves to a local user.
 */
export async function handleVrfy(command: SMTPCommand, _session: SMTPSession): Promise<string> {
  const address = extractAddress(command.arg);
  if (!address) {
    return '252 Cannot VRFY user, but will accept message and attempt delivery\r\n';
  }
  const user = await findByEmail(address);
  if (user) {
    return `250 ${user.display_name ?? address} <${address}>\r\n`;
  }
  return '252 Cannot VRFY user, but will accept message and attempt delivery\r\n';
}
