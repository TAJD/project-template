import { describe, expect, it, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../apps/worker/src/db';
import { getSubscription } from '../../apps/worker/src/modules/billing/subscription';
import { billingEnv, run, signIn, signedWebhookRequest, subscriptionEvent } from './support';

// Story: a signed-up user starts checkout, Stripe (mocked) creates the
// customer + Checkout Session, and — asynchronously, the way it really
// happens — Stripe's webhook delivers `customer.subscription.created` with
// status "active". The D1 mirror is the only thing the app ever reads back,
// so this proves the whole request/webhook loop lands there correctly.
describe('story: subscribe happy path', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('takes a signed-up user through checkout to an active D1-mirrored subscription', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/customers')) return Promise.resolve(Response.json({ id: 'cus_happy_1' }));
      if (url.includes('/checkout/sessions')) {
        return Promise.resolve(
          Response.json({ id: 'cs_happy_1', url: 'https://checkout.stripe.com/pay/cs_happy_1' }),
        );
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { cookie, userId } = await signIn('subscribe-happy@example.com');

    const checkoutRes = await run(
      new Request('http://localhost/api/billing/checkout', { method: 'POST', headers: { cookie } }),
    );
    expect(checkoutRes.status).toBe(200);
    const { url } = (await checkoutRes.json()) as { url: string };
    expect(url).toBe('https://checkout.stripe.com/pay/cs_happy_1');

    // A subscribed user has no active subscription yet — Stripe hasn't told
    // the app anything beyond "a session was created."
    const db = createDb(env.DB);
    expect(await getSubscription(db, userId)).toBeNull();

    // The webhook is how the app actually learns the subscription exists.
    const webhookRes = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_happy_1',
          type: 'customer.subscription.created',
          customer: 'cus_happy_1',
          status: 'active',
          created: 1700000000,
        }),
      ),
      billingEnv,
    );
    expect(webhookRes.status).toBe(200);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
  });
});
