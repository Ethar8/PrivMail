import { config } from '../../../config/config';
import { SMTPCommand } from '../parser';
import { SMTPResponse } from '../response';
import { SMTPSession } from '../session';
import { isTlsAvailable } from '../../tls-context';

export function handleEhlo(command: SMTPCommand, session: SMTPSession): string {
  session.clientHostname = command.arg || null;
  if (command.verb === 'HELO') {
    return SMTPResponse.ok(`${config.domain} Hello ${command.arg || session.remoteAddress}`);
  }
  const extensions = ['SIZE 52428800', 'PIPELINING', '8BITMIME'];
  // Advertise STARTTLS only when TLS is available and not already active.
  if (isTlsAvailable() && !session.tlsActive) {
    extensions.splice(1, 0, 'STARTTLS');
  }
  // Advertise AUTH only once the channel is encrypted (No Plaintext), unless
  // TLS enforcement is disabled entirely.
  if (session.tlsActive || !config.tls.smtpRequireTls) {
    extensions.push('AUTH PLAIN LOGIN');
  }
  return SMTPResponse.ehlo(config.domain, extensions);
}
