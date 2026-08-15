import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { sessions, users, type User } from '../../db/schema';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Sessions follow the same principle as passwords: the DB never holds a
// value an attacker with read access could replay as-is. The cookie carries
// the raw opaque token; only its SHA-256 hash is stored as the session id.
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  db: Database,
  userId: string,
  expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS),
): Promise<CreatedSession> {
  const token = generateToken();
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
