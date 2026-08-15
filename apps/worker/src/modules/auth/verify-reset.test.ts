import { describe, expect, it } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../index';

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

function extractCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('expected a Set-Cookie header');
  return setCookie.split(';')[0] ?? '';
}

async function signUp(email: string, password = 'goodpass1') {
  const res = await run(jsonRequest('/api/auth/signup', { email, password }));
  const cookie = extractCookie(res);
  return { cookie };
}

async function latestDevEmail() {
  const row = await env.DB.prepare(
    'SELECT * FROM dev_emails ORDER BY created_at DESC LIMIT 1',
  ).first<{
    to: string;
    subject: string;
    text: string;
  }>();
  if (!row) throw new Error('expected a dev email to have been written');
  return row;
}

function extractToken(text: string, marker: string): string {
  const match = new RegExp(`${marker}/([\\w-]+)`).exec(text);
  if (!match?.[1]) throw new Error(`could not find a token after "${marker}" in: ${text}`);
  return match[1];
}

describe('email verification', () => {
  it('request -> read token from dev mailbox -> consume -> verified', async () => {
    const { cookie } = await signUp('verifyme@example.com');

    const requestRes = await run(
      new Request('http://localhost/api/auth/verify/request', {
        method: 'POST',
        headers: { cookie },
      }),
    );
    expect(requestRes.status).toBe(200);

    const email = await latestDevEmail();
    expect(email.to).toBe('verifyme@example.com');
    const token = extractToken(email.text, '/api/auth/verify');

    const consumeRes = await run(
      new Request(`http://localhost/api/auth/verify/${token}`, { redirect: 'manual' }),
    );
    expect(consumeRes.status).toBe(302);

    const meRes = await run(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
    const meBody = (await meRes.json()) as { user: { emailVerified: boolean } };
    expect(meBody.user.emailVerified).toBe(true);
  });

  it('a verification token is single-use', async () => {
    const { cookie } = await signUp('verifyonce@example.com');
    await run(
      new Request('http://localhost/api/auth/verify/request', {
        method: 'POST',
        headers: { cookie },
      }),
    );
    const email = await latestDevEmail();
    const token = extractToken(email.text, '/api/auth/verify');

    const first = await run(
      new Request(`http://localhost/api/auth/verify/${token}`, { redirect: 'manual' }),
    );
    const second = await run(
      new Request(`http://localhost/api/auth/verify/${token}`, { redirect: 'manual' }),
    );

    expect(first.status).toBe(302);
    expect(second.status).toBe(400);
  });

  it('rejects an unknown verification token', async () => {
    const res = await run(
      new Request('http://localhost/api/auth/verify/not-a-real-token', { redirect: 'manual' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('password reset', () => {
  it('request -> read token from dev mailbox -> consume -> new password works', async () => {
    await signUp('resetme@example.com', 'originalpass1');

    const requestRes = await run(
      jsonRequest('/api/auth/reset/request', { email: 'resetme@example.com' }),
    );
    expect(requestRes.status).toBe(200);

    const email = await latestDevEmail();
    expect(email.to).toBe('resetme@example.com');
    const token = extractToken(email.text, '/reset-password');

    const consumeRes = await run(
      jsonRequest(`/api/auth/reset/${token}`, { password: 'brandnewpass1' }),
    );
    expect(consumeRes.status).toBe(200);

    // Distinct IP so these login attempts don't share a rate-limit bucket
    // with routes.test.ts's dedicated rate-limiting test (both would
    // otherwise key on the same default 'unknown' IP).
    const loginHeaders = { headers: { 'CF-Connecting-IP': '10.0.0.50' } };

    const loginOldRes = await run(
      jsonRequest(
        '/api/auth/login',
        { email: 'resetme@example.com', password: 'originalpass1' },
        loginHeaders,
      ),
    );
    expect(loginOldRes.status).toBe(401);

    const loginNewRes = await run(
      jsonRequest(
        '/api/auth/login',
        { email: 'resetme@example.com', password: 'brandnewpass1' },
        loginHeaders,
      ),
    );
    expect(loginNewRes.status).toBe(200);
  });

  it('invalidates existing sessions when the password is reset', async () => {
    const { cookie } = await signUp('resetsessions@example.com', 'originalpass1');

    await run(jsonRequest('/api/auth/reset/request', { email: 'resetsessions@example.com' }));
    const email = await latestDevEmail();
    const token = extractToken(email.text, '/reset-password');
    await run(jsonRequest(`/api/auth/reset/${token}`, { password: 'brandnewpass1' }));

    const meRes = await run(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
    expect(meRes.status).toBe(401);
  });

  it('a reset token is single-use', async () => {
    await signUp('resetonce@example.com');
    await run(jsonRequest('/api/auth/reset/request', { email: 'resetonce@example.com' }));
    const email = await latestDevEmail();
    const token = extractToken(email.text, '/reset-password');

    const first = await run(jsonRequest(`/api/auth/reset/${token}`, { password: 'firstnewpass1' }));
    const second = await run(
      jsonRequest(`/api/auth/reset/${token}`, { password: 'secondnewpass1' }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
  });

  it('does not enumerate accounts: same response for known and unknown emails', async () => {
    await signUp('known@example.com');

    const knownRes = await run(
      jsonRequest('/api/auth/reset/request', { email: 'known@example.com' }),
    );
    const unknownRes = await run(
      jsonRequest('/api/auth/reset/request', { email: 'nobody-here@example.com' }),
    );

    expect(knownRes.status).toBe(unknownRes.status);
    expect(await knownRes.clone().json()).toEqual(await unknownRes.clone().json());
  });
});

describe('/api/dev/mailbox', () => {
  it('lists sent dev emails when RESEND_API_KEY is unset', async () => {
    await signUp('mailboxlist@example.com');
    await run(jsonRequest('/api/auth/reset/request', { email: 'mailboxlist@example.com' }));

    const res = await run(new Request('http://localhost/api/dev/mailbox'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { emails: Array<{ to: string }> };
    expect(body.emails.some((e) => e.to === 'mailboxlist@example.com')).toBe(true);
  });

  it('self-404s once RESEND_API_KEY is configured (prod-like env)', async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request('http://localhost/api/dev/mailbox'),
      { ...env, RESEND_API_KEY: 'prod-key' },
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });
});
