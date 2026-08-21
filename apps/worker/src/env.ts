import type { RateLimitBindings } from './lib/rate-limit';

export interface Env extends RateLimitBindings {
  ASSETS: Fetcher;
  DB: D1Database;
  LOG_LEVEL?: string;
  // Presence of RESEND_API_KEY is the dev/prod signal for the email module:
  // unset -> DevMailboxSender (writes to `dev_emails`, `/api/dev/mailbox`
  // stays live); set -> ResendSender (real sends, `/api/dev/mailbox` 404s).
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  // Tier-1 test auth (local/CI only, see modules/auth/test-auth.ts). Supplied
  // by `.dev.vars` locally and by vitest.config.ts's miniflare bindings in
  // CI — never by wrangler.toml [vars] or `wrangler secret put`, so a
  // deployed Worker has it unset and the route 404s on that alone, before
  // `isLocalRequest()` is even considered.
  TEST_AUTH_TOKEN?: string;
  // Tier-2 test auth (prod-capable): a real Worker secret
  // (`wrangler secret put TEST_LOGIN_SECRET`), unset by default so the
  // `/api/test-auth/prod-login` route 404s until a deployment deliberately
  // opts in.
  TEST_LOGIN_SECRET?: string;
  // Billing module (see modules/billing/, apps/docs/src/content/docs/modules/billing.md). Both are
  // Worker secrets (`wrangler secret put STRIPE_SECRET_KEY` /
  // `STRIPE_WEBHOOK_SECRET`), never wrangler.toml vars — unset in every
  // local/CI environment, which is what tests override per-request instead.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  // The single subscription price this example site offers. A plain var
  // (not a secret) — it identifies a product, not a credential.
  STRIPE_PRICE_ID?: string;
  // R2 range-request proxy module (see modules/r2-proxy/,
  // apps/docs/src/content/docs/modules/r2-proxy.md). Optional — the route 404s on every request
  // when unset, so a project that hasn't provisioned a bucket yet still
  // builds and tests clean.
  DATA_BUCKET?: R2Bucket;
}
