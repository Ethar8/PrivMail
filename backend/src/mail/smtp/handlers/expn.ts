import { SMTPCommand } from '../parser';
import { SMTPSession } from '../session';

/**
 * EXPN (expand mailing list) is disabled for security reasons to prevent email harvesting.
 */
export function handleExpn(_command: SMTPCommand, _session: SMTPSession): string {
  return '502 Command disabled for security reasons\r\n';
}
