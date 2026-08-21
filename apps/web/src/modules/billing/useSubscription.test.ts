import { renderHook, waitFor } from '@testing-library/react';
import { useSubscription } from './useSubscription';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('useSubscription', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts loading, then resolves to ready with no subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ subscription: null })));

    const { result } = renderHook(() => useSubscription());

    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toMatchObject({ status: 'ready', subscription: null });
  });

  it('resolves to ready with the active subscription', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          subscription: {
            status: 'active',
            priceId: 'price_1',
            currentPeriodEnd: '2030-01-01T00:00:00Z',
          },
        }),
      ),
    );

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toMatchObject({
      status: 'ready',
      subscription: { status: 'active' },
    });
  });

  it('resolves to unauthenticated on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401)));

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'));
  });

  it('resolves to error on an unexpected failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({ status: 'error', error: 'network down' });
  });
});
