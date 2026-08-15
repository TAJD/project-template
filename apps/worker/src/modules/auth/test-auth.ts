import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { Env } from '../../env';
import { createDb } from '../../db';
import { users } from '../../db/schema';
import { badRequest, notFound, unauthorized } from '../../lib/errors';
import { isLocalRequest } from '../../lib/request';
import { hashPassword } from './password';
import { SESSION_COOKIE, rotateSession } from './session';
import { serializeUser } from './routes';

export const testAuth = new Hono<{ Bindings: Env }>();

// Both tiers exist so that "log in as a test user" never has to go through
// the real signup/password flow in a test suite, without that shortcut ever
// being reachable somewhere a real attacker could use it as a backdoor:
//
// - Tier 1 (`TEST_AUTH_TOKEN`) is for local dev and CI only. It self-404s the
//   same way PT-12's `/api/dev/mailbox` does — on hostname, independent of
//   whether the token itself is configured — so spoofing a header can never
//   make it live in a real deployment.
// - Tier 2 (`TEST_LOGIN_SECRET`) is meant to run against a real prod
//   deployment for smoke tests, so it can't rely on "unreachable in prod" as
//   its safety net. Instead: it's off unless a deployment deliberately
//   provisions the secret, every request must present a caller-minted
//   signature over (email, expiry, host) rather than the secret itself, that
//   signature is only valid for a few minutes, it's scoped to the exact host
//   it was signed for, and it can only sign in as a user that already
//   exists — it can't be used to create or take over an arbitrary account.
//   See docs/modules/account.md for the full threat model.

function sessionCookieOptions(c: Context, expires: Date) {
  return {
    httpOnly: true,
    secure: !isLocalRequest(c.req.url),
    sameSite: 'Lax' as const,
    path: '/',
    expires,
  };
}

interface Tier1Body {
  email: string;
  token: string;
  emailVerified?: boolean;
}

function parseTier1Body(body: unknown): Tier1Body | null {
  if (typeof body !== 'object' || body === null) return null;
  const { email, token, emailVerified } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof token !== 'string') return null;
  if (emailVerified !== undefined && typeof emailVerified !== 'boolean') return null;
  return { email: email.trim().toLowerCase(), token, emailVerified };
}

testAuth.post('/login', async (c) => {
  if (!isLocalRequest(c.req.url) || !c.env.TEST_AUTH_TOKEN) return notFound().error;

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const body = parseTier1Body(raw);
  if (!body) return badRequest('email and token are required').error;
  if (body.token !== c.env.TEST_AUTH_TOKEN) return unauthorized().error;

  const db = createDb(c.env.DB);
  const verified = body.emailVerified ?? true;

  let user = await db.query.users.findFirst({
    where: (u, { eq: eqOp }) => eqOp(u.email, body.email),
  });

  if (!user) {
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email: body.email,
      passwordHash: await hashPassword(crypto.randomUUID()),
      emailVerifiedAt: verified ? new Date() : null,
      createdAt: new Date(),
    });
    user = await db.query.users.findFirst({ where: (u, { eq: eqOp }) => eqOp(u.id, id) });
  }
  if (!user) return badRequest('Could not create test user').error;

  const { token: sessionToken, expiresAt } = await rotateSession(db, undefined, user.id);
  setCookie(c, SESSION_COOKIE, sessionToken, sessionCookieOptions(c, expiresAt));

  return c.json({ user: serializeUser(user) });
});

// Signed payload = `${email}.${expiresAt}.${host}` over TEST_LOGIN_SECRET.
// expiresAt is Unix seconds; the signer chooses it (bounded server-side to
// at most MAX_TTL_SECONDS from now), and the host binds the token to the
// exact deployment it was minted for.
const MAX_TTL_SECONDS = 5 * 60;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toHex(signature);
}

// Exported so a smoke-test script (which holds the same TEST_LOGIN_SECRET
// via its own environment) can mint a token without duplicating the HMAC
// logic. Not reachable from any HTTP route.
export async function createTestLoginToken(
  secret: string,
  email: string,
  host: string,
  ttlSeconds: number = MAX_TTL_SECONDS,
): Promise<{ email: string; expiresAt: number; host: string; signature: string }> {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.min(ttlSeconds, MAX_TTL_SECONDS);
  const signature = await hmacHex(secret, `${email}.${expiresAt}.${host}`);
  return { email, expiresAt, host, signature };
}

interface Tier2Body {
  email: string;
  expiresAt: number;
  host: string;
  signature: string;
}

function parseTier2Body(body: unknown): Tier2Body | null {
  if (typeof body !== 'object' || body === null) return null;
  const { email, expiresAt, host, signature } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof host !== 'string' || typeof signature !== 'string') {
    return null;
  }
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
  return { email: email.trim().toLowerCase(), expiresAt, host, signature };
}

testAuth.post('/prod-login', async (c) => {
  if (!c.env.TEST_LOGIN_SECRET) return notFound().error;

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body').error;
  }

  const body = parseTier2Body(raw);
  if (!body) return badRequest('email, expiresAt, host, and signature are required').error;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (body.expiresAt <= nowSeconds || body.expiresAt > nowSeconds + MAX_TTL_SECONDS) {
    return unauthorized().error;
  }

  const requestHost = c.req.header('host') ?? new URL(c.req.url).host;
  if (body.host !== requestHost) return unauthorized().error;

  const expected = await hmacHex(
    c.env.TEST_LOGIN_SECRET,
    `${body.email}.${body.expiresAt}.${body.host}`,
  );
  if (!timingSafeEqualHex(expected, body.signature)) return unauthorized().error;

  const db = createDb(c.env.DB);
  const user = await db.query.users.findFirst({
    where: (u, { eq: eqOp }) => eqOp(u.email, body.email),
  });
  if (!user) return unauthorized().error;

  const { token: sessionToken, expiresAt } = await rotateSession(db, undefined, user.id);
  setCookie(c, SESSION_COOKIE, sessionToken, sessionCookieOptions(c, expiresAt));

  return c.json({ user: serializeUser(user) });
});
