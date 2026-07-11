import { SMTPResponse } from '../response';
import { SMTPSession, resetTransaction } from '../session';

export function handleRset(_command: unknown, session: SMTPSession): string {
  resetTransaction(session);
  return SMTPResponse.ok('Reset OK');
}
