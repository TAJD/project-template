import { Hono } from 'hono';
import type { Env } from './env';
import { auth, account, devMailbox, testAuth } from './modules/auth';
import { billing } from './modules/billing';
import { r2Proxy } from './modules/r2-proxy';

export type { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/auth', auth);
app.route('/api/account', account);
app.route('/api/dev', devMailbox);
app.route('/api/test-auth', testAuth);
app.route('/api/billing', billing);
app.route('/data', r2Proxy);

export default app;
