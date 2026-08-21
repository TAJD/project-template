import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { authTokens, customers, sessions, subscriptions, users } from '../../db/schema';

// Hook point for PT-13's "delete-cascade" contract: every table that stores
// user-owned rows contributes one delete statement here, keyed on userId, so
// a later module (billing) extends this array instead of adding its own
// separate delete call that could partially fail independently of this one.
// See apps/docs/src/content/docs/modules/account.md for the GDPR rationale for deleting rather
// than soft-deleting/anonymising.
//
// `customers`/`subscriptions` (billing, PT-14) are included here — `users`
// still cascades to them via their own FK `ON DELETE cascade`, but batching
// their deletes explicitly keeps this list the single place that documents
// every table a full account deletion touches, rather than relying on a
// reader to already know which FKs cascade. `stripe_events` is deliberately
// excluded: it is keyed by Stripe event id, not user id, and its rows carry
// no personal data — it's a dedup ledger, not user-owned state.
function accountDeletionStatements(db: Database, userId: string) {
  return [
    db.delete(subscriptions).where(eq(subscriptions.userId, userId)),
    db.delete(customers).where(eq(customers.userId, userId)),
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
