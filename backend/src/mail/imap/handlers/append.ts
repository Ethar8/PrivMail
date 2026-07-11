import { randomUUID } from 'crypto';
import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailStore } from '../../storage/mailstore';
import { parseMessage } from '../../smtp/parser-message';
import { sanitizeMailbox } from '../../../utils/validator';

/**
 * APPEND <mailbox> [flags] [date] {literal}. The message literal is buffered by
 * the server layer and passed here as `session.appendBuffer`.
 */
export async function handleAppend(
  cmd: IMAPCommand,
  session: IMAPSession,
  literal: string,
): Promise<string> {
  if (!session.userId) return IMAPResponse.no(cmd.tag, 'not authenticated');
  const mailbox = sanitizeMailbox(cmd.args[0] ?? 'INBOX');
  const parsed = parseMessage(literal);

  await mailStore.store({
    userId: session.userId,
    messageId: parsed.messageId || `<${randomUUID()}@privmail>`,
    from: parsed.from,
    to: parsed.to.join(', '),
    subject: parsed.subject,
    body: parsed.body,
    raw: literal,
    isEncrypted: /BEGIN PGP MESSAGE/.test(literal),
    mailbox,
  });

  return IMAPResponse.ok(cmd.tag, '[APPENDUID 1] APPEND completed');
}
