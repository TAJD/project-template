import { Hono } from 'hono';
import type { Env } from './env';
import { auth, devMailbox } from './modules/auth';

export type { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/auth', auth);
app.route('/api/dev', devMailbox);

export default app;
