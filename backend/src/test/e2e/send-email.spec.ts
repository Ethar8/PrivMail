/**
 * End-to-end send-email flow. Requires a running stack (E2E_BASE_URL + a valid
 * E2E_TOKEN). Skipped by default so unit/integration runs remain hermetic.
 */
const BASE_URL = process.env.E2E_BASE_URL;
const TOKEN = process.env.E2E_TOKEN;
const maybe = BASE_URL && TOKEN ? describe : describe.skip;

maybe('E2E: send email', () => {
  it('queues an outbound message', async () => {
    const res = await fetch(`${BASE_URL}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ to: ['dest@example.com'], subject: 'E2E', body: 'hello' }),
    });
    expect([202, 200]).toContain(res.status);
  });
});

export {};
