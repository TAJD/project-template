import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  LiveModeKeyError,
} from '../../apps/worker/src/modules/billing/stripe-client';

// This template has no real Stripe account and every other test in this
// suite mocks `fetch` rather than hitting Stripe's live API (see
// docs/modules/billing.md "Known gaps"). That means nothing here has ever
// exercised a real live-mode secret key — so instead of skipping this
// concern, this test asserts a static safety net: the Stripe client
// construction (`stripeRequest`, the single choke point every exported
// function in stripe-client.ts calls through) refuses to proceed at all if
// it's ever handed a key matching Stripe's live-mode prefix (`sk_live_`),
// *before* making any network request. This is testable with a fake key
// string and catches a future misconfiguration (e.g. a stamped project's
// `.dev.vars` accidentally pointing at a production secret) without needing
// real Stripe credentials.
const LIVE_KEY = 'sk_live_this_is_not_a_real_key_but_matches_the_live_prefix';

describe('safety guard: Stripe client refuses live-mode keys', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects createStripeCustomer with a live-mode key before calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createStripeCustomer(LIVE_KEY, { email: 'a@example.com', userId: 'u1' }),
    ).rejects.toThrow(LiveModeKeyError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects createCheckoutSession with a live-mode key before calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createCheckoutSession(LIVE_KEY, {
        customerId: 'cus_1',
        priceId: 'price_1',
        userId: 'u1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toThrow(LiveModeKeyError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects createPortalSession with a live-mode key before calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createPortalSession(LIVE_KEY, { customerId: 'cus_1', returnUrl: 'https://example.com' }),
    ).rejects.toThrow(LiveModeKeyError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still allows a test-mode key through to the (mocked) fetch call', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(Response.json({ id: 'cus_test_1' })));
    vi.stubGlobal('fetch', fetchMock);

    await createStripeCustomer('sk_test_123', { email: 'a@example.com', userId: 'u1' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
