import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../../env';
import { createDb } from '../../db';
import { users } from '../../db/schema';
import { badRequest, serverError, tooManyRequests, unauthorized } from '../../lib/errors';
import { hashPassword, verifyPassword } from './password';
import { SESSION_COOKIE, deleteSession, rotateSession } from './session';
import { requireUser, type AuthVariables } from './middleware';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

interface Credentials {
  email: string;
  password: string;
}

function parseCredentials(body: unknown): Credentials | null {
  if (typeof body !== 'object' || body === null) return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  return { email: email.trim().toLowerCase(), password };
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// The Secure cookie flag is only honoured by browsers over HTTPS, and local
// `wrangler dev` serves plain HTTP — a hard-coded `secure: true` would
// silently break the signup/login flow for every local run. Keying off the
// hostname rather than the request protocol means Secure is set on every
// non-local host unconditionally: a deployment reached over plain HTTP (a
// zone without "Always Use HTTPS") would otherwise hand out a session cookie
// the browser is then willing to replay in cleartext.
export function isLocalRequest(url: string): boolean {
  return LOCAL_HOSTNAMES.has(new URL(url).hostname);
}

function sessionCookieOptions(c: Context, expires: Date) {
  return {
    httpOnly: true,
    secure: !isLocalRequest(c.req.url),
    sameSite: 'Lax' as const,
    path: '/',
    expires,
  };
}

async function checkRateLimit(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  bucket: string,
) {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const { success } = await c.env.AUTH_RATE_LIMITER.limit({ key: `${bucket}:${ip}` });
  return success;
}

auth.post('/signup', async (c) => {
  if (!(await checkRateLimit(c, 'signup'))) return tooManyRequests().error;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const credentials = parseCredentials(body);
  if (!credentials) return badRequest('email and password are required').error;
  if (!EMAIL_RE.test(credentials.email)) return badRequest('Invalid email address').error;
  if (credentials.password.length < MIN_PASSWORD_LENGTH) {
    return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`).error;
  }

  const db = createDb(c.env.DB);

  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, credentials.email),
  });
  if (existing) return badRequest('An account with that email already exists').error;

  try {
    const passwordHash = await hashPassword(credentials.password);
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email: credentials.email,
      passwordHash,
      createdAt: new Date(),
    });

    const { token, expiresAt } = await rotateSession(db, undefined, id);
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c, expiresAt));

    return c.json({ user: { id, email: credentials.email } }, 201);
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

auth.post('/login', async (c) => {
  if (!(await checkRateLimit(c, 'login'))) return tooManyRequests().error;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const credentials = parseCredentials(body);
  if (!credentials) return badRequest('email and password are required').error;

  const db = createDb(c.env.DB);

  try {
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, credentials.email),
    });

    // Same generic message whether the email is unknown or the password is
    // wrong, and both paths run a password verification, so response
    // timing doesn't leak which case it was.
    const passwordHash = user?.passwordHash ?? (await hashPassword(crypto.randomUUID()));
    const valid = await verifyPassword(credentials.password, passwordHash);
    if (!user || !valid) return unauthorized().error;

    const oldToken = getCookie(c, SESSION_COOKIE);
    const { token, expiresAt } = await rotateSession(db, oldToken, user.id);
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c, expiresAt));

    return c.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const db = createDb(c.env.DB);
    await deleteSession(db, token);
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.body(null, 204);
});

auth.get('/me', requireUser, (c) => {
  const user = c.get('user');
  return c.json({ user: { id: user.id, email: user.email } });
});
