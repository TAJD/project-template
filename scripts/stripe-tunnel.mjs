// Forwards Stripe webhook events to a local `wrangler dev` worker via the
// Stripe CLI, so `POST /api/billing/webhook` can be exercised end-to-end
// without a public URL. Requires the Stripe CLI (`stripe`) to be installed
// and logged in (`stripe login`) separately — this script does not install
// or authenticate it.
//
// Usage: node scripts/stripe-tunnel.mjs [worker-url]
// Defaults to http://localhost:8787, wrangler dev's default port.

import { spawn } from 'node:child_process';

const workerUrl = process.argv[2] ?? 'http://localhost:8787';
const forwardTo = `${workerUrl.replace(/\/$/, '')}/api/billing/webhook`;

console.log(`Forwarding Stripe webhook events to ${forwardTo}`);
console.log(
  'On startup, the Stripe CLI prints a webhook signing secret (whsec_...) — set that as ' +
    'STRIPE_WEBHOOK_SECRET for your local `wrangler dev` run (e.g. `wrangler dev --var ' +
    'STRIPE_WEBHOOK_SECRET:whsec_...`), since it is regenerated per `stripe listen` session ' +
    'and will not match a stale value.',
);

const child = spawn('stripe', ['listen', '--forward-to', forwardTo], { stdio: 'inherit' });

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error(
      'Could not find the `stripe` CLI. Install it from https://docs.stripe.com/stripe-cli ' +
        'and run `stripe login` first.',
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
