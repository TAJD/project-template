import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../../env';
import { createDb } from '../../db';
import { users, type User } from '../../db/schema';
import { badRequest, serverError, tooManyRequests, unauthorized } from '../../lib/errors';
import { createEmailSender } from '../../lib/email';
import { hashPassword, verifyPassword } from './password';
import { SESSION_COOKIE, deleteSession, deleteSessionsForUser, rotateSession } from './session';
import { requireUser, type AuthVariables } from './middleware';
import { createAuthToken, consumeAuthToken } from './tokens';

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

// The Secure cookie flag is only honoured by browsers over HTTPS. Real
// deployments (workers.dev / a custom domain) are always HTTPS, but local
// `wrangler dev` serves plain HTTP by default — a hard-coded `secure: true`
// would silently break the signup/login flow for every local run. Deriving
// it from the request's own protocol keeps the flag on wherever it can
// matter without breaking the "runnable locally" requirement.
function sessionCookieOptions(c: Context, expires: Date) {
  return {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax' as const,
    path: '/',
    expires,
  };
}

function serializeUser(user: User) {
  return { id: user.id, email: user.email, emailVerified: Boolean(user.emailVerifiedAt) };
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

    return c.json({ user: { id, email: credentials.email, emailVerified: false } }, 201);
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

    return c.json({ user: serializeUser(user) });
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
  return c.json({ user: serializeUser(user) });
});

auth.post('/verify/request', requireUser, async (c) => {
  const user = c.get('user');
  if (user.emailVerifiedAt) return c.json({ ok: true });

  const db = createDb(c.env.DB);
  try {
    const { token } = await createAuthToken(db, user.id, 'verify');
    const verifyUrl = new URL(`/api/auth/verify/${token}`, c.req.url).toString();
    await createEmailSender(c.env, db).send({
      to: user.email,
      subject: 'Verify your email address',
      text: `Verify your email address: ${verifyUrl}`,
      html: `<p>Verify your email address: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    return c.json({ ok: true });
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

auth.get('/verify/:token', async (c) => {
  const token = c.req.param('token');
  const db = createDb(c.env.DB);

  const user = await consumeAuthToken(db, token, 'verify');
  if (!user) return badRequest('Invalid or expired verification link').error;

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));

  return c.redirect('/?verified=1');
});

auth.post('/reset/request', async (c) => {
  if (!(await checkRateLimit(c, 'reset'))) return tooManyRequests().error;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const { email } = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  if (typeof email !== 'string') return badRequest('email is required').error;

  const normalizedEmail = email.trim().toLowerCase();
  const db = createDb(c.env.DB);

  try {
    const user = await db.query.users.findFirst({
      where: (u, { eq: eqOp }) => eqOp(u.email, normalizedEmail),
    });

    if (user) {
      const { token } = await createAuthToken(db, user.id, 'reset');
      const resetUrl = new URL(`/reset-password/${token}`, c.req.url).toString();
      await createEmailSender(c.env, db).send({
        to: user.email,
        subject: 'Reset your password',
        text: `Reset your password: ${resetUrl}`,
        html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    }

    // Same response whether or not the account exists, so this endpoint
    // can't be used to enumerate registered emails.
    return c.json({ ok: true });
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

auth.post('/reset/:token', async (c) => {
  const token = c.req.param('token');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const { password } = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`).error;
  }

  const db = createDb(c.env.DB);

  try {
    const user = await consumeAuthToken(db, token, 'reset');
    if (!user) return badRequest('Invalid or expired reset link').error;

    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await deleteSessionsForUser(db, user.id);

    return c.json({ ok: true });
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});
