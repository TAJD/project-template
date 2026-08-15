import { Hono } from 'hono';
import type { RateLimitBindings } from './lib/rate-limit';

export interface Env extends RateLimitBindings {
  ASSETS: Fetcher;
  LOG_LEVEL?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
