import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../../env';
import { createDb } from '../../db';
import { users } from '../../db/schema';
import { badRequest, serverError, tooManyRequests, unauthorized } from '../../lib/errors';
import { createEmailSender } from '../../lib/email';
import { hashPassword, verifyPassword } from './password';
import { SESSION_COOKIE, deleteOtherSessionsForUser } from './session';
import { requireUser, type AuthVariables } from './middleware';
import { createAuthToken } from './tokens';
import { deleteAccount } from './delete-account';
import { EMAIL_RE, MIN_PASSWORD_LENGTH, checkRateLimit, serializeUser } from './routes';

export const account = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Every route below mutates a sensitive account property, so on top of the
// session cookie `requireUser` already checks, each one re-asks for the
// current password. A stolen session cookie alone is not enough to take the
// account over — the same principle PT-12's password reset applies to
// existing sessions applies here to a *live* one.

account.patch('/email', requireUser, async (c) => {
  if (!(await checkRateLimit(c, 'account-email'))) return tooManyRequests().error;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const { email, password } = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return badRequest('email and password are required').error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) return badRequest('Invalid email address').error;

  const user = c.get('user');
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return unauthorized().error;

  if (normalizedEmail === user.email) {
    return c.json({ user: serializeUser(user) });
  }

  const db = createDb(c.env.DB);
  const existing = await db.query.users.findFirst({
    where: (u, { eq: eqOp }) => eqOp(u.email, normalizedEmail),
  });
  if (existing) return badRequest('An account with that email already exists').error;

  try {
    // Changing the address always forces re-verification — the new address
    // hasn't proven it's reachable by this user yet, so the account can't
    // stay marked verified against it.
    await db
      .update(users)
      .set({ email: normalizedEmail, emailVerifiedAt: null })
      .where(eq(users.id, user.id));

    const { token } = await createAuthToken(db, user.id, 'verify');
    const verifyUrl = new URL(`/api/auth/verify/${token}`, c.req.url).toString();
    await createEmailSender(c.env, db).send({
      to: normalizedEmail,
      subject: 'Verify your new email address',
      text: `Verify your new email address: ${verifyUrl}`,
      html: `<p>Verify your new email address: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    return c.json({ user: { id: user.id, email: normalizedEmail, emailVerified: false } });
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

account.patch('/password', requireUser, async (c) => {
  if (!(await checkRateLimit(c, 'account-password'))) return tooManyRequests().error;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const { currentPassword, newPassword } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Record<string, unknown>;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return badRequest('currentPassword and newPassword are required').error;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`).error;
  }

  const user = c.get('user');
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return unauthorized().error;

  const db = createDb(c.env.DB);
  try {
    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    // Invalidate every other session — a stolen cookie used elsewhere loses
    // access the moment the real owner changes their password — but leave
    // this request's own session alone so the user isn't logged out by the
    // act of securing their account.
    const currentToken = getCookie(c, SESSION_COOKIE);
    await deleteOtherSessionsForUser(db, user.id, currentToken);

    return c.json({ ok: true });
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

account.delete('/', requireUser, async (c) => {
  if (!(await checkRateLimit(c, 'account-delete'))) return tooManyRequests().error;

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
  if (typeof password !== 'string') return badRequest('password is required').error;

  const user = c.get('user');
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return unauthorized().error;

  const db = createDb(c.env.DB);
  try {
    await deleteAccount(db, user.id);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.body(null, 204);
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});
