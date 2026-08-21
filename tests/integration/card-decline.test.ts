import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers } from '../../apps/worker/src/db/schema';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { run, signIn, signedWebhookRequest, subscriptionEvent } from './support';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

// Story: a customer starts Checkout with a card Stripe declines. Stripe
// still creates the Subscription object (so it can retry the payment) but
// in status "incomplete", not "active" — and if the retry window lapses
// without a successful charge, Stripe follows up with another
// "customer.subscription.updated" moving it to "incomplete_expired".
// Neither of those is in the web side's ACTIVE_STATUSES set, so a declined
// card never grants gated access — that's the property this test asserts.
describe('story: card decline', () => {
  it('never mirrors a declined-card subscription as active', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('card-decline@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_decline',
      createdAt: new Date(),
    });

    const created = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_decline_created',
          type: 'customer.subscription.created',
          customer: 'cus_decline',
          status: 'incomplete',
          created: 1700000000,
        }),
      ),
    );
    expect(created.status).toBe(200);

    let subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('incomplete');
    expect(ACTIVE_STATUSES.has(subscription?.status ?? '')).toBe(false);

    // The retry window lapses with no successful payment.
    const expired = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_decline_expired',
          type: 'customer.subscription.updated',
          customer: 'cus_decline',
          status: 'incomplete_expired',
          created: 1700003600,
        }),
      ),
    );
    expect(expired.status).toBe(200);

    subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('incomplete_expired');
    expect(ACTIVE_STATUSES.has(subscription?.status ?? '')).toBe(false);
  });
});
