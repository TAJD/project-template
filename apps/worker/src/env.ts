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
}
