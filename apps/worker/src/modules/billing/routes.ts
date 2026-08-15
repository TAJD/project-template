import { Hono } from 'hono';
import type { Env } from '../../env';
import { createDb } from '../../db';
import { badRequest, serverError } from '../../lib/errors';
import { createLogger } from '../../lib/logger';
import { requireUser, type AuthVariables } from '../auth/middleware';
import { getOrCreateCustomer, findCustomer } from './customers';
import { createCheckoutSession, createPortalSession, StripeApiError } from './stripe-client';
import { verifyStripeSignature } from './webhook-signature';
import { claimEvent, parseStripeEvent, parseSubscriptionObject } from './events';
import { applySubscriptionEvent } from './subscription';

export const billing = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const SUBSCRIPTION_EVENT_TYPES = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

billing.post('/checkout', requireUser, async (c) => {
  const secretKey = c.env.STRIPE_SECRET_KEY;
  const priceId = c.env.STRIPE_PRICE_ID;
  if (!secretKey || !priceId) return serverError(new Error('Billing is not configured')).error;

  const user = c.get('user');
  const db = createDb(c.env.DB);

  try {
    const customer = await getOrCreateCustomer(db, secretKey, user.id, user.email);

    const session = await createCheckoutSession(secretKey, {
      customerId: customer.stripeCustomerId,
      priceId,
      userId: user.id,
      successUrl: new URL('/settings?upgraded=1', c.req.url).toString(),
      cancelUrl: new URL('/pricing', c.req.url).toString(),
    });

    return c.json({ url: session.url });
  } catch (err) {
    if (err instanceof StripeApiError) return badRequest('Could not start checkout').error;
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

billing.post('/portal', requireUser, async (c) => {
  const secretKey = c.env.STRIPE_SECRET_KEY;
  if (!secretKey) return serverError(new Error('Billing is not configured')).error;

  const user = c.get('user');
  const db = createDb(c.env.DB);

  try {
    const customer = await findCustomer(db, user.id);
    if (!customer) return badRequest('No billing account yet').error;

    const session = await createPortalSession(secretKey, {
      customerId: customer.stripeCustomerId,
      returnUrl: new URL('/settings', c.req.url).toString(),
    });

    return c.json({ url: session.url });
  } catch (err) {
    if (err instanceof StripeApiError) return badRequest('Could not open billing portal').error;
    return serverError(err, c.env.LOG_LEVEL).error;
  }
});

// Not behind `requireUser` or the auth rate limiter — the caller is Stripe,
// not a signed-in browser, so there's no session to require and IP-keyed
// rate limiting would only ever throttle Stripe's own delivery infrastructure
// (shared across every Stripe webhook customer) rather than an attacker.
// Signature verification is the actual security boundary here: every
// request that fails it is rejected before any of its content is trusted or
// persisted.
billing.post('/webhook', async (c) => {
  const secretKey = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey) return serverError(new Error('Billing is not configured')).error;

  const rawBody = await c.req.text();
  const signatureHeader = c.req.header('stripe-signature');

  const valid = await verifyStripeSignature(rawBody, signatureHeader, secretKey);
  if (!valid) return badRequest('Invalid signature').error;

  const event = parseStripeEvent(rawBody);
  if (!event) return badRequest('Invalid event payload').error;

  const db = createDb(c.env.DB);

  const isNewEvent = await claimEvent(db, event.id, event.type);
  if (!isNewEvent) return c.json({ received: true, duplicate: true });

  if (SUBSCRIPTION_EVENT_TYPES.has(event.type)) {
    const subscription = parseSubscriptionObject(event.data.object);
    if (subscription) {
      const customer = await db.query.customers.findFirst({
        where: (row, { eq }) => eq(row.stripeCustomerId, subscription.customer),
      });

      if (customer) {
        await applySubscriptionEvent(
          db,
          customer.userId,
          {
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            priceId: subscription.priceId,
            currentPeriodEnd: new Date(subscription.currentPeriodEnd * 1000),
          },
          new Date(event.created * 1000),
        );
      } else {
        createLogger(c.env.LOG_LEVEL).warn('stripe webhook: unknown customer', {
          customerId: subscription.customer,
        });
      }
    }
  }

  return c.json({ received: true });
});
