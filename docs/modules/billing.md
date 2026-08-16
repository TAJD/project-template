# Billing module

Stripe subscriptions: Checkout Session creation, customer-portal redirect, webhook
signature verification + event-dedup + subscription mirror to D1, a web-side
pricing/upgrade page + `useSubscription()` hook, the gated sample page at `/members`,
and a narrative story-test suite (PT-15) — self-contained under its `modules/` roots
(plus the documented touch-points below) so the module can be removed without touching
unrelated code. Depends on the account module (PT-13's `requireUser` and delete-account
cascade); nothing else depends on billing.

## Gated sample page (PT-15)

`apps/web/src/modules/billing/GatedSamplePage.tsx`, mounted at `/members`, is the
example site's living proof that account + billing compose end-to-end — the one page
worth re-checking after every merge. It renders one of three states driven by
`useUser()` + `useSubscription()`, gated strictly on subscription status (see "Known
gaps" below for why it does not also gate on `emailVerified`):

- **Signed out** — a register/sign-in prompt, no subscription check performed.
- **Signed in, not subscribed** (`status` not in `{active, trialing}`) — a paywall with
  a "Subscribe" CTA wired to the existing `startCheckout()` flow (same as `PricingPage`).
- **Subscribed** (`active`/`trialing`) — the sample premium content.

### The gate is client-side only — do not copy it for real premium content

`GatedSamplePage` decides what to render from `useSubscription()`, which reads
`GET /api/billing/subscription`. That call is authenticated (`requireUser`), so an
unauthenticated visitor genuinely cannot learn a subscription's status — but the
_content_ it gates is a static string compiled into the client bundle. Anyone can read
it out of the shipped JS, or flip the state in a debugger, without ever paying. That is
fine here (the "premium content" is a placeholder sentence with no value) and it is what
keeps the page a pure front-end demo, but it is not an access-control boundary.

A stamped project putting real paid content behind this page must serve that content
from the worker, from a route that re-checks the subscription server-side — i.e. a
handler behind `requireUser` that calls `getSubscription()` and 403s on a non-`active`/
`trialing` status — and have the page fetch it. Treat the three client states as
presentation only; the server route is the gate.

It is registered in `apps/web/src/App.tsx` (`/members`) and in the main nav
(`apps/web/src/components/Layout.tsx`, alongside Home/Blog) rather than only being
reachable via the pricing/account flow — it's meant to be one click away for anyone
checking the example site still works, not buried behind a purchase.

### SEO: registered but noindex

`/members` is registered in `apps/web/src/seo.config.ts` with `noindex: true` (a new
`RouteMeta` field, see `packages/shared/src/seo-types.ts`) rather than left out of the
registry entirely. Registering it means it still gets prerendered with its own real
`<head>` and stays SPA-routable on a hard refresh (the worker's generated
`spa-routes.generated.ts` is built from the same registry); `noindex: true` makes
`renderHeadTags()` emit `<meta name="robots" content="noindex" />` and makes
`buildSitemapEntries()` (`packages/shared/src/sitemap-routes.ts`) exclude it from
`sitemap.xml` — a gated page has nothing crawlers should index or list.

## Narrative story-test suite (PT-15)

`tests/integration/` at the repo root — not under `apps/worker/src/` — exercises the
real webhook handler and real `applySubscriptionEvent`/D1-mirror logic end-to-end for
each named scenario (mocking only the outbound Stripe HTTP calls, via
`vi.stubGlobal('fetch', ...)`, same as every other billing test): `subscribe-happy-path`,
`trial`, `cancel-at-period-end`, `cancel-immediate`, `refund`, `card-decline`,
`out-of-order-webhook`, `dispute`, plus `safety-guard.test.ts` and `cleanup.test.ts`.
Scenario names and structure are original to this codebase, written from the ticket's
scenario list and this module's own webhook/state-machine code — no source was read
from poker-puzzle, the private repo that list was inspired by.

It lives at the repo root (not `apps/worker/src/`) so it reads as whole-system
narrative behaviour rather than one module's unit tests, but it needs the same real
workerd + D1 environment `apps/worker`'s own tests already have configured — rather
than standing up a second `vitest-pool-workers` config, `apps/worker/vitest.config.ts`'s
`test.include` points at both `src/**/*.test.ts` and
`../../tests/integration/**/*.test.ts`, so `pnpm --filter @template/worker run test`
(and therefore `pnpm check`) runs them as part of the same worker test run. `tests/`
is a pnpm workspace member (`tests/integration/package.json`,
`@template/integration-tests`) purely so `tsc`/`pnpm -r run typecheck` can resolve
`vitest`/`drizzle-orm`/Cloudflare types from its own `node_modules` — it deliberately
has **no** `test` script of its own, so test _execution_ only ever happens through
`apps/worker`'s vitest-pool-workers config above, never standalone (these tests import
`cloudflare:test`, which only exists inside that pool).

### `cancel_at_period_end` — a second field alongside `status`

The "cancel at period end" story needs to tell apart "still active, but scheduled to
cancel when the period ends" from an immediate cancellation — Stripe represents this as
a `customer.subscription.updated` event with `status: "active"` and
`cancel_at_period_end: true` (it does not emit the terminal `.deleted`/`canceled` event
until the period actually ends). `subscriptions.cancel_at_period_end` (migration
`0003_stormy_the_watchers.sql`) is a new boolean column alongside `status` for exactly
this — `applySubscriptionEvent()` now also carries it through
`SubscriptionEventData.cancelAtPeriodEnd`, and `GET /api/billing/subscription` exposes
it on the response.

### `charge.dispute.created` and `charge.refunded` — deliberate no-ops

Neither event type is in `SUBSCRIPTION_EVENT_TYPES`, so the webhook route's existing
"acknowledge and skip any other event type" behaviour already handles both without any
new code. This is called out explicitly rather than left implicit because both look
like they _should_ do something at a glance:

- **`charge.refunded`** is a charge-level event, not a statement about subscription
  status. A refund does not itself mean the subscription should be cancelled — Stripe
  only does that in response to a separate subscription-status event, which arrives as
  its own `customer.subscription.updated`/`.deleted` webhook (already covered by the
  cancel story tests).
- **`charge.dispute.created`** is deliberately _not_ wired to auto-cancel the
  subscription. Auto-cancelling on a dispute would let a webhook payload alone revoke
  access — including on a fraudulent dispute — without a human ever reviewing it. The
  correct response to a dispute is a human-reviewed process (a stamped project would
  wire this to an ops alert), not an automatic D1 mutation.

`tests/integration/refund.test.ts` and `tests/integration/dispute.test.ts` assert this
no-op behaviour directly against the real webhook route.

### Stripe live-key safety guard

`apps/worker/src/modules/billing/stripe-client.ts`'s `stripeRequest()` — the single
choke point every exported function (`createStripeCustomer`, `createCheckoutSession`,
`createPortalSession`) calls through — now throws `LiveModeKeyError` before making any
network request if the secret key starts with `sk_live_`. This template has no real
Stripe account and every test mocks `fetch` rather than hitting Stripe's live API, so
nothing here has ever exercised a real live-mode key; this is a static safety net
against a future misconfiguration (e.g. a stamped project's local `.dev.vars`
accidentally pointing at a production secret), asserted in
`tests/integration/safety-guard.test.ts` with a fake `sk_live_...` string — no real
Stripe credentials needed.

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
  the three tables above, and `0003_stormy_the_watchers.sql`, which adds
  `subscriptions.cancel_at_period_end`.
- **`apps/worker/src/modules/auth/delete-account.ts`** — `accountDeletionStatements()`
  extended with `db.delete(subscriptions)...` and `db.delete(customers)...`, ahead of
  the existing `sessions`/`authTokens`/`users` deletes in the same atomic `db.batch()`.
  `stripe_events` is deliberately **not** included: it's keyed by Stripe event id, not
  user id, and holds no personal data (a dedup ledger, not user-owned state).
- **`apps/worker/src/modules/billing/`** — all billing route/client/webhook/subscription
  module code.
- **`apps/web/src/App.tsx`** — imports `PricingPage`/`GatedSamplePage` from
  `./modules/billing` and mounts `/pricing` and `/members`.
- **`apps/web/src/components/Layout.tsx`** — the "Members" main-nav link to `/members`.
- **`apps/web/src/seo.config.ts`** — the `/members` route registration (`noindex: true`).
- **`apps/web/src/modules/billing/`** — all module code (api client, `useSubscription()`
  hook, `PricingPage`, `GatedSamplePage`).
- **`packages/shared/src/seo-types.ts`** / **`head-tags.ts`** / **`sitemap-routes.ts`** —
  the `RouteMeta.noindex` field and its effect on `renderHeadTags()`/
  `buildSitemapEntries()`. Shared by every module's routes, not billing-specific, so
  removing billing does **not** mean reverting these — only the `/members` route entry
  that uses the field.
- **`tests/integration/`** — the PT-15 story-test suite and its `package.json`/
  `tsconfig.json` (a pnpm workspace member purely for type resolution, see above).
- **`apps/worker/vitest.config.ts`** — the `test.include` entry pointing at
  `../../tests/integration/**/*.test.ts`.
- **`pnpm-workspace.yaml`** — the `tests/*` package glob.
- **`scripts/stripe-tunnel.mjs`** / **`scripts/stripe-tunnel.ps1`** — local dev helper
  that runs `stripe listen --forward-to <worker-url>/api/billing/webhook` via the Stripe
  CLI (not installed or invoked by this repo's own tooling — the CLI and a `stripe
login` are a separate, one-time developer setup step).

## Removal steps

1. In `apps/web/src/App.tsx`, remove the
   `import { PricingPage, GatedSamplePage } from './modules/billing'` line and the
   `/pricing` and `/members` `<Route>` entries.
2. In `apps/web/src/components/Layout.tsx`, remove the "Members" nav `<Link>`.
3. In `apps/web/src/seo.config.ts`, remove the `/members` route entry.
4. Delete `apps/web/src/modules/billing/`.
5. In `apps/worker/src/index.ts`, remove the `import { billing } from './modules/billing'`
   line and the `app.route('/api/billing', billing)` call.
6. Delete `apps/worker/src/modules/billing/`.
7. Delete `tests/integration/` and remove the `tests/*` entry from `pnpm-workspace.yaml`.
8. In `apps/worker/vitest.config.ts`, remove the `../../tests/integration/**/*.test.ts`
   entry from `test.include` (or the whole `include` override if nothing else needs it).
9. In `apps/worker/src/modules/auth/delete-account.ts`, remove the `db.delete(subscriptions)`
   and `db.delete(customers)` statements (and the now-unused `customers`/`subscriptions`
   imports) from `accountDeletionStatements()`.
10. In `apps/worker/src/db/schema.ts` and `apps/worker/src/db/index.ts`, remove the
    `customers`, `subscriptions`, and `stripeEvents` table definitions/exports — unless
    another module still reads D1 (the account module already does, so `src/db/` itself
    stays).
11. In `apps/worker/src/env.ts`, remove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
    `STRIPE_PRICE_ID`.
12. In `apps/worker/wrangler.toml`, remove the billing comment block and any deployed
    `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` secrets (`wrangler secret delete ...`).
13. Delete `scripts/stripe-tunnel.mjs` and `scripts/stripe-tunnel.ps1`.
14. A new Drizzle migration (`pnpm --filter @template/worker run db:generate` after step 10) will emit `DROP TABLE` statements for `customers`/`subscriptions`/`stripe_events`
    — run it rather than hand-deleting `0002_soft_shriek.sql`/`0003_stormy_the_watchers.sql`,
    since earlier deployments may already have applied them.
15. `RouteMeta.noindex`, `renderHeadTags()`'s robots-tag handling, and
    `buildSitemapEntries()`'s noindex filter (`packages/shared/`) are **not**
    billing-specific — leave them in place even though nothing else currently uses them.
16. Run `pnpm check` to confirm the rest of the suite is still green with the module gone.

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
- **`PricingPage`/`GatedSamplePage` both treat any status in `{active, trialing}` as
  "subscribed", everything else (including `past_due`, `unpaid`, `canceled`,
  `incomplete`, and an active-but-`cancel_at_period_end` subscription) as "not
  subscribed."** This is a simplification for the example site — a production app
  usually wants a distinct "payment failed, update your card" state for
  `past_due`/`unpaid`, and a "your access ends on `<date>`" state for
  `cancel_at_period_end`, rather than folding every non-active status into the same
  "please subscribe" CTA as a user who never subscribed at all.
- **`GatedSamplePage` gates strictly on subscription status, not `emailVerified`.** A
  prior security review found `emailVerified` is currently decorative — nothing reads it
  (tracked as PT-39, not yet fixed). Gating the sample premium content on it as well
  would have meant inventing new unreviewed security-sensitive logic on top of a known
  gap rather than fixing PT-39 itself, so `GatedSamplePage` deliberately gates on
  subscription status alone, exactly as the ticket's three states describe.
