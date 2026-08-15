import { act, renderHook, waitFor } from '@testing-library/react';
import { useUser } from './useUser';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('useUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts loading, then resolves to authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ user: { id: '1', email: 'a@b.com' } })),
    );

    const { result } = renderHook(() => useUser());

    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('authenticated'));
    expect(result.current.state).toMatchObject({
      status: 'authenticated',
      user: { email: 'a@b.com' },
    });
  });

  it('resolves to unauthenticated on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401)));

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'));
  });

  it('resolves to error on an unexpected failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({ status: 'error', error: 'network down' });
  });

  it('refresh() re-fetches the current user', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: { id: '1', email: 'a@b.com' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.state.status).toBe('authenticated'));
  });
});
