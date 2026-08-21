import { describe, expect, it } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../index';

function extractCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('expected a Set-Cookie header');
  return setCookie.split(';')[0] ?? '';
}

async function run(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function jsonRequest(path: string, body: unknown, init?: RequestInit) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...init?.headers },
    body: JSON.stringify(body),
    ...init,
  });
}

describe('auth routes', () => {
  it('signup -> login -> me -> logout happy path', async () => {
    const signupRes = await run(
      jsonRequest('/api/auth/signup', { email: 'happy@example.com', password: 'hunter2pass' }),
    );
    expect(signupRes.status).toBe(201);
    const signupBody = await signupRes.json();
    expect(signupBody).toMatchObject({ user: { email: 'happy@example.com' } });

    const loginRes = await run(
      jsonRequest('/api/auth/login', { email: 'happy@example.com', password: 'hunter2pass' }),
    );
    expect(loginRes.status).toBe(200);
    const cookie = extractCookie(loginRes);

    const meRes = await run(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody).toMatchObject({ user: { email: 'happy@example.com' } });

    const logoutRes = await run(
      new Request('http://localhost/api/auth/logout', { method: 'POST', headers: { cookie } }),
    );
    expect(logoutRes.status).toBe(204);

    const meAfterLogoutRes = await run(
      new Request('http://localhost/api/auth/me', { headers: { cookie } }),
    );
    expect(meAfterLogoutRes.status).toBe(401);
  });

  it('rejects login with the wrong password', async () => {
    await run(
      jsonRequest('/api/auth/signup', { email: 'wrongpw@example.com', password: 'correctpass' }),
    );

    const res = await run(
      jsonRequest('/api/auth/login', { email: 'wrongpw@example.com', password: 'incorrectpass' }),
    );

    expect(res.status).toBe(401);
  });

  it('rejects login for an unknown email', async () => {
    const res = await run(
      jsonRequest('/api/auth/login', { email: 'nobody@example.com', password: 'whatever1' }),
    );

    expect(res.status).toBe(401);
  });

  it('rejects a duplicate signup email', async () => {
    await run(
      jsonRequest('/api/auth/signup', { email: 'dupe@example.com', password: 'firstpass1' }),
    );
    const res = await run(
      jsonRequest('/api/auth/signup', { email: 'dupe@example.com', password: 'secondpass1' }),
    );

    expect(res.status).toBe(400);
  });

  it('rejects a signup with a too-short password', async () => {
    const res = await run(
      jsonRequest('/api/auth/signup', { email: 'short@example.com', password: 'short' }),
    );

    expect(res.status).toBe(400);
  });

  it('/me without a session cookie is unauthorized', async () => {
    const res = await run(new Request('http://localhost/api/auth/me'));
    expect(res.status).toBe(401);
  });

  it('sets the session cookie with HttpOnly, SameSite=Lax, and Path=/', async () => {
    const res = await run(
      jsonRequest('/api/auth/signup', { email: 'cookieflags@example.com', password: 'goodpass1' }),
    );

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    // localhost is exempt so `wrangler dev` over plain HTTP still works.
    expect(setCookie).not.toMatch(/Secure/i);
  });

  it('sets Secure on the session cookie for a non-local host', async () => {
    const res = await run(
      new Request('https://example.com/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.0.0.90' },
        body: JSON.stringify({ email: 'securecookie@example.com', password: 'goodpass1' }),
      }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('set-cookie') ?? '').toMatch(/Secure/i);
  });

  it('sets Secure even when a non-local host is reached over plain HTTP', async () => {
    const res = await run(
      new Request('http://example.com/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.0.0.91' },
        body: JSON.stringify({ email: 'insecurescheme@example.com', password: 'goodpass1' }),
      }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('set-cookie') ?? '').toMatch(/Secure/i);
  });

  it('rate limits repeated signup attempts', async () => {
    let sawRateLimit = false;
    for (let i = 0; i < 15; i++) {
      const res = await run(
        jsonRequest('/api/auth/signup', {
          email: `ratelimit${i}@example.com`,
          password: 'goodpass1',
        }),
      );
      if (res.status === 429) {
        sawRateLimit = true;
        break;
      }
    }

    expect(sawRateLimit).toBe(true);
  });

  it('rate limits repeated login attempts', async () => {
    await run(
      jsonRequest('/api/auth/signup', {
        email: 'ratelimitlogin@example.com',
        password: 'goodpass1',
      }),
    );

    let sawRateLimit = false;
    for (let i = 0; i < 15; i++) {
      const res = await run(
        jsonRequest('/api/auth/login', {
          email: 'ratelimitlogin@example.com',
          password: 'wrong-password',
        }),
      );
      if (res.status === 429) {
        sawRateLimit = true;
        break;
      }
    }

    expect(sawRateLimit).toBe(true);
  });
});
