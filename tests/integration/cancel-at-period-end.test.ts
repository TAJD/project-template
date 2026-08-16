import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers } from '../../apps/worker/src/db/schema';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { run, signIn, signedWebhookRequest, subscriptionEvent } from './support';

// Story: the customer cancels via the billing portal but keeps access until
// the period they already paid for runs out. Stripe reflects this as a
// "customer.subscription.updated" event with status still "active" and
// `cancel_at_period_end: true` — it does NOT emit `.deleted` (status
// "canceled") until the period actually ends. Distinguishing this from an
// immediate cancellation is why the `subscriptions` table carries its own
// `cancel_at_period_end` column rather than only a status string.
describe('story: cancel at period end', () => {
  it('keeps status active with cancel_at_period_end set, not a terminal status', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('cancel-at-period-end@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_cape',
      createdAt: new Date(),
    });

    // First establish an active subscription, as if the customer already
    // subscribed some time ago.
    await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_cape_created',
          type: 'customer.subscription.created',
          customer: 'cus_cape',
          status: 'active',
          created: 1700000000,
        }),
      ),
    );

    // Then the cancellation-at-period-end request comes through.
    const res = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_cape_updated',
          type: 'customer.subscription.updated',
          customer: 'cus_cape',
          status: 'active',
          created: 1700000500,
          cancelAtPeriodEnd: true,
        }),
      ),
    );
    expect(res.status).toBe(200);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
    expect(subscription?.cancelAtPeriodEnd).toBe(true);
  });
});
