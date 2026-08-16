import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers } from '../../apps/worker/src/db/schema';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { run, signIn, signedWebhookRequest, subscriptionEvent } from './support';

// Story: Stripe does not guarantee webhook delivery order. A customer signs
// up (Stripe generates "created" at T1, then "updated" moments later at
// T2 > T1 when the first invoice is paid and status flips to active), but
// network conditions mean this endpoint receives the "updated" event
// FIRST. A naive last-write-wins implementation keyed on arrival order
// would let the late-arriving "created" event (T1, an earlier and now-stale
// point in time) clobber the correct "updated" state (T2, active) back to
// whatever status the subscription had when Stripe first created it. This
// is the same convergence guarantee apps/worker/src/modules/billing/
// subscription.ts's `applySubscriptionEvent` provides, told end-to-end as
// its own signed-up-customer story rather than as a unit test of the
// function in isolation.
describe('story: out-of-order webhook narrative', () => {
  it('a customer who signs up still ends active even when their "updated" event beats "created"', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('out-of-order-story@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_ooo_story',
      createdAt: new Date(),
    });

    const T1 = 1700000000; // Stripe creates the subscription (status incomplete)
    const T2 = 1700000120; // ...two minutes later, the first invoice succeeds

    const updatedFirst = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_ooo_story_updated',
          type: 'customer.subscription.updated',
          customer: 'cus_ooo_story',
          status: 'active',
          created: T2,
        }),
      ),
    );
    expect(updatedFirst.status).toBe(200);

    const createdSecond = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_ooo_story_created',
          type: 'customer.subscription.created',
          customer: 'cus_ooo_story',
          status: 'incomplete',
          created: T1,
        }),
      ),
    );
    expect(createdSecond.status).toBe(200);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
  });
});
