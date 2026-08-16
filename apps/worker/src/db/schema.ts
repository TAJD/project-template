import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// `id` stores a hash of the opaque session token, never the raw token — the
// same principle as password_hash: the DB is a leak surface, so it never
// holds a value an attacker could replay as-is.
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// Single-use, expiring, hashed tokens backing both email verification and
// password reset links — same hash-at-rest principle as `sessions.id`.
export const authTokens = sqliteTable('auth_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['verify', 'reset'] }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type AuthToken = typeof authTokens.$inferSelect;
export type NewAuthToken = typeof authTokens.$inferInsert;

// Dev-mode email outbox: `DevMailboxSender` writes here instead of calling a
// real provider, so the full verify/reset flow runs with zero credentials.
export const devEmails = sqliteTable('dev_emails', {
  id: text('id').primaryKey(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type DevEmail = typeof devEmails.$inferSelect;
export type NewDevEmail = typeof devEmails.$inferInsert;

// One Stripe customer per user. Created at first checkout, before any
// webhook can reference it, so subscription events (which carry a Stripe
// customer id, not our userId) always have somewhere to resolve to.
export const customers = sqliteTable('customers', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

// One row per user (not per Stripe subscription id) — this is the D1 mirror
// `getSubscription(userId)` reads, kept current by webhook events and never
// queried by calling Stripe at request time. `lastEventCreatedAt` is the
// Stripe event envelope's own `created` timestamp (when Stripe generated the
// event, not when we received it) — the state machine keys convergence off
// this instead of arrival order, so an "updated" event that describes a
// later point in time than an already-applied "created" event always wins,
// even if it happens to be delivered first.
export const subscriptions = sqliteTable('subscriptions', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull(),
  status: text('status').notNull(),
  priceId: text('price_id').notNull(),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  // Stripe's own "cancel at period end" flag: true means the subscription
  // is scheduled to cancel when `currentPeriodEnd` arrives but is still
  // `active` until then (a `customer.subscription.updated` event, not
  // `.deleted` — Stripe doesn't emit the terminal `deleted`/`canceled`
  // event until the period actually ends). Distinct from `status`, which is
  // why PT-15's "cancel at period end" story test needs both: the CTA on a
  // gated page should read "your access ends on <date>" rather than
  // treating a scheduled cancellation the same as an already-canceled one.
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
  lastEventCreatedAt: integer('last_event_created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

// Dedup/idempotency guard: `eventId` is Stripe's own event id, unique so a
// redelivered webhook (Stripe retries on anything but a 2xx) can be told
// apart from a first delivery with a single INSERT ... the DB's own unique
// constraint does the work, not a separate SELECT-then-INSERT that would
// leave the same race window PT-11/12's token-consumption review flagged.
export const stripeEvents = sqliteTable('stripe_events', {
  eventId: text('event_id').primaryKey(),
  type: text('type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
