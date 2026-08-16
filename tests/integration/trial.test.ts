import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { customers } from '../../apps/worker/src/db/schema';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { run, signIn, signedWebhookRequest, subscriptionEvent } from './support';

// Story: a subscription created with a free trial arrives as
// "customer.subscription.created" with status "trialing", not "active".
// The web side's ACTIVE_STATUSES set treats trialing the same as active for
// gating purposes (PricingPage/GatedSamplePage) — this proves the D1 mirror
// actually stores "trialing" rather than coercing it to "active" or
// dropping it, which is what that gating logic depends on.
describe('story: trial', () => {
  it('mirrors a trialing subscription with its own distinct status', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('trial@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_trial',
      createdAt: new Date(),
    });

    const res = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_trial_1',
          type: 'customer.subscription.created',
          customer: 'cus_trial',
          status: 'trialing',
          created: 1700000000,
        }),
      ),
    );
    expect(res.status).toBe(200);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('trialing');
  });
});
