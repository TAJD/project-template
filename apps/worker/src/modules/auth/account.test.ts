import { describe, expect, it } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../index';

async function run(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function jsonRequest(method: string, path: string, body: unknown, init?: RequestInit) {
  return new Request(`http://localhost${path}`, {
    method,
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

async function latestDevEmail() {
  const row = await env.DB.prepare(
    'SELECT * FROM dev_emails ORDER BY created_at DESC LIMIT 1',
  ).first<{ to: string; subject: string; text: string }>();
  if (!row) throw new Error('expected a dev email to have been written');
  return row;
}

// Each call needs its own IP: the signup rate limiter keys on
// CF-Connecting-IP (default 'unknown'), and this file signs up more users
// than the limiter's window allows on a single shared IP.
let nextIp = 1;
async function signUp(email: string, password = 'goodpass1') {
  const res = await run(
    jsonRequest(
      'POST',
      '/api/auth/signup',
      { email, password },
      { headers: { 'CF-Connecting-IP': `10.1.0.${nextIp++}` } },
    ),
  );
  const cookie = extractCookie(res);
  return { cookie };
}

describe('PATCH /api/account/email', () => {
  it('rejects without a session', async () => {
    const res = await run(
      jsonRequest('PATCH', '/api/account/email', {
        email: 'new@example.com',
        password: 'goodpass1',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects the wrong current password', async () => {
    const { cookie } = await signUp('emailwrongpw@example.com', 'goodpass1');

    const res = await run(
      jsonRequest(
        'PATCH',
        '/api/account/email',
        { email: 'new@example.com', password: 'wrong-password' },
        { headers: { cookie } },
      ),
    );

    expect(res.status).toBe(401);
  });

  it('changes the email and forces re-verification', async () => {
    const { cookie } = await signUp('emailchange@example.com', 'goodpass1');

    // Verify the original address first, to prove the change actually
    // clears verification rather than it just staying unset by default.
    await run(
      new Request('http://localhost/api/auth/verify/request', {
        method: 'POST',
        headers: { cookie },
      }),
    );
    const verifyEmail = await latestDevEmail();
    const verifyToken = /verify\/([\w-]+)/.exec(verifyEmail.text)?.[1];
    if (!verifyToken) throw new Error('expected a verify token');
    await run(
      new Request(`http://localhost/api/auth/verify/${verifyToken}`, { redirect: 'manual' }),
    );

    const meBefore = await run(
      new Request('http://localhost/api/auth/me', { headers: { cookie } }),
    );
    expect(
      ((await meBefore.json()) as { user: { emailVerified: boolean } }).user.emailVerified,
    ).toBe(true);

    const res = await run(
      jsonRequest(
        'PATCH',
        '/api/account/email',
        { email: 'newaddress@example.com', password: 'goodpass1' },
        { headers: { cookie } },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string; emailVerified: boolean } };
    expect(body.user.email).toBe('newaddress@example.com');
    expect(body.user.emailVerified).toBe(false);

    const meAfter = await run(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
    const meAfterBody = (await meAfter.json()) as {
      user: { email: string; emailVerified: boolean };
    };
    expect(meAfterBody.user.email).toBe('newaddress@example.com');
    expect(meAfterBody.user.emailVerified).toBe(false);
  });

  it('sends a new verification email to the new address', async () => {
    const { cookie } = await signUp('emailnotify@example.com', 'goodpass1');

    await run(
      jsonRequest(
        'PATCH',
        '/api/account/email',
        { email: 'notifyme@example.com', password: 'goodpass1' },
        { headers: { cookie } },
      ),
    );

    const email = await latestDevEmail();
    expect(email.to).toBe('notifyme@example.com');
  });

  it('rejects a change to an email already in use', async () => {
    await signUp('emailtaken@example.com', 'goodpass1');
    const { cookie } = await signUp('emailchanger@example.com', 'goodpass1');

    const res = await run(
      jsonRequest(
        'PATCH',
        '/api/account/email',
        { email: 'emailtaken@example.com', password: 'goodpass1' },
        { headers: { cookie } },
      ),
    );

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/account/password', () => {
  it('rejects without a session', async () => {
    const res = await run(
      jsonRequest('PATCH', '/api/account/password', {
        currentPassword: 'goodpass1',
        newPassword: 'brandnewpass1',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects the wrong current password', async () => {
    const { cookie } = await signUp('pwwrongcurrent@example.com', 'goodpass1');

    const res = await run(
      jsonRequest(
        'PATCH',
        '/api/account/password',
        { currentPassword: 'wrong-password', newPassword: 'brandnewpass1' },
        { headers: { cookie } },
      ),
    );

    expect(res.status).toBe(401);
  });

  it('rejects a too-short new password', async () => {
    const { cookie } = await signUp('pwtooshort@example.com', 'goodpass1');

    const res = await run(
      jsonRequest(
        'PATCH',
        '/api/account/password',
        { currentPassword: 'goodpass1', newPassword: 'short' },
        { headers: { cookie } },
      ),
    );

    expect(res.status).toBe(400);
  });

  it('changes the password and keeps the current session alive', async () => {
    const { cookie } = await signUp('pwchange@example.com', 'goodpass1');

    const res = await run(
      jsonRequest(
        'PATCH',
        '/api/account/password',
        { currentPassword: 'goodpass1', newPassword: 'brandnewpass1' },
        { headers: { cookie } },
      ),
    );
    expect(res.status).toBe(200);

    const meRes = await run(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
    expect(meRes.status).toBe(200);

    const loginRes = await run(
      jsonRequest(
        'POST',
        '/api/auth/login',
        { email: 'pwchange@example.com', password: 'brandnewpass1' },
        { headers: { 'CF-Connecting-IP': '10.0.0.60' } },
      ),
    );
    expect(loginRes.status).toBe(200);
  });

  it('invalidates every other session', async () => {
    const { cookie: cookieA } = await signUp('pwothersessions@example.com', 'goodpass1');
    const loginB = await run(
      jsonRequest(
        'POST',
        '/api/auth/login',
        { email: 'pwothersessions@example.com', password: 'goodpass1' },
        { headers: { 'CF-Connecting-IP': '10.0.0.61' } },
      ),
    );
    const cookieB = extractCookie(loginB);

    await run(
      jsonRequest(
        'PATCH',
        '/api/account/password',
        { currentPassword: 'goodpass1', newPassword: 'brandnewpass1' },
        { headers: { cookie: cookieA } },
      ),
    );

    const meA = await run(
      new Request('http://localhost/api/auth/me', { headers: { cookie: cookieA } }),
    );
    const meB = await run(
      new Request('http://localhost/api/auth/me', { headers: { cookie: cookieB } }),
    );

    expect(meA.status).toBe(200);
    expect(meB.status).toBe(401);
  });
});

describe('DELETE /api/account', () => {
  it('rejects without a session', async () => {
    const res = await run(jsonRequest('DELETE', '/api/account', { password: 'goodpass1' }));
    expect(res.status).toBe(401);
  });

  it('rejects the wrong password', async () => {
    const { cookie } = await signUp('deletewrongpw@example.com', 'goodpass1');

    const res = await run(
      jsonRequest(
        'DELETE',
        '/api/account',
        { password: 'wrong-password' },
        { headers: { cookie } },
      ),
    );

    expect(res.status).toBe(401);
  });

  it('deletes the user, their sessions, and their auth tokens', async () => {
    const { cookie } = await signUp('deleteme@example.com', 'goodpass1');
    await run(
      new Request('http://localhost/api/auth/verify/request', {
        method: 'POST',
        headers: { cookie },
      }),
    );

    const userRow = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind('deleteme@example.com')
      .first<{ id: string }>();
    if (!userRow) throw new Error('expected the user to exist');

    const res = await run(
      jsonRequest('DELETE', '/api/account', { password: 'goodpass1' }, { headers: { cookie } }),
    );
    expect(res.status).toBe(204);

    const userAfter = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(userRow.id)
      .first();
    expect(userAfter).toBeNull();

    const sessionsAfter = await env.DB.prepare('SELECT id FROM sessions WHERE user_id = ?')
      .bind(userRow.id)
      .all();
    expect(sessionsAfter.results).toHaveLength(0);

    const tokensAfter = await env.DB.prepare('SELECT token_hash FROM auth_tokens WHERE user_id = ?')
      .bind(userRow.id)
      .all();
    expect(tokensAfter.results).toHaveLength(0);

    const meRes = await run(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
    expect(meRes.status).toBe(401);
  });
});
