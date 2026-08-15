import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { authTokens, users, type User } from '../../db/schema';
import { hashToken, randomToken } from '../../lib/crypto';

export type TokenPurpose = 'verify' | 'reset';

const TTL_MS: Record<TokenPurpose, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

export interface CreatedAuthToken {
  token: string;
  expiresAt: Date;
}

export async function createAuthToken(
  db: Database,
  userId: string,
  purpose: TokenPurpose,
): Promise<CreatedAuthToken> {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]);

  await db.insert(authTokens).values({
    tokenHash,
    userId,
    purpose,
    expiresAt,
    createdAt: new Date(),
  });

  return { token, expiresAt };
}

// Single-use: the row is marked used in the same call that validates it, so
// a second consume of the same raw token — even one racing in immediately
// after — reads usedAt already set and fails.
export async function consumeAuthToken(
  db: Database,
  token: string,
  purpose: TokenPurpose,
): Promise<User | null> {
  const tokenHash = await hashToken(token);

  const rows = await db
    .select({ token: authTokens, user: users })
    .from(authTokens)
    .innerJoin(users, eq(authTokens.userId, users.id))
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.purpose, purpose)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.token.usedAt) return null;
  if (row.token.expiresAt.getTime() <= Date.now()) return null;

  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.tokenHash, tokenHash));

  return row.user;
}
