import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers } from '../../apps/worker/src/db/schema';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { run, signIn, signedWebhookRequest } from './support';

// Story: Stripe issues a refund for a charge, which arrives as
// "charge.refunded" — a charge-level event, not one of the subscription
// events this module's SUBSCRIPTION_EVENT_TYPES set listens for. A refund
// on its own does not change whether the subscription is active: Stripe
// only cancels/downgrades a subscription in response to a *separate*
// subscription-status event (e.g. an admin or dunning flow that
// subsequently cancels it), which would arrive as its own
// "customer.subscription.updated"/".deleted" webhook already covered by the
// other story tests. This test documents that a bare refund event is
// therefore a deliberate no-op for the D1 mirror, not an unhandled gap: the
// webhook route already treats any event type outside
// SUBSCRIPTION_EVENT_TYPES as "acknowledge and skip" by construction.
describe('story: refund', () => {
  it('acknowledges a charge.refunded event without touching the subscription mirror', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('refund@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_refund',
      createdAt: new Date(),
    });

    await run(
      await signedWebhookRequest({
        id: 'evt_refund_sub_created',
        type: 'customer.subscription.created',
        created: 1700000000,
        data: {
          object: {
            id: 'sub_refund',
            customer: 'cus_refund',
            status: 'active',
            current_period_end: 1893456000,
            items: { data: [{ price: { id: 'price_test_123' } }] },
          },
        },
      }),
    );

    const res = await run(
      await signedWebhookRequest({
        id: 'evt_refund_1',
        type: 'charge.refunded',
        created: 1700000500,
        data: { object: { id: 'ch_refund_1', customer: 'cus_refund', amount_refunded: 1000 } },
      }),
    );
    expect(res.status).toBe(200);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
  });
});
