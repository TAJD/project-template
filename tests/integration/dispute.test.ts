import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers } from '../../apps/worker/src/db/schema';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { run, signIn, signedWebhookRequest } from './support';

// Story: a customer disputes a charge with their card issuer. Stripe sends
// "charge.dispute.created". PT-14 did not add a handler for this event
// type, and this test asserts that decision as deliberate rather than an
// accidental gap: a dispute is evidence a *charge* is contested, but it is
// not itself a statement about subscription status — Stripe does not
// auto-cancel the subscription when a dispute opens, and doing so
// automatically here would let a customer revoke their own access (or worse,
// someone else's, if the dispute is fraudulent) via a webhook payload,
// without a human ever reviewing the dispute. The correct response to a
// dispute is a human-reviewed process (a stamped project would wire this to
// an ops alert), not an automatic D1 mutation — so, like "charge.refunded",
// this event type falls outside SUBSCRIPTION_EVENT_TYPES and the webhook
// route's existing "acknowledge and skip unknown event types" behaviour is
// the correct, and already-implemented, no-op.
describe('story: dispute', () => {
  it('acknowledges a charge.dispute.created event without altering the subscription mirror', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('dispute@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_dispute',
      createdAt: new Date(),
    });

    await run(
      await signedWebhookRequest({
        id: 'evt_dispute_sub_created',
        type: 'customer.subscription.created',
        created: 1700000000,
        data: {
          object: {
            id: 'sub_dispute',
            customer: 'cus_dispute',
            status: 'active',
            current_period_end: 1893456000,
            items: { data: [{ price: { id: 'price_test_123' } }] },
          },
        },
      }),
    );

    const res = await run(
      await signedWebhookRequest({
        id: 'evt_dispute_1',
        type: 'charge.dispute.created',
        created: 1700000500,
        data: { object: { id: 'dp_1', charge: 'ch_dispute_1', reason: 'fraudulent' } },
      }),
    );
    expect(res.status).toBe(200);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
  });
});
