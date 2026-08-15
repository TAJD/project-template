import { Hono } from 'hono';
import { desc } from 'drizzle-orm';
import type { Env } from '../../env';
import { createDb } from '../../db';
import { devEmails } from '../../db/schema';
import { notFound } from '../../lib/errors';

export const devMailbox = new Hono<{ Bindings: Env }>();

// Self-404s once RESEND_API_KEY is configured — the same signal
// lib/email.ts's factory uses to switch from DevMailboxSender to
// ResendSender — so this dev-only inbox can never leak into a real
// deployment, even if the route is left mounted.
devMailbox.get('/mailbox', async (c) => {
  if (c.env.RESEND_API_KEY) return notFound().error;

  const db = createDb(c.env.DB);
  const emails = await db.select().from(devEmails).orderBy(desc(devEmails.createdAt));

  return c.json({ emails });
});
