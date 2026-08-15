# Billing module

Stripe subscriptions: Checkout Session creation, customer-portal redirect, webhook
signature verification + event-dedup + subscription mirror to D1, and a web-side
pricing/upgrade page + `useSubscription()` hook — self-contained under its `modules/`
roots (plus the documented touch-points below) so the module can be removed without
touching unrelated code. Depends on the account module (PT-13's `requireUser` and
delete-account cascade); nothing depends on billing yet (PT-15's gated page will).

## Core architectural rule: D1 is the query surface

`getSubscription(userId)` (`apps/worker/src/modules/billing/subscription.ts`) reads
**only** from D1's `subscriptions` table. The app never calls the Stripe API at request
time to answer "is this user subscribed?" — every read of subscription state, on both
the worker (`GET /api/billing/subscription`) and web (`useSubscription()`) sides, goes
through this D1 mirror. The only two places this module calls the Stripe HTTP API at
all are `POST /api/billing/checkout` (create a Checkout Session) and `POST
/api/billing/portal` (create a customer-portal session) — both one-shot writes that
return a redirect URL, not reads of subscription state. Everything else about a user's
subscription arrives asynchronously via the webhook and is mirrored to D1 before
`getSubscription` ever sees it.

## Webhook signature verification

`apps/worker/src/modules/billing/webhook-signature.ts` implements Stripe's signing
scheme directly (HMAC-SHA256 over `${timestamp}.${rawBody}` with the webhook secret,
compared against the `Stripe-Signature` header's `v1` value via `crypto.subtle.verify`,
which is timing-safe internally) rather than skipping or stubbing it. This is the
entire security boundary for `POST /api/billing/webhook`: without it, anyone who found
the URL could POST a fake `customer.subscription.updated` event and grant themselves
(or revoke someone else's) access. A `t=<unix-seconds>` tolerance window (5 minutes)
is enforced as replay protection — a captured signature+payload pair stops verifying
shortly after capture even if the secret never rotates. Verification runs against the
_raw_ request body text (`c.req.text()`), never a re-serialized `JSON.stringify` of the
parsed body, because re-encoding can reorder keys or reformat numbers and would break a
genuine signature.

## Event dedup

`stripe_events.event_id` is the table's primary key. `claimEvent()`
(`apps/worker/src/modules/billing/events.ts`) does a single `INSERT ...
ON CONFLICT (event_id) DO NOTHING RETURNING event_id` and checks whether a row came
back — an atomic insert-or-skip, not a `SELECT` followed by a conditional `INSERT`.
That avoids the exact race PT-11/12's review flagged for auth-token consumption: two
concurrent deliveries of the same event id (Stripe retries on anything but a 2xx
response) can't both observe "not present yet" and both proceed to reprocess it, because
only one `INSERT` can ever win the unique constraint.

The claim is taken _before_ the event is applied, which would make any mid-handler
failure permanent — Stripe's retry would see the claim and skip the work, stranding the
subscription in a stale state. The webhook route therefore wraps the apply step and calls
`releaseEvent()` (deleting the claim) plus answers a 500 if it throws, so the retry is
treated as a first delivery.

## State machine keyed on subscription status, not event arrival order

This is the requirement the ticket calls out explicitly, with the test case "out-of-order
(updated-before-created) converges to correct state." Stripe does not guarantee webhook
delivery order — network retries and Stripe's own delivery infrastructure mean a
"customer.subscription.updated" event can arrive at this endpoint _before_ the
"customer.subscription.created" event that logically precedes it, even though Stripe
generated the `created` event first.

`applySubscriptionEvent()` (`apps/worker/src/modules/billing/subscription.ts`) handles
this by keying convergence on `lastEventCreatedAt` — the Stripe event envelope's own
`created` field (when Stripe generated the event), stored on the `subscriptions` row —
rather than on the order events happen to arrive in:

- Every incoming event is compared against the row's current `lastEventCreatedAt`.
- The row is only updated if the incoming event's `created` timestamp is _later_ than
  what's already stored. An event describing an earlier point in time than the
  already-applied state is a no-op, however it happens to have arrived.
- `created` has one-second resolution and Stripe emits several events for the same
  subscription within one second — cancelling emits `customer.subscription.updated` and
  `customer.subscription.deleted` together — so equal timestamps are common and cannot be
  resolved by "strictly later wins" without falling back to arrival order. Ties are broken
  on status instead: a terminal status (`canceled`, `incomplete_expired`, `unpaid`) beats a
  same-second non-terminal one, and is never overwritten by it. Without that rule, an
  `updated` event landing before its same-second `deleted` twin would suppress the
  cancellation and leave a cancelled subscription reading as `active`.

Concretely: if "updated" (event `created` = T2, status `active`) is delivered first, the
row is created with `lastEventCreatedAt = T2`. When "created" (event `created` = T1 <
T2, status `incomplete`) arrives second, T1 < T2 so it's discarded — the row stays
`active`. A naive last-write-wins implementation keyed on arrival order would instead let
the second-arriving "created" event clobber the row back to `incomplete`, which is
exactly the failure this design avoids. `apps/worker/src/modules/billing/routes.test.ts`
(`converges to the correct state when an updated event arrives before its created
event`) delivers the two events in that order to the real `/api/billing/webhook` route
and asserts the final D1 state is `active`, not `incomplete` — a naive
last-write-wins implementation would fail that specific assertion.

## Customer linkage

`customers` (`user_id` primary key, unique `stripe_customer_id`) is populated by
`getOrCreateCustomer()` at checkout time — a Stripe Customer is created and its id
stored in D1 _before_ the Checkout Session that references it, so every subscription
webhook that later arrives for that Stripe customer already has a row to resolve its
`customer` field back to a `userId` (subscription events carry no `userId` of their
own). If the webhook receives an event for a `customer` id with no matching row, it logs
a warning and skips the event rather than throwing — this is a defensive branch for a
customer created outside this app's checkout flow (e.g. directly in the Stripe
dashboard), not an expected path in normal operation.

## Touch-points

- **`apps/worker/wrangler.toml`** — the commented `STRIPE_PRICE_ID` var placeholder and
  the `wrangler secret put STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` documentation
  block. No real values are checked in anywhere in this template.
- **`apps/worker/src/env.ts`** — `STRIPE_SECRET_KEY?`, `STRIPE_WEBHOOK_SECRET?` (Worker
  secrets), `STRIPE_PRICE_ID?` (plain var).
- **`apps/worker/src/index.ts`** — imports `billing` from `./modules/billing` and mounts
  it at `/api/billing`.
- **`apps/worker/src/db/schema.ts`** and **`apps/worker/src/db/index.ts`** — `customers`,
  `subscriptions`, `stripeEvents` tables and their re-exports, alongside the account
  module's tables.
- **`apps/worker/migrations/`** — `0002_soft_shriek.sql`, the generated migration for
  the three tables above.
- **`apps/worker/src/modules/auth/delete-account.ts`** — `accountDeletionStatements()`
  extended with `db.delete(subscriptions)...` and `db.delete(customers)...`, ahead of
  the existing `sessions`/`authTokens`/`users` deletes in the same atomic `db.batch()`.
  `stripe_events` is deliberately **not** included: it's keyed by Stripe event id, not
  user id, and holds no personal data (a dedup ledger, not user-owned state).
- **`apps/worker/src/modules/billing/`** — all billing route/client/webhook/subscription
  module code.
- **`apps/web/src/App.tsx`** — imports `PricingPage` from `./modules/billing` and mounts
  `/pricing`.
- **`apps/web/src/modules/billing/`** — all module code (api client, `useSubscription()`
  hook, `PricingPage`).
- **`scripts/stripe-tunnel.mjs`** / **`scripts/stripe-tunnel.ps1`** — local dev helper
  that runs `stripe listen --forward-to <worker-url>/api/billing/webhook` via the Stripe
  CLI (not installed or invoked by this repo's own tooling — the CLI and a `stripe
login` are a separate, one-time developer setup step).

## Removal steps

1. In `apps/web/src/App.tsx`, remove the `import { PricingPage } from './modules/billing'`
   line and the `/pricing` `<Route>` entry.
2. Delete `apps/web/src/modules/billing/`.
3. In `apps/worker/src/index.ts`, remove the `import { billing } from './modules/billing'`
   line and the `app.route('/api/billing', billing)` call.
4. Delete `apps/worker/src/modules/billing/`.
5. In `apps/worker/src/modules/auth/delete-account.ts`, remove the `db.delete(subscriptions)`
   and `db.delete(customers)` statements (and the now-unused `customers`/`subscriptions`
   imports) from `accountDeletionStatements()`.
6. In `apps/worker/src/db/schema.ts` and `apps/worker/src/db/index.ts`, remove the
   `customers`, `subscriptions`, and `stripeEvents` table definitions/exports — unless
   another module still reads D1 (the account module already does, so `src/db/` itself
   stays).
7. In `apps/worker/src/env.ts`, remove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
   `STRIPE_PRICE_ID`.
8. In `apps/worker/wrangler.toml`, remove the billing comment block and any deployed
   `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` secrets (`wrangler secret delete ...`).
9. Delete `scripts/stripe-tunnel.mjs` and `scripts/stripe-tunnel.ps1`.
10. A new Drizzle migration (`pnpm --filter @template/worker run db:generate` after step 6) will emit `DROP TABLE` statements for `customers`/`subscriptions`/`stripe_events`
    — run it rather than hand-deleting `0002_soft_shriek.sql`, since earlier deployments
    may already have applied it.
11. Run `pnpm check` to confirm the rest of the suite is still green with the module gone.

## Known gaps / deliberate deviations

- **No real Stripe account, keys, or network calls exist anywhere in this template** —
  by design for this ticket. `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are documented
  as secret _names_ only; every test mocks `fetch` (`vi.stubGlobal('fetch', ...)`, the
  same convention `lib/email.ts`'s `ResendSender` tests use for Resend) rather than
  hitting Stripe's real API. A stamped project provisions real keys via `wrangler secret
put` and a real webhook endpoint/`stripe listen` session — neither is set up here.
- **One subscription per user, not one row per Stripe subscription id.** `subscriptions`
  is keyed on `user_id` (primary key), not `stripe_subscription_id`. This matches the
  ticket's `getSubscription(userId)` query surface and this template's single-price
  offering; a project that sells multiple concurrent subscriptions per user would need
  to re-key this table on `stripe_subscription_id` with `user_id` as a plain indexed
  column instead.
- **`getOrCreateCustomer()` is a check-then-create, not an atomic upsert** — unlike the
  event-dedup path, this one still has a narrow race: two concurrent `POST
/api/billing/checkout` calls from the same user (e.g. a double-click before the first
  request's redirect fires) could both observe "no customer row yet" and both call
  Stripe's `POST /customers`, creating two Stripe customers before the second D1 insert
  hits the `customers.user_id` primary-key conflict and fails. The result is a wasted,
  orphaned Stripe customer (harmless in test mode, a minor Stripe-dashboard clutter item
  in production) rather than incorrect billing state — the second request's checkout
  session still gets created against whichever customer id its own D1 insert or
  `findCustomer` lookup ends up returning. Left as a documented gap rather than an
  atomic upsert here, unlike the event-dedup path, because the ticket's atomicity
  callout was specifically about event processing (where a race causes double-applied
  side effects), not customer creation (where the worst case is a harmless duplicate
  record, not a security or correctness problem).
- **`checkout.session.completed` is not handled.** Only `customer.subscription.created` /
  `.updated` / `.deleted` update the D1 mirror. This template creates the Stripe customer
  itself before Checkout (see "Customer linkage" above), so it does not need
  `checkout.session.completed`'s `client_reference_id`/`customer` fields to link a
  session back to a user — the customer row already exists by then. A project that
  instead lets Stripe auto-create the customer during Checkout would need to also handle
  that event to establish the link.
- **No idempotency key on the Checkout/Customer/Portal creation calls.** A network
  retry of `POST /api/billing/checkout` (not a Stripe webhook — the outbound call this
  route itself makes) could create a duplicate Stripe Customer or Checkout Session if the
  first attempt's response was lost after Stripe processed it. Stripe's API supports an
  `Idempotency-Key` header for exactly this; not wired up here as it's a hardening step
  beyond what the ticket's Verify criteria call for (which cover the webhook-side
  idempotency/ordering guarantees, not outbound-call idempotency).
- **`PricingPage` treats any status in `{active, trialing}` as "subscribed", everything
  else (including `past_due`, `unpaid`, `canceled`, `incomplete`) as "not subscribed."**
  This is a simplification for the example site — a production app usually wants a
  distinct "payment failed, update your card" state for `past_due`/`unpaid` rather than
  folding it into the same "please subscribe" CTA as a user who never subscribed at all.
