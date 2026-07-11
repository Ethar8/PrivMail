import { config } from '../../../config/config';
import { SMTPResponse } from '../response';
import { SMTPSession } from '../session';

export function handleQuit(_session: SMTPSession): string {
  return SMTPResponse.bye(config.domain);
}
