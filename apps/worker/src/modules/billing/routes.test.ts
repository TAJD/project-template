import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../index';
import { createDb } from '../../db';
import { customers } from '../../db/schema';
import { getSubscription } from './subscription';

const billingEnv = {
  ...env,
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  STRIPE_PRICE_ID: 'price_test_123',
};

async function run(request: Request, overrideEnv: typeof env = billingEnv) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, overrideEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function extractCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('expected a Set-Cookie header');
  return setCookie.split(';')[0] ?? '';
}

async function signIn(email: string): Promise<{ cookie: string; userId: string }> {
  const res = await run(
    new Request('http://localhost/api/test-auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, token: env.TEST_AUTH_TOKEN }),
    }),
  );
  const cookie = extractCookie(res);
  const body = (await res.json()) as { user: { id: string } };
  return { cookie, userId: body.user.id };
}

async function sign(payload: string, timestamp: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signedWebhookRequest(body: object, timestamp = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify(body);
  const signature = await sign(payload, timestamp, billingEnv.STRIPE_WEBHOOK_SECRET);
  return new Request('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    },
    body: payload,
  });
}

function subscriptionEvent(opts: {
  id: string;
  type: 'customer.subscription.created' | 'customer.subscription.updated';
  customer: string;
  status: string;
  created: number;
  priceId?: string;
  currentPeriodEnd?: number;
}) {
  return {
    id: opts.id,
    type: opts.type,
    created: opts.created,
    data: {
      object: {
        id: 'sub_test_1',
        customer: opts.customer,
        status: opts.status,
        current_period_end: opts.currentPeriodEnd ?? 1893456000,
        items: { data: [{ price: { id: opts.priceId ?? 'price_test_123' } }] },
      },
    },
  };
}

describe('POST /api/billing/checkout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a Stripe customer and checkout session, returning its URL', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/customers')) {
        return Promise.resolve(Response.json({ id: 'cus_new_1' }));
      }
      if (url.includes('/checkout/sessions')) {
        return Promise.resolve(
          Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' }),
        );
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { cookie } = await signIn('checkout@example.com');

    const res = await run(
      new Request('http://localhost/api/billing/checkout', {
        method: 'POST',
        headers: { cookie },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe('https://checkout.stripe.com/pay/cs_test_1');

    const checkoutCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/checkout/sessions'),
    );
    expect(checkoutCall).toBeDefined();
    const requestInit = checkoutCall?.[1] as RequestInit;
    const sentBody = new URLSearchParams(requestInit.body as string);
    expect(sentBody.get('customer')).toBe('cus_new_1');
    expect(sentBody.get('line_items[0][price]')).toBe('price_test_123');
    expect(sentBody.get('mode')).toBe('subscription');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await run(new Request('http://localhost/api/billing/checkout', { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/billing/portal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a billing-account-required error when the user has never checked out', async () => {
    const { cookie } = await signIn('no-billing@example.com');

    const res = await run(
      new Request('http://localhost/api/billing/portal', { method: 'POST', headers: { cookie } }),
    );

    expect(res.status).toBe(400);
  });

  it('creates a portal session for an existing customer', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/customers')) return Promise.resolve(Response.json({ id: 'cus_portal_1' }));
      if (url.includes('/checkout/sessions')) {
        return Promise.resolve(Response.json({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }));
      }
      if (url.includes('/billing_portal/sessions')) {
        return Promise.resolve(Response.json({ url: 'https://billing.stripe.com/session/1' }));
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { cookie } = await signIn('portal@example.com');
    await run(
      new Request('http://localhost/api/billing/checkout', { method: 'POST', headers: { cookie } }),
    );

    const res = await run(
      new Request('http://localhost/api/billing/portal', { method: 'POST', headers: { cookie } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe('https://billing.stripe.com/session/1');
  });
});

describe('POST /api/billing/webhook', () => {
  it('rejects a request with no signature header', async () => {
    const res = await run(
      new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        body: JSON.stringify({ id: 'evt_1' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a request with an invalid signature', async () => {
    const res = await run(
      new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1893456000,v1=deadbeef' },
        body: JSON.stringify({ id: 'evt_bad_sig', type: 'customer.subscription.created' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts a validly signed event and mirrors the subscription to D1', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('webhook-accept@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_webhook_accept',
      createdAt: new Date(),
    });

    const res = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_accept_1',
          type: 'customer.subscription.created',
          customer: 'cus_webhook_accept',
          status: 'active',
          created: 1700000000,
        }),
      ),
    );

    expect(res.status).toBe(200);
    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
  });

  it('ignores a duplicate delivery of the same event id', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('webhook-dup@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_webhook_dup',
      createdAt: new Date(),
    });

    const event = subscriptionEvent({
      id: 'evt_dup_1',
      type: 'customer.subscription.created',
      customer: 'cus_webhook_dup',
      status: 'active',
      created: 1700000000,
    });

    const first = await run(await signedWebhookRequest(event));
    expect(first.status).toBe(200);
    expect((await first.json()) as { duplicate?: boolean }).not.toHaveProperty('duplicate', true);

    // Redeliver with a mutated status — if dedup only guarded against exact
    // duplicate payloads instead of the event id, this would still apply.
    const second = await run(
      await signedWebhookRequest({
        ...event,
        data: { object: { ...event.data.object, status: 'canceled' } },
      }),
    );
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { duplicate?: boolean };
    expect(secondBody.duplicate).toBe(true);

    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
  });

  // The out-of-order convergence test the ticket calls out explicitly: Stripe
  // does not guarantee webhook delivery order, so the chronologically later
  // "updated" event (created at T2, status "active") can be delivered to
  // this endpoint *before* the chronologically earlier "created" event
  // (created at T1 < T2, status "incomplete") that logically precedes it. A
  // naive last-write-wins implementation keyed on arrival order would let
  // the "created" event (arriving second) clobber the "updated" event's
  // state back to "incomplete" — this test proves that does not happen.
  it('converges to the correct state when an updated event arrives before its created event', async () => {
    const db = createDb(env.DB);
    const { userId } = await signIn('webhook-order@example.com');
    await db.insert(customers).values({
      userId,
      stripeCustomerId: 'cus_webhook_order',
      createdAt: new Date(),
    });

    const T1 = 1700000000; // earlier point in time Stripe describes
    const T2 = 1700000500; // later point in time Stripe describes

    // "updated" (T2, active) arrives FIRST.
    const updatedRes = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_updated',
          type: 'customer.subscription.updated',
          customer: 'cus_webhook_order',
          status: 'active',
          created: T2,
        }),
      ),
    );
    expect(updatedRes.status).toBe(200);

    // "created" (T1, incomplete) arrives SECOND, out of order.
    const createdRes = await run(
      await signedWebhookRequest(
        subscriptionEvent({
          id: 'evt_created',
          type: 'customer.subscription.created',
          customer: 'cus_webhook_order',
          status: 'incomplete',
          created: T1,
        }),
      ),
    );
    expect(createdRes.status).toBe(200);

    // The later ("updated", active) state must win, even though the
    // earlier ("created", incomplete) event arrived second.
    const subscription = await getSubscription(db, userId);
    expect(subscription?.status).toBe('active');
  });
});
