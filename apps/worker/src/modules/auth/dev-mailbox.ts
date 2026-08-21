import { Hono } from 'hono';
import { desc } from 'drizzle-orm';
import type { Env } from '../../env';
import { createDb } from '../../db';
import { devEmails } from '../../db/schema';
import { notFound } from '../../lib/errors';
import { isLocalRequest } from '../../lib/request';

export const devMailbox = new Hono<{ Bindings: Env }>();

// Two independent gates, because this endpoint dumps live verification and
// password-reset links in plaintext and reaching it is account takeover for
// every user. RESEND_API_KEY is the signal lib/email.ts's factory uses to
// switch to ResendSender — but a deployment that simply never had the secret
// set would fall back to DevMailboxSender and, on that gate alone, serve the
// whole outbox to the internet. The hostname gate is the one that actually
// holds: a deployed Worker is only reached on a hostname Cloudflare routes to
// it, so `localhost` is unreachable in production regardless of config.
devMailbox.get('/mailbox', async (c) => {
  if (c.env.RESEND_API_KEY || !isLocalRequest(c.req.url)) return notFound().error;

  const db = createDb(c.env.DB);
  const emails = await db.select().from(devEmails).orderBy(desc(devEmails.createdAt));

  return c.json({ emails });
});
