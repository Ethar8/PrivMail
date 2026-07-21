import { buildAutodiscoveryPayload } from '../../lib/autodiscovery';

describe('buildAutodiscoveryPayload', () => {
  it('builds RFC6186 hints', () => {
    const payload = buildAutodiscoveryPayload({
      email: 'user@example.com',
      domain: 'mail.example.com',
      displayName: 'User',
    });
    expect(payload).toContain('PRIVMAIL-AUTOCONFIG/1');
    expect(payload).toContain('email=user@example.com');
    expect(payload).toContain('name=User');
    expect(payload).toContain('_submission._tcp');
    expect(payload).toContain('_imaps._tcp');
    expect(payload).toContain('jmap=');
  });

  it('uses custom ports', () => {
    const payload = buildAutodiscoveryPayload({
      email: 'a@b.de',
      domain: 'mail.b.de',
      smtpPort: 465,
      imapPort: 993,
    });
    expect(payload).toContain('mail.b.de:465');
    expect(payload).toContain('mail.b.de:993');
  });
});
