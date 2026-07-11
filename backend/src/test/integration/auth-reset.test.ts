/**
 * DB-backed tests for password reset and token revocation. They run only when
 * PRIVMAIL_DB_TEST=1 is set (a live Postgres is available and migrated),
 * otherwise they are skipped so the default suite stays hermetic.
 */
import { runMigrations } from '../../database/migrate';
import { createUser, getTokenVersion, updatePassword } from '../../models/user';
import { createResetToken, consumeResetToken } from '../../models/reset-token';
import { query, closePool } from '../../database/connection';

const dbAvailable = process.env.PRIVMAIL_DB_TEST === '1';
const maybe = dbAvailable ? describe : describe.skip;

maybe('password reset & token revocation (DB)', () => {
  let userId: string;
  const email = `reset-${Date.now()}@localhost`;

  beforeAll(async () => {
    await runMigrations();
    const pub = await createUser(email, 'initial-password', 'Reset Tester', false);
    userId = pub.id;
  });

  afterAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [email]);
    await closePool();
  });

  it('bumps token_version on password update (revokes old tokens)', async () => {
    const before = await getTokenVersion(userId);
    await updatePassword(userId, 'new-password-123');
    const after = await getTokenVersion(userId);
    expect(after).toBe((before ?? 0) + 1);
  });

  it('reset token is single-use and yields the correct user', async () => {
    const token = await createResetToken(userId, 60);
    const uid1 = await consumeResetToken(token);
    expect(uid1).toBe(userId);
    const uid2 = await consumeResetToken(token);
    expect(uid2).toBeNull();
  });

  it('rejects an unknown reset token', async () => {
    const uid = await consumeResetToken('definitely-not-a-real-token');
    expect(uid).toBeNull();
  });
});

export {};
