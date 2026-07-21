import { APP_NAME, MAILBOXES, MAILBOX_LABELS, AI_PROVIDERS } from '../../lib/constants';

describe('constants', () => {
  it('exports app name', () => {
    expect(APP_NAME).toBe('PrivMail');
  });

  it('defines mailboxes', () => {
    expect(MAILBOXES).toContain('INBOX');
    expect(MAILBOX_LABELS.INBOX).toBe('Posteingang');
  });

  it('defines AI providers with ollama default', () => {
    expect(AI_PROVIDERS[0].id).toBe('ollama');
  });
});
