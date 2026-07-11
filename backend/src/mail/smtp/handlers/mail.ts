import { SMTPCommand, SMTPParser } from '../parser';
import { SMTPResponse } from '../response';
import { SMTPSession, resetTransaction } from '../session';
import { isValidEmail } from '../../../utils/validator';

export function handleMail(command: SMTPCommand, session: SMTPSession): string {
  if (!/^FROM:/i.test(command.arg)) {
    return SMTPResponse.paramError('Expected MAIL FROM:<address>');
  }
  const address = SMTPParser.parseAddress(command.arg);
  if (address === null || (address !== '' && !isValidEmail(address))) {
    return SMTPResponse.paramError('Invalid sender address');
  }
  resetTransaction(session);
  session.mailFrom = address.toLowerCase();
  return SMTPResponse.ok('Sender OK');
}
