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
  // Tier-1 test auth (local/CI only, see modules/auth/test-auth.ts): a plain
  // var, not a secret — it's only useful at all on a hostname
  // `isLocalRequest()` accepts, so its value being visible in wrangler.toml
  // isn't a real exposure.
  TEST_AUTH_TOKEN?: string;
  // Tier-2 test auth (prod-capable): a real Worker secret
  // (`wrangler secret put TEST_LOGIN_SECRET`), unset by default so the
  // `/api/test-auth/prod-login` route 404s until a deployment deliberately
  // opts in.
  TEST_LOGIN_SECRET?: string;
}
