import { SMTPCommand } from '../parser';
import { SMTPSession } from '../session';

/**
 * VRFY is disabled for security reasons to prevent email harvesting.
 */
export async function handleVrfy(_command: SMTPCommand, _session: SMTPSession): Promise<string> {
  return '502 Command disabled for security reasons\r\n';
}
