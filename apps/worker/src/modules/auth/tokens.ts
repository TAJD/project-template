import { and, eq, gt, isNull } from 'drizzle-orm';
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

// Single-use, atomically. Validity (unused, unexpired, right purpose) is
// expressed as the WHERE clause of the UPDATE that marks the token used, so
// SQLite decides it and the write together in one statement. A read-then-write
// version would let two requests carrying the same raw token both observe
// `used_at IS NULL` before either wrote it, and both consume a reset token.
export async function consumeAuthToken(
  db: Database,
  token: string,
  purpose: TokenPurpose,
): Promise<User | null> {
  const tokenHash = await hashToken(token);
  const now = new Date();

  const claimed = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
      ),
    )
    .returning({ userId: authTokens.userId });

  const row = claimed[0];
  if (!row) return null;

  const found = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  return found[0] ?? null;
}
