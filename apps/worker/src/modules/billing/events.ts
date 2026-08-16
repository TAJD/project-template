import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { stripeEvents } from '../../db/schema';

// Minimal shape of a Stripe event envelope + subscription object — only the
// fields this module reads, not the full Stripe API surface.
export interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: string;
  currentPeriodEnd: number;
  priceId: string;
  cancelAtPeriodEnd: boolean;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
}

export function parseStripeEvent(raw: string): StripeWebhookEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const { id, type, created, data } = parsed as Record<string, unknown>;
  if (typeof id !== 'string' || typeof type !== 'string' || typeof created !== 'number') {
    return null;
  }
  if (typeof data !== 'object' || data === null || !('object' in data)) return null;

  return { id, type, created, data: data as { object: unknown } };
}

export function parseSubscriptionObject(object: unknown): StripeSubscriptionObject | null {
  if (typeof object !== 'object' || object === null) return null;
  const { id, customer, status, current_period_end, items, cancel_at_period_end } =
    object as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    typeof customer !== 'string' ||
    typeof status !== 'string' ||
    typeof current_period_end !== 'number' ||
    typeof items !== 'object' ||
    items === null
  ) {
    return null;
  }

  const data = (items as { data?: unknown }).data;
  const first = Array.isArray(data)
    ? (data[0] as { price?: { id?: unknown } } | undefined)
    : undefined;
  const priceId = typeof first?.price?.id === 'string' ? first.price.id : null;
  if (!priceId) return null;

  return {
    id,
    customer,
    status,
    currentPeriodEnd: current_period_end,
    priceId,
    cancelAtPeriodEnd: cancel_at_period_end === true,
  };
}

// Insert-or-skip dedup, done as a single atomic upsert rather than a
// SELECT-then-INSERT: `onConflictDoNothing` relies on `event_id`'s own
// unique constraint to decide the race, so two deliveries of the same event
// arriving concurrently can't both observe "not present yet" and both
// proceed to reprocess it — only one INSERT can ever win. `.returning()`
// reports whether *this* call was the one that won: an empty array means the
// row already existed (a redelivery Stripe retries on anything but a 2xx),
// so the caller can skip reprocessing it.
export async function claimEvent(db: Database, id: string, type: string): Promise<boolean> {
  const inserted = await db
    .insert(stripeEvents)
    .values({ eventId: id, type, createdAt: new Date() })
    .onConflictDoNothing({ target: stripeEvents.eventId })
    .returning({ eventId: stripeEvents.eventId });

  return inserted.length > 0;
}

// Undoes a `claimEvent()` when handling the claimed event failed, so Stripe's
// retry of that same event id is treated as a first delivery rather than a
// duplicate to skip.
export async function releaseEvent(db: Database, id: string): Promise<void> {
  await db.delete(stripeEvents).where(eq(stripeEvents.eventId, id));
}
