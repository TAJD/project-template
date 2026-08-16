import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers } from '../../apps/worker/src/db/schema';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { run, signIn, signedWebhookRequest, subscriptionEvent } from './support';

// Story: an admin (or Stripe itself, e.g. after repeated payment failure)
// cancels the subscription immediately rather than at period end. Stripe
// sends "customer.subscription.deleted" with status "canceled" right away —
// unlike the cancel-at-period-end story, access is revoked the moment this
// event is applied, not deferred.
describe('story: immediate cancel', () => {
  it('mirrors status canceled as soon as the deleted event is applied', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('cancel-immediate@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_immediate',
      createdAt: new Date(),
    });

    await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_immediate_created',
          type: 'customer.subscription.created',
          customer: 'cus_immediate',
          status: 'active',
          created: 1700000000,
        }),
      ),
    );

    const res = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_immediate_deleted',
          type: 'customer.subscription.deleted',
          customer: 'cus_immediate',
          status: 'canceled',
          created: 1700000500,
        }),
      ),
    );
    expect(res.status).toBe(200);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('canceled');
  });
});
