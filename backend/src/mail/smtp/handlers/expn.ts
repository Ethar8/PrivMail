import { SMTPCommand } from '../parser';
import { SMTPSession } from '../session';

/**
 * EXPN (expand mailing list) is disabled for privacy/anti-harvesting reasons,
 * as recommended by RFC 5321 §7.3.
 */
export function handleExpn(_command: SMTPCommand, _session: SMTPSession): string {
  return '252 Cannot EXPN mailing lists\r\n';
}
