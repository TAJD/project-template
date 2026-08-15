# Account module

Data layer and core auth: Drizzle/D1 users + sessions, WebCrypto PBKDF2 password hashing,
HttpOnly cookie sessions, signup/sign-in/sign-out/`me`, and email plumbing (email
verification + password reset via single-use hashed D1 tokens, with a zero-credential dev
mailbox standing in for a real provider) — self-contained so the module can be removed
without touching unrelated code.

## Touch-points

- **`apps/worker/wrangler.toml`** — the `[[d1_databases]]` binding (`DB`, `migrations_dir =
"migrations"`), the `AUTH_RATE_LIMITER` `[[unsafe.bindings]]` rate-limiter binding, and the
  `[build]` command's `apply-d1-migrations-on-build.mjs` step. `RESEND_API_KEY` is set as a
  Worker **secret** (`wrangler secret put RESEND_API_KEY`), not a wrangler.toml var — unset in
  every local/dev/CI environment, which is exactly the signal `lib/email.ts`'s factory and the
  `/api/dev/mailbox` route use to stay in dev mode.
- **`apps/worker/src/env.ts`** — the `DB: D1Database` field on `Env` (the `RateLimitBindings`
  interface it extends already declares `AUTH_RATE_LIMITER`, see
  `apps/worker/src/lib/rate-limit.ts`), plus optional `RESEND_API_KEY` and `EMAIL_FROM`.
- **`apps/worker/src/index.ts`** — imports `auth` and `devMailbox` from `./modules/auth` and
  mounts them at `/api/auth` and `/api/dev`.
- **`apps/worker/src/db/`** — Drizzle schema (`users`, `sessions`, `authTokens`, `devEmails`)
  and the `createDb()` helper. Not under `modules/auth/` because the schema/migrations are
  shared infrastructure other modules (billing, etc.) will also read from, per the design
  spec's `apps/worker/src/db/` option.
- **`apps/worker/src/lib/crypto.ts`** — `randomToken()`/`hashToken()`, shared by session
  tokens (`modules/auth/session.ts`) and single-use auth tokens (`modules/auth/tokens.ts`).
- **`apps/worker/src/lib/request.ts`** — `isLocalRequest()`, the hostname check behind both
  the session cookie's `Secure` flag and the `/api/dev/mailbox` prod gate.
- **`apps/worker/src/lib/email.ts`** — `EmailSender` interface, `ResendSender`,
  `DevMailboxSender`, and the `createEmailSender()` factory (picks by `RESEND_API_KEY`
  presence). Lives in `lib/` rather than `modules/auth/` since billing may reuse it for
  receipts later, per the ticket.
- **`apps/worker/migrations/`** — the generated D1 migrations for `users`/`sessions` and for
  `auth_tokens`/`dev_emails`.
- **`apps/worker/drizzle.config.ts`** — drizzle-kit config pointing at the schema/migrations
  above (`pnpm --filter @template/worker run db:generate` regenerates after a schema edit).
- **`apps/worker/scripts/apply-d1-migrations-on-build.mjs`** — runs `wrangler d1 migrations
apply` only when `WORKERS_CI_BRANCH === 'main'` (Cloudflare Workers Builds); no-ops locally
  and on PR builds.
- **`apps/worker/src/test/apply-migrations.ts`** + **`apps/worker/src/test/env.d.ts`** —
  test-harness wiring (`applyD1Migrations` setup file, `cloudflare:test` `ProvidedEnv`
  augmentation) and **`apps/worker/vitest.config.ts`** — `readD1Migrations()` +
  `TEST_MIGRATIONS` binding. All of this is generic D1-test-harness plumbing, not
  auth-specific, but nothing else uses D1 yet.
- **`apps/worker/src/lib/errors.ts`** — added `tooManyRequests()` (429), used by the rate
  limit checks in `modules/auth/routes.ts`.
- **`apps/worker/src/modules/auth/`** — all auth route/session/password/token/dev-mailbox
  module code.
- **`apps/web/src/App.tsx`** — imports `SignInPage`/`SignUpPage`/`ResetRequestPage`/
  `ResetPage`/`DevMailboxPage` from `./modules/account` and mounts `/sign-in`, `/sign-up`,
  `/reset-password`, `/reset-password/:token`, and `/dev/mailbox` inside `Layout`.
- **`apps/web/src/components/Layout.tsx`** — the `UserMenu` component (calls `useUser()`;
  renders sign-in/sign-up links or the signed-in email + sign-out button) and
  `<VerifyPromptBanner />`, mounted below the header.
- **`apps/web/src/modules/account/`** — all module code (api client, `useUser()` hook,
  SignUp/SignIn/ResetRequest/Reset/DevMailbox pages, `VerifyPromptBanner`).

## Removal steps

1. In `apps/web/src/App.tsx`, remove the `import { SignInPage, SignUpPage, ResetRequestPage,
ResetPage, DevMailboxPage } from './modules/account'` line and the `/sign-in`, `/sign-up`,
   `/reset-password`, `/reset-password/:token`, and `/dev/mailbox` `<Route>` entries.
2. In `apps/web/src/components/Layout.tsx`, remove the `UserMenu` component, its
   `<UserMenu />` usage, `<VerifyPromptBanner />`, and the `useUser`/`signOut`/
   `VerifyPromptBanner` import from `../modules/account`.
3. Delete `apps/web/src/modules/account/`.
4. In `apps/worker/src/index.ts`, remove the `import { auth, devMailbox } from
'./modules/auth'` line and the `app.route('/api/auth', auth)` / `app.route('/api/dev',
devMailbox)` calls.
5. Delete `apps/worker/src/modules/auth/`.
6. In `apps/worker/src/lib/rate-limit.ts`, remove `AUTH_RATE_LIMITER` from
   `RateLimitBindings` (if no other module uses it). Delete `apps/worker/src/lib/email.ts`
   (and its test) unless billing has started reusing `EmailSender` for receipts.
7. In `apps/worker/wrangler.toml`, remove the `[[unsafe.bindings]]` block for
   `AUTH_RATE_LIMITER`, the `RESEND_API_KEY` secret, and — if no other module reads D1 — the
   `[[d1_databases]]` block and the `apply-d1-migrations-on-build.mjs` step from
   `[build].command`.
8. Remove `RESEND_API_KEY` and `EMAIL_FROM` from `apps/worker/src/env.ts`.
9. If no other module uses D1: delete `apps/worker/src/db/`, `apps/worker/migrations/`,
   `apps/worker/drizzle.config.ts`, `apps/worker/src/test/apply-migrations.ts`,
   `apps/worker/src/test/env.d.ts`, revert `vitest.config.ts` to a plain
   `defineWorkersConfig({...})`, remove `DB` from `apps/worker/src/env.ts`, and remove
   `drizzle-orm`/`drizzle-kit` from `apps/worker/package.json`. Otherwise leave that
   infrastructure in place for whatever module still needs D1.
10. Run `pnpm check` to confirm the rest of the suite is still green with the module gone.

## Known gaps / deliberate deviations

- **PBKDF2 iteration count (100,000, not OWASP's 600,000+):** benchmarked on this machine,
  PBKDF2-SHA256 costs roughly 0.17ms per 1,000 iterations, so 600,000 iterations is ~100ms of
  CPU time — comfortably over the Workers "bundled" usage model's 50ms/request CPU limit (and
  the free plan's 10ms limit can't fit any iteration count worth using). 100,000 iterations
  costs ~15-20ms measured on this machine, leaving headroom under the bundled limit while
  still being an order of magnitude above legacy (~10k) defaults. Projects on the "unbound"
  usage model should raise `ITERATIONS` in `apps/worker/src/modules/auth/password.ts`.
- **Secure cookie flag is conditional on the request's own protocol**, not hard-coded `true`
  — `wrangler dev` serves plain HTTP locally by default, and a hard-coded `Secure` flag would
  silently break the local signup/login flow (browsers drop `Secure` cookies set over HTTP).
  Real deployments (workers.dev / a custom domain) are always HTTPS, so the flag is still
  effectively always on in production.
- **`apply-d1-migrations-on-build.mjs` gates on `WORKERS_CI_BRANCH`**, the Cloudflare Workers
  Builds env var for the branch being built. This is not exercised by the test suite (it
  depends on the Workers Builds runtime) — confirm the exact env var name against the
  Cloudflare dashboard docs for your account before relying on it in production.
- **No dev-time proxy from `apps/web`'s Vite dev server to `apps/worker`'s `wrangler dev`.**
  `apps/web/src/modules/account/api.ts` calls relative `/api/auth/*` paths, which resolve
  correctly when the worker serves both the API and the built SPA assets together (production,
  and `wrangler dev` once `apps/web` is built) — but running `pnpm --filter web dev` on its own
  Vite dev server has no `/api/*` to hit. This is a pre-existing gap in the chassis (not
  introduced here); a `server.proxy` entry in `apps/web/vite.config.ts` pointing `/api` at the
  worker's dev port would close it, but is out of scope for this module.
- **Account settings and delete-my-account are still out of scope** — the design spec lists
  them under the account module, but this ticket covers email verification and password reset
  only. A later ticket builds on the `users` table, `requireUser` middleware, and
  `EmailSender`/token infrastructure this one produces.
- **Dev/prod signal for email sending is `RESEND_API_KEY` presence**, read directly off `Env`
  rather than a separate flag — matches the ticket's suggested signal and needs no new wrangler
  config. `RESEND_API_KEY` is unset in every local/CI environment by construction (it's a
  secret, never a wrangler.toml var), so `DevMailboxSender` and `/api/dev/mailbox` are live by
  default and only go away once a real deployment sets the secret.
- **`/api/dev/mailbox` gates on hostname as well as `RESEND_API_KEY`** — the secret alone is
  not a safe prod signal, because a deployment that never set it would fall back to
  `DevMailboxSender` and then serve the whole outbox (live reset links included) to the
  internet. `isLocalRequest()` is the gate that actually holds: a deployed Worker is only
  reached on a hostname Cloudflare routes to it, so `localhost` is unreachable in production.
- **`/api/dev/mailbox` lives under `/api/*`, not at a bare `/dev/mailbox` worker route** —
  `wrangler.toml`'s `run_worker_first` only covers `/api/*`; a bare `/dev/*` path would need
  its own entry there to ever reach the Worker (rather than the SPA shell) in a real deployment.
  Keeping it under `/api/*` needs no wrangler.toml change and self-404s correctly both in the
  workerd test suite and in a real prod deployment. The web-side page that renders it is
  mounted at the `/dev/mailbox` **client-side** route (`apps/web/src/App.tsx`) and fetches
  `/api/dev/mailbox` for data.
- **Password reset invalidates all of a user's existing sessions** (`deleteSessionsForUser` in
  `modules/auth/session.ts`), not just the one used to request the reset — not explicitly
  required by the ticket, but leaving other sessions alive after a reset would undermine the
  point of resetting (a session hijacked before the reset would otherwise survive it).
- **Auth tokens are single-use via a select-then-update, not a single atomic statement** — good
  enough for D1's effectively-single-writer model at this scale; a true CAS (`UPDATE ...
WHERE used_at IS NULL RETURNING ...`) would close a theoretical race between two concurrent
  consumes of the same token, but is left as a future hardening step rather than added
  speculatively here.
