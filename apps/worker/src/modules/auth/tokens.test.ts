import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { createDb } from '../../db';
import { authTokens, users } from '../../db/schema';
import { createAuthToken, consumeAuthToken } from './tokens';

async function seedUser(id: string, email: string) {
  const db = createDb(env.DB);
  await db.insert(users).values({
    id,
    email,
    passwordHash: 'irrelevant-for-token-tests',
    createdAt: new Date(),
  });
  return db;
}

describe('auth tokens', () => {
  it('creates a token and consumes it back to the owning user', async () => {
    const db = await seedUser('user-1', 'tokens1@example.com');

    const { token } = await createAuthToken(db, 'user-1', 'verify');
    const user = await consumeAuthToken(db, token, 'verify');

    expect(user?.id).toBe('user-1');
  });

  it('never stores the raw token, only its hash', async () => {
    const db = await seedUser('user-2', 'tokens2@example.com');

    const { token } = await createAuthToken(db, 'user-2', 'reset');
    const row = await env.DB.prepare('SELECT token_hash FROM auth_tokens').first<{
      token_hash: string;
    }>();

    expect(row?.token_hash).toBeDefined();
    expect(row?.token_hash).not.toBe(token);
  });

  it('is single-use: a second consume of the same token fails', async () => {
    const db = await seedUser('user-3', 'tokens3@example.com');

    const { token } = await createAuthToken(db, 'user-3', 'verify');
    const first = await consumeAuthToken(db, token, 'verify');
    const second = await consumeAuthToken(db, token, 'verify');

    expect(first?.id).toBe('user-3');
    expect(second).toBeNull();
  });

  it('rejects an expired token', async () => {
    const db = await seedUser('user-4', 'tokens4@example.com');
    const { token } = await createAuthToken(db, 'user-4', 'reset');

    await db
      .update(authTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authTokens.userId, 'user-4'));

    const user = await consumeAuthToken(db, token, 'reset');

    expect(user).toBeNull();
  });

  it('rejects a token consumed for the wrong purpose', async () => {
    const db = await seedUser('user-5', 'tokens5@example.com');
    const { token } = await createAuthToken(db, 'user-5', 'verify');

    const user = await consumeAuthToken(db, token, 'reset');

    expect(user).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    const db = createDb(env.DB);

    const user = await consumeAuthToken(db, 'not-a-real-token', 'verify');

    expect(user).toBeNull();
  });
});
