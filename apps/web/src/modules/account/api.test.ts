import { AuthApiError, fetchMe, signIn, signOut, signUp } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('account api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signUp posts credentials and returns the user', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ user: { id: '1', email: 'a@b.com' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const { user } = await signUp('a@b.com', 'password1');

    expect(user).toEqual({ id: '1', email: 'a@b.com' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'a@b.com', password: 'password1' }),
      }),
    );
  });

  it('signIn returns the user on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ user: { id: '1', email: 'a@b.com' } })),
    );

    const { user } = await signIn('a@b.com', 'password1');

    expect(user.email).toBe('a@b.com');
  });

  it('throws AuthApiError with the server message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401)));

    await expect(signIn('a@b.com', 'wrong')).rejects.toMatchObject({
      name: 'AuthApiError',
      status: 401,
      message: 'Unauthorized',
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));

    await expect(signIn('a@b.com', 'wrong')).rejects.toBeInstanceOf(AuthApiError);
  });

  it('signOut resolves without a body on 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(signOut()).resolves.toBeUndefined();
  });

  it('fetchMe returns the current user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ user: { id: '2', email: 'me@example.com' } })),
    );

    const { user } = await fetchMe();

    expect(user.id).toBe('2');
  });
});
