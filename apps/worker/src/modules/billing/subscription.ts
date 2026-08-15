import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { subscriptions, type Subscription } from '../../db/schema';

export interface SubscriptionEventData {
  stripeSubscriptionId: string;
  status: string;
  priceId: string;
  currentPeriodEnd: Date;
}

export async function getSubscription(db: Database, userId: string): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

// The state machine at the heart of the webhook handler. Keyed on
// `eventCreatedAt` — the Stripe event envelope's own `created` timestamp,
// i.e. when Stripe generated the event, not when this endpoint received it —
// rather than on arrival order. Stripe does not guarantee webhook delivery
// order, so two events for the same subscription can arrive here in the
// opposite order Stripe created them in (e.g. an "updated" event delivered
// before the "created" event that logically precedes it). A naive
// last-write-wins implementation keyed on arrival would let the
// chronologically-earlier "created" event clobber the later "updated"
// event's state if it happens to arrive second. Comparing against the
// highest `eventCreatedAt` already applied means only events that describe a
// *later* point in time are ever allowed to change the row, so the two
// arrival orders converge on the same final state.
//
// `created` has one-second resolution, and Stripe routinely emits several
// events for the same subscription within one second — cancelling emits
// `customer.subscription.updated` and `customer.subscription.deleted`
// together. A plain "strictly newer wins" rule makes those ties resolve by
// arrival order, which is the very thing this function exists to avoid, and
// resolves them the dangerous way half the time: the `updated` event landing
// first would suppress the `deleted` that follows it and leave a cancelled
// subscription looking active. Ties are therefore broken on status instead —
// a terminal status always wins, and a terminal state is never overwritten
// by a same-second non-terminal one.
const TERMINAL_STATUSES = new Set(['canceled', 'incomplete_expired', 'unpaid']);

function supersedes(
  existing: Pick<Subscription, 'lastEventCreatedAt' | 'status'>,
  eventCreatedAt: Date,
  status: string,
): boolean {
  const delta = eventCreatedAt.getTime() - existing.lastEventCreatedAt.getTime();
  if (delta !== 0) return delta > 0;
  return TERMINAL_STATUSES.has(status) && !TERMINAL_STATUSES.has(existing.status);
}

export async function applySubscriptionEvent(
  db: Database,
  userId: string,
  event: SubscriptionEventData,
  eventCreatedAt: Date,
): Promise<void> {
  const existing = await getSubscription(db, userId);

  if (existing && !supersedes(existing, eventCreatedAt, event.status)) {
    return;
  }

  const values = {
    userId,
    stripeSubscriptionId: event.stripeSubscriptionId,
    status: event.status,
    priceId: event.priceId,
    currentPeriodEnd: event.currentPeriodEnd,
    lastEventCreatedAt: eventCreatedAt,
    updatedAt: new Date(),
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: subscriptions.userId, set: values });
}
