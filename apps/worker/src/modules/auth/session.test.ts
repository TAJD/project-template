import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../db';
import { users } from '../../db/schema';
import { createSession, deleteSession, verifySession } from './session';

async function seedUser(id: string, email: string) {
  const db = createDb(env.DB);
  await db.insert(users).values({
    id,
    email,
    passwordHash: 'irrelevant-for-session-tests',
    createdAt: new Date(),
  });
  return db;
}

describe('sessions', () => {
  it('creates a session and verifies it back to the owning user', async () => {
    const db = await seedUser('user-1', 'session1@example.com');

    const { token } = await createSession(db, 'user-1');
    const user = await verifySession(db, token);

    expect(user?.id).toBe('user-1');
  });

  it('returns null for an unknown token', async () => {
    const db = createDb(env.DB);

    const user = await verifySession(db, 'not-a-real-token');

    expect(user).toBeNull();
  });

  it('never stores the raw token, only its hash', async () => {
    const db = await seedUser('user-2', 'session2@example.com');

    const { token } = await createSession(db, 'user-2');
    const row = await env.DB.prepare('SELECT id FROM sessions').first<{ id: string }>();

    expect(row?.id).toBeDefined();
    expect(row?.id).not.toBe(token);
  });

  it('deleting a session invalidates it', async () => {
    const db = await seedUser('user-3', 'session3@example.com');

    const { token } = await createSession(db, 'user-3');
    await deleteSession(db, token);
    const user = await verifySession(db, token);

    expect(user).toBeNull();
  });

  it('rejects an expired session', async () => {
    const db = await seedUser('user-4', 'session4@example.com');

    const { token } = await createSession(db, 'user-4', new Date(Date.now() - 1000));
    const user = await verifySession(db, token);

    expect(user).toBeNull();
  });
});
