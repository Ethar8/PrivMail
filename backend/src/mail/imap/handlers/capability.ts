import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { config } from '../../../config/config';
import { isTlsAvailable } from '../../tls-context';

export function handleCapability(cmd: IMAPCommand, session: IMAPSession): string {
  const caps = ['IMAP4rev1', 'IDLE', 'UIDPLUS', 'LITERAL+'];

  if (isTlsAvailable() && !session.tlsActive) {
    caps.push('STARTTLS');
  }

  // Before TLS (when enforced), advertise LOGINDISABLED and withhold AUTH
  // mechanisms so compliant clients do not send credentials in the clear.
  if (config.tls.imapRequireTls && !session.tlsActive) {
    caps.push('LOGINDISABLED');
  } else {
    caps.push('AUTH=PLAIN', 'AUTH=LOGIN');
  }

  return (
    IMAPResponse.untagged(`CAPABILITY ${caps.join(' ')}`) +
    IMAPResponse.ok(cmd.tag, 'CAPABILITY completed')
  );
}
