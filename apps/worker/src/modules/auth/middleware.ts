import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { Env } from '../../env';
import type { User } from '../../db/schema';
import { createDb } from '../../db';
import { unauthorized } from '../../lib/errors';
import { SESSION_COOKIE, verifySession } from './session';

export interface AuthVariables {
  user: User;
}

export const requireUser: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> =
  createMiddleware(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return unauthorized().error;

    const db = createDb(c.env.DB);
    const user = await verifySession(db, token);
    if (!user) return unauthorized().error;

    c.set('user', user);
    await next();
    return;
  });
