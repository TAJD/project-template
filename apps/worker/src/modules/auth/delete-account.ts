import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { authTokens, sessions, users } from '../../db/schema';

// Hook point for PT-13's "delete-cascade" contract: every table that stores
// user-owned rows contributes one delete statement here, keyed on userId, so
// a later module (billing) extends this array instead of adding its own
// separate delete call that could partially fail independently of this one.
// See docs/modules/account.md for the GDPR rationale for deleting rather
// than soft-deleting/anonymising.
function accountDeletionStatements(db: Database, userId: string) {
  return [
    db.delete(sessions).where(eq(sessions.userId, userId)),
    db.delete(authTokens).where(eq(authTokens.userId, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ] as const;
}

// D1's batch() runs every statement as a single atomic unit (all-or-nothing)
// even though each is issued over what looks like separate calls — unlike a
// naive sequence of awaited deletes, a failure partway through can't leave
// sessions or tokens deleted while the users row survives (or vice versa).
export async function deleteAccount(db: Database, userId: string): Promise<void> {
  const statements = accountDeletionStatements(db, userId);
  await db.batch(statements);
}
