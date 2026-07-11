import { SMTPResponse } from '../response';
import { SMTPSession } from '../session';

export function handleDataStart(session: SMTPSession): string {
  if (session.mailFrom === null || session.rcptTo.length === 0) {
    return SMTPResponse.badSequence('Need MAIL FROM and RCPT TO before DATA');
  }
  session.inData = true;
  session.data = '';
  return SMTPResponse.startData();
}
