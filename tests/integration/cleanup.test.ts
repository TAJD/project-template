import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers, sessions, subscriptions, users } from '../../apps/worker/src/db/schema';
import {
  applySubscriptionEvent,
  getSubscription,
} from '../../apps/worker/src/modules/billing/subscription';
import { deleteAccount } from '../../apps/worker/src/modules/auth/delete-account';
import { signIn } from './support';

// Story: PT-13's delete-account cascade was extended by PT-14 to include the
// billing tables (see apps/docs/src/content/docs/modules/billing.md's "Touch-points" — subscriptions
// and customers are deleted in the same atomic db.batch() ahead of
// sessions/authTokens/users). This test proves that end-to-end from a real
// signed-up-and-subscribed test user rather than trusting the comment: sign
// up, subscribe, then delete, and confirm every row that user owned is
// actually gone afterward — not just the ones deleteAccount() happens to be
// documented as touching.
//
// `deleteAccount()` is called directly rather than through
// `DELETE /api/account` because test-auth-created users get a random
// unknown password (see modules/auth/test-auth.ts), and the account
// deletion route requires re-confirming the current password as a
// stolen-session safeguard — there is no password this test could supply.
// Calling the same function the route calls exercises the real cascade
// logic (the atomic db.batch()) without that unrelated auth requirement.
describe('story: cleanup — delete-account cascade removes billing rows', () => {
  it('removes subscriptions, customers, sessions, and the user row together', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('cleanup@example.com');

    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_cleanup',
      createdAt: new Date(),
    });
    await applySubscriptionEvent(
      db,
      userId,
      {
        stripeSubscriptionId: 'sub_cleanup',
        status: 'active',
        priceId: 'price_test_123',
        currentPeriodEnd: new Date('2030-01-01T00:00:00Z'),
      },
      new Date('2026-01-01T00:00:00Z'),
    );

    // Sanity-check the fixture actually exists before deleting it.
    expect(await getSubscription(db, userId)).not.toBeNull();
    const customerRowsBefore = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId));
    expect(customerRowsBefore).toHaveLength(1);
    const sessionRowsBefore = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(sessionRowsBefore.length).toBeGreaterThan(0);

    await deleteAccount(db, userId);

    expect(await getSubscription(db, userId)).toBeNull();
    expect(await db.select().from(customers).where(eq(customers.userId, userId))).toHaveLength(0);
    expect(
      await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    ).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, userId))).toHaveLength(0);
  });
});
