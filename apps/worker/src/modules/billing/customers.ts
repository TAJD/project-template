import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { customers } from '../../db/schema';
import { createStripeCustomer } from './stripe-client';

export async function findCustomer(db: Database, userId: string) {
  const rows = await db.select().from(customers).where(eq(customers.userId, userId)).limit(1);
  return rows[0] ?? null;
}

// Creates the Stripe Customer (and its D1 mirror row) up front, before the
// Checkout Session that references it, so every subscription webhook that
// later arrives for this customer already has a `customers` row to resolve
// its `customer` id back to a userId — a subscription event alone carries no
// userId.
export async function getOrCreateCustomer(
  db: Database,
  secretKey: string,
  userId: string,
  email: string,
) {
  const existing = await findCustomer(db, userId);
  if (existing) return existing;

  const stripeCustomer = await createStripeCustomer(secretKey, { email, userId });

  await db.insert(customers).values({
    userId,
    stripeCustomerId: stripeCustomer.id,
    createdAt: new Date(),
  });

  return { userId, stripeCustomerId: stripeCustomer.id, createdAt: new Date() };
}
