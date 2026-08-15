# Account module

Data layer and core auth: Drizzle/D1 users + sessions, WebCrypto PBKDF2 password hashing,
HttpOnly cookie sessions, and signup/sign-in/sign-out/`me` — self-contained so the module
can be removed without touching unrelated code.

## Touch-points

- **`apps/worker/wrangler.toml`** — the `[[d1_databases]]` binding (`DB`, `migrations_dir =
"migrations"`), the `AUTH_RATE_LIMITER` `[[unsafe.bindings]]` rate-limiter binding, and the
  `[build]` command's `apply-d1-migrations-on-build.mjs` step.
- **`apps/worker/src/env.ts`** — the `DB: D1Database` field on `Env` (the `RateLimitBindings`
  interface it extends already declares `AUTH_RATE_LIMITER`, see
  `apps/worker/src/lib/rate-limit.ts`).
- **`apps/worker/src/index.ts`** — imports `auth` from `./modules/auth` and mounts it at
  `/api/auth`.
- **`apps/worker/src/db/`** — Drizzle schema (`users`, `sessions`) and the `createDb()` helper.
  Not under `modules/auth/` because the schema/migrations are shared infrastructure other
  modules (billing, etc.) will also read from, per the design spec's `apps/worker/src/db/`
  option.
- **`apps/worker/migrations/`** — the generated D1 migration for `users`/`sessions`.
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
- **`apps/worker/src/modules/auth/`** — all auth route/session/password module code.
- **`apps/web/src/App.tsx`** — imports `SignInPage`/`SignUpPage` from `./modules/account` and
  mounts the `/sign-in` and `/sign-up` routes inside `Layout`.
- **`apps/web/src/components/Layout.tsx`** — the `UserMenu` component (calls `useUser()`;
  renders sign-in/sign-up links or the signed-in email + sign-out button).
- **`apps/web/src/modules/account/`** — all module code (api client, `useUser()` hook,
  SignUp/SignIn pages).

## Removal steps

1. In `apps/web/src/App.tsx`, remove the `import { SignInPage, SignUpPage } from
'./modules/account'` line and the `/sign-in`/`/sign-up` `<Route>` entries.
2. In `apps/web/src/components/Layout.tsx`, remove the `UserMenu` component, its
   `<UserMenu />` usage, and the `useUser`/`signOut` import from `../modules/account`.
3. Delete `apps/web/src/modules/account/`.
4. In `apps/worker/src/index.ts`, remove the `import { auth } from './modules/auth'` line and
   the `app.route('/api/auth', auth)` call.
5. Delete `apps/worker/src/modules/auth/`.
6. In `apps/worker/src/lib/rate-limit.ts`, remove `AUTH_RATE_LIMITER` from
   `RateLimitBindings` (if no other module uses it).
7. In `apps/worker/wrangler.toml`, remove the `[[unsafe.bindings]]` block for
   `AUTH_RATE_LIMITER`, and — if no other module reads D1 — the `[[d1_databases]]` block and
   the `apply-d1-migrations-on-build.mjs` step from `[build].command`.
8. If no other module uses D1: delete `apps/worker/src/db/`, `apps/worker/migrations/`,
   `apps/worker/drizzle.config.ts`, `apps/worker/src/test/apply-migrations.ts`,
   `apps/worker/src/test/env.d.ts`, revert `vitest.config.ts` to a plain
   `defineWorkersConfig({...})`, remove `DB` from `apps/worker/src/env.ts`, and remove
   `drizzle-orm`/`drizzle-kit` from `apps/worker/package.json`. Otherwise leave that
   infrastructure in place for whatever module still needs D1.
9. Run `pnpm check` to confirm the rest of the suite is still green with the module gone.

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
- **Email verification, password reset, and account settings are out of scope for this
  ticket** — the design spec lists them under the account module, but this ticket
  (data layer + core auth only) covers signup/sign-in/sign-out/`me`. A later ticket builds on
  the `users` table and `requireUser` middleware this one produces.
