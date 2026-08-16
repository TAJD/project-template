// Thin wrapper around the Stripe HTTP API — the only place this module calls
// `fetch` for Stripe at all, and only from the checkout/portal routes (never
// from `getSubscription`, which reads D1 only). Kept as plain functions over
// a project-owned shape rather than the `stripe` SDK: the SDK is a large
// dependency for the handful of endpoints this template needs, and a thin
// wrapper is easy to mock in tests via `vi.stubGlobal('fetch', ...)`, same as
// `lib/email.ts`'s `ResendSender`.

const STRIPE_API = 'https://api.stripe.com/v1';

export class StripeApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

// Static safety net (PT-15's safety-guard test suite): this template has no
// real Stripe account, and every test mocks `fetch` rather than hitting
// Stripe's live API — nothing here has ever exercised a real live-mode key.
// A live secret key ending up in an env var by misconfiguration (e.g. a
// stamped project's local `.dev.vars` accidentally pointing at production)
// would otherwise start making real charges the first time this module runs.
// This is the single choke point every outbound Stripe call passes through,
// so refusing here — before any network request is made — protects
// `createStripeCustomer`, `createCheckoutSession`, and `createPortalSession`
// alike without needing the guard duplicated at each call site.
export class LiveModeKeyError extends Error {
  constructor() {
    super('Refusing to call the Stripe API with a live-mode secret key (sk_live_...).');
    this.name = 'LiveModeKeyError';
  }
}

function assertNotLiveKey(secretKey: string): void {
  if (secretKey.startsWith('sk_live_')) {
    throw new LiveModeKeyError();
  }
}

async function stripeRequest<T>(
  secretKey: string,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  assertNotLiveKey(secretKey);

  const response = await fetch(`${STRIPE_API}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    throw new StripeApiError(response.status, `Stripe API error: ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface StripeCustomer {
  id: string;
}

export function createStripeCustomer(
  secretKey: string,
  params: { email: string; userId: string },
): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(secretKey, 'customers', {
    email: params.email,
    'metadata[userId]': params.userId,
  });
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

export function createCheckoutSession(
  secretKey: string,
  params: {
    customerId: string;
    priceId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(secretKey, 'checkout/sessions', {
    mode: 'subscription',
    customer: params.customerId,
    'line_items[0][price]': params.priceId,
    'line_items[0][quantity]': '1',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
  });
}

export interface StripePortalSession {
  url: string;
}

export function createPortalSession(
  secretKey: string,
  params: { customerId: string; returnUrl: string },
): Promise<StripePortalSession> {
  return stripeRequest<StripePortalSession>(secretKey, 'billing_portal/sessions', {
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}
