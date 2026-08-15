import { describe, expect, it } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../index';
import { createTestLoginToken } from './test-auth';

async function run(request: Request, overrideEnv: typeof env = env) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, overrideEnv, ctx);
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

describe('tier 1: /api/test-auth/login', () => {
  it('logs in as a fresh test user, creating it on the fly', async () => {
    const res = await run(
      jsonRequest('/api/test-auth/login', {
        email: 'tier1@example.com',
        token: env.TEST_AUTH_TOKEN,
      }),
    );

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/^session=/);
    const body = (await res.json()) as { user: { email: string; emailVerified: boolean } };
    expect(body.user.email).toBe('tier1@example.com');
    expect(body.user.emailVerified).toBe(true);
  });

  it('logs in as an existing test user without touching their password', async () => {
    await run(
      jsonRequest('/api/test-auth/login', {
        email: 'tier1existing@example.com',
        token: env.TEST_AUTH_TOKEN,
      }),
    );

    const second = await run(
      jsonRequest('/api/test-auth/login', {
        email: 'tier1existing@example.com',
        token: env.TEST_AUTH_TOKEN,
      }),
    );

    expect(second.status).toBe(200);

    const rows = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind('tier1existing@example.com')
      .all();
    expect(rows.results).toHaveLength(1);
  });

  it('respects an explicit emailVerified: false', async () => {
    const res = await run(
      jsonRequest('/api/test-auth/login', {
        email: 'tier1unverified@example.com',
        token: env.TEST_AUTH_TOKEN,
        emailVerified: false,
      }),
    );

    const body = (await res.json()) as { user: { emailVerified: boolean } };
    expect(body.user.emailVerified).toBe(false);
  });

  it('rejects a wrong token', async () => {
    const res = await run(
      jsonRequest('/api/test-auth/login', {
        email: 'tier1badtoken@example.com',
        token: 'not-the-real-token',
      }),
    );

    expect(res.status).toBe(401);
  });

  it('404s once TEST_AUTH_TOKEN is unset', async () => {
    const res = await run(
      jsonRequest('/api/test-auth/login', {
        email: 'tier1notoken@example.com',
        token: env.TEST_AUTH_TOKEN,
      }),
      { ...env, TEST_AUTH_TOKEN: undefined },
    );

    expect(res.status).toBe(404);
  });

  it('404s on a non-local host even with a correct token (prod-mode)', async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request('https://example.com/api/test-auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'tier1prod@example.com', token: env.TEST_AUTH_TOKEN }),
      }),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });
});

describe('tier 2: /api/test-auth/prod-login', () => {
  const SECRET = 'top-secret-value';

  async function signUpViaTier1(email: string) {
    await run(jsonRequest('/api/test-auth/login', { email, token: env.TEST_AUTH_TOKEN }));
  }

  it('404s when TEST_LOGIN_SECRET is unset (the default)', async () => {
    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2nosecret@example.com',
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        host: 'localhost',
        signature: 'irrelevant',
      }),
    );

    expect(res.status).toBe(404);
  });

  it('logs in an existing user with a validly signed, unexpired token', async () => {
    await signUpViaTier1('tier2valid@example.com');
    const testEnv = { ...env, TEST_LOGIN_SECRET: SECRET };
    const { expiresAt, signature } = await createTestLoginToken(
      SECRET,
      'tier2valid@example.com',
      'localhost',
    );

    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2valid@example.com',
        expiresAt,
        host: 'localhost',
        signature,
      }),
      testEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe('tier2valid@example.com');
  });

  it('rejects a user that does not already exist', async () => {
    const testEnv = { ...env, TEST_LOGIN_SECRET: SECRET };
    const { expiresAt, signature } = await createTestLoginToken(
      SECRET,
      'tier2ghost@example.com',
      'localhost',
    );

    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2ghost@example.com',
        expiresAt,
        host: 'localhost',
        signature,
      }),
      testEnv,
    );

    expect(res.status).toBe(401);
  });

  it('rejects a tampered signature', async () => {
    await signUpViaTier1('tier2tampered@example.com');
    const testEnv = { ...env, TEST_LOGIN_SECRET: SECRET };
    const { expiresAt } = await createTestLoginToken(
      SECRET,
      'tier2tampered@example.com',
      'localhost',
    );

    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2tampered@example.com',
        expiresAt,
        host: 'localhost',
        signature: '0'.repeat(64),
      }),
      testEnv,
    );

    expect(res.status).toBe(401);
  });

  it('rejects a signature minted with the wrong secret', async () => {
    await signUpViaTier1('tier2wrongsecret@example.com');
    const testEnv = { ...env, TEST_LOGIN_SECRET: SECRET };
    const { expiresAt, signature } = await createTestLoginToken(
      'a-different-secret',
      'tier2wrongsecret@example.com',
      'localhost',
    );

    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2wrongsecret@example.com',
        expiresAt,
        host: 'localhost',
        signature,
      }),
      testEnv,
    );

    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    await signUpViaTier1('tier2expired@example.com');
    const testEnv = { ...env, TEST_LOGIN_SECRET: SECRET };
    const { signature } = await createTestLoginToken(
      SECRET,
      'tier2expired@example.com',
      'localhost',
    );
    const pastExpiry = Math.floor(Date.now() / 1000) - 10;

    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2expired@example.com',
        expiresAt: pastExpiry,
        host: 'localhost',
        signature,
      }),
      testEnv,
    );

    expect(res.status).toBe(401);
  });

  it('rejects a token minted for a different host (domain scoping)', async () => {
    await signUpViaTier1('tier2wronghost@example.com');
    const testEnv = { ...env, TEST_LOGIN_SECRET: SECRET };
    const { expiresAt, signature } = await createTestLoginToken(
      SECRET,
      'tier2wronghost@example.com',
      'other-domain.example.com',
    );

    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2wronghost@example.com',
        expiresAt,
        host: 'other-domain.example.com',
        signature,
      }),
      testEnv,
    );

    // The signature is valid for other-domain.example.com, but the request
    // itself arrives on "localhost" (the Host header jsonRequest sends) —
    // the mismatch is what must be rejected here.
    expect(res.status).toBe(401);
  });

  it('rejects a request for an absurdly long-lived expiry beyond the max TTL', async () => {
    await signUpViaTier1('tier2longttl@example.com');
    const testEnv = { ...env, TEST_LOGIN_SECRET: SECRET };
    const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

    const res = await run(
      jsonRequest('/api/test-auth/prod-login', {
        email: 'tier2longttl@example.com',
        expiresAt: farFuture,
        host: 'localhost',
        signature: '0'.repeat(64),
      }),
      testEnv,
    );

    expect(res.status).toBe(401);
  });
});
