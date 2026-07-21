import {
  mapEmailRow,
  saveEmailLocally,
  getEmailsLocally,
  saveContactLocally,
  getContactsLocally,
  saveCalendarEventLocally,
} from '../../lib/db';

describe('db local storage', () => {
  it('maps email rows', () => {
    const email = mapEmailRow({
      id: '1',
      message_id: 'm1',
      from_email: 'a@b.de',
      to_email: 'b@c.de',
      subject: 'Test',
      body: 'Hi',
      received_at: 1000,
      is_read: 1,
      is_encrypted: 0,
      mailbox: 'INBOX',
    });
    expect(email.from).toBe('a@b.de');
    expect(email.isRead).toBe(true);
  });

  it('saves and loads emails', async () => {
    await saveEmailLocally({
      id: 'e1',
      messageId: 'm1',
      from: 'a@b.de',
      to: 'b@c.de',
      subject: 'S',
      body: 'B',
      receivedAt: Date.now(),
      isRead: false,
      isEncrypted: false,
      mailbox: 'INBOX',
    });
    const list = await getEmailsLocally('INBOX');
    expect(Array.isArray(list)).toBe(true);
  });

  it('saves contacts locally', async () => {
    await saveContactLocally({
      id: 'c1',
      name: 'Anna',
      email: 'a@b.de',
      phone: '',
      organization: '',
      notes: '',
      encryptedData: null,
      updatedAt: Date.now(),
    });
    const contacts = await getContactsLocally();
    expect(Array.isArray(contacts)).toBe(true);
  });

  it('saves calendar events locally', async () => {
    const now = Date.now();
    await saveCalendarEventLocally({
      id: 'ev1',
      title: 'Meeting',
      description: '',
      location: '',
      startAt: now,
      endAt: now + 3600000,
      allDay: false,
      encryptedData: null,
      updatedAt: now,
    });
  });
});
