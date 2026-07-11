import { SMTPResponse } from '../response';

export function handleNoop(): string {
  return SMTPResponse.ok('OK');
}
