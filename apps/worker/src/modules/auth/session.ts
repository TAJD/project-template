import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '../../db';
import { sessions, users, type User } from '../../db/schema';
import { hashToken, randomToken } from '../../lib/crypto';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  db: Database,
  userId: string,
  expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS),
): Promise<CreatedSession> {
  const token = randomToken();
  const id = await hashToken(token);

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  return { token, expiresAt };
}

export async function verifySession(db: Database, token: string): Promise<User | null> {
  const id = await hashToken(token);

  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  return row.user;
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  const id = await hashToken(token);
  await db.delete(sessions).where(eq(sessions.id, id));
}

// Rotation on login/privilege change: always mint a fresh token+row rather
// than reusing or renaming an existing one. Deleting the old token first
// means a stolen pre-rotation cookie stops working immediately.
export async function rotateSession(
  db: Database,
  oldToken: string | undefined,
  userId: string,
): Promise<CreatedSession> {
  if (oldToken) await deleteSession(db, oldToken);
  return createSession(db, userId);
}

// A password reset proves control of the account independent of any
// existing session cookie, so every other session — including ones a thief
// of the old password kept alive — is invalidated at the same time.
export async function deleteSessionsForUser(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// A password change proves control of the account the same way a reset
// does, but the user is still sitting in an active session at the time —
// signing that session out too would just be an annoyance, not a security
// gain, so only every *other* session is invalidated.
export async function deleteOtherSessionsForUser(
  db: Database,
  userId: string,
  currentToken: string | undefined,
): Promise<void> {
  if (!currentToken) {
    await deleteSessionsForUser(db, userId);
    return;
  }
  const currentId = await hashToken(currentToken);
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, currentId)));
}
