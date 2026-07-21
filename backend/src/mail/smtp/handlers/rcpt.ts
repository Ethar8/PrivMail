import { SMTPCommand, SMTPParser } from '../parser';
import { SMTPResponse } from '../response';
import { SMTPSession } from '../session';
import { isValidEmail } from '../../../utils/validator';
import { isLocalDomain } from '../../../config/config';
import { SMTP_MAX_RECIPIENTS } from '../../../config/constants';
import { resolveLocalRecipient } from '../../../models/alias';

export async function handleRcpt(command: SMTPCommand, session: SMTPSession): Promise<string> {
  if (session.mailFrom === null) {
    return SMTPResponse.badSequence('Need MAIL FROM before RCPT TO');
  }
  if (!/^TO:/i.test(command.arg)) {
    return SMTPResponse.paramError('Expected RCPT TO:<address>');
  }
  const address = SMTPParser.parseAddress(command.arg);
  if (address === null || !isValidEmail(address)) {
    return SMTPResponse.paramError('Invalid recipient address');
  }
  const normalized = address.toLowerCase();
  if (!isLocalDomain(normalized)) {
    return SMTPResponse.relayDenied(`Relay access denied for ${normalized}`);
  }
  if (session.rcptTo.length >= SMTP_MAX_RECIPIENTS) {
    return SMTPResponse.transactionFailed('Too many recipients');
  }

  const resolved = await resolveLocalRecipient(normalized);
  if (resolved.kind === 'disabled_alias') {
    // Hard reject: disabled hide-my-email alias (Proton-style one-click block).
    return SMTPResponse.mailboxUnavailable(`Alias ${normalized} is disabled`);
  }
  if (resolved.kind === 'unknown') {
    return SMTPResponse.mailboxUnavailable(`No such user: ${normalized}`);
  }

  session.rcptTo.push(normalized);
  return SMTPResponse.ok('Recipient OK');
}
