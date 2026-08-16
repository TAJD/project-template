// Shared helpers for the PT-15 narrative story-test suite. Scenario names
// and structure are original to this codebase (see docs/modules/billing.md
// "Known gaps" and the design spec's billing section for the ideas being
// exercised) — no source was read or copied from poker-puzzle, the private
// repo the scenario list was inspired by; every helper here is written
// against this template's own webhook handler, `applySubscriptionEvent`
// state machine, and test-auth fixtures.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../apps/worker/src/index';

export const billingEnv = {
  ...env,
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  STRIPE_PRICE_ID: 'price_test_123',
};

export async function run(request: Request, overrideEnv: typeof env = billingEnv) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, overrideEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export function extractCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('expected a Set-Cookie header');
  return setCookie.split(';')[0] ?? '';
}

export async function signIn(email: string): Promise<{ cookie: string; userId: string }> {
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

export async function signedWebhookRequest(
  body: object,
  timestamp = Math.floor(Date.now() / 1000),
) {
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

export function subscriptionEvent(opts: {
  id: string;
  type: string;
  customer: string;
  status: string;
  created: number;
  priceId?: string;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
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
        cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
        items: { data: [{ price: { id: opts.priceId ?? 'price_test_123' } }] },
      },
    },
  };
}
