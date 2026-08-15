import type { RateLimitBindings } from './lib/rate-limit';

export interface Env extends RateLimitBindings {
  ASSETS: Fetcher;
  DB: D1Database;
  LOG_LEVEL?: string;
}
