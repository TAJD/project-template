import { fetchSubscription, openBillingPortal, startCheckout } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('billing api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchSubscription GETs /api/billing/subscription', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ subscription: null }));
    vi.stubGlobal('fetch', fetchMock);

    const { subscription } = await fetchSubscription();

    expect(subscription).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/billing/subscription',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('startCheckout POSTs /api/billing/checkout and returns the redirect url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ url: 'https://checkout.stripe.com/x' })),
    );

    const { url } = await startCheckout();

    expect(url).toBe('https://checkout.stripe.com/x');
  });

  it('openBillingPortal POSTs /api/billing/portal and returns the redirect url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ url: 'https://billing.stripe.com/x' })),
    );

    const { url } = await openBillingPortal();

    expect(url).toBe('https://billing.stripe.com/x');
  });

  it('throws AuthApiError with the server message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'No billing account yet' }, 400)),
    );

    await expect(openBillingPortal()).rejects.toMatchObject({
      name: 'AuthApiError',
      status: 400,
      message: 'No billing account yet',
    });
  });
});
