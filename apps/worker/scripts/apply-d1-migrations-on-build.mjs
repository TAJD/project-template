import { spawnSync } from 'node:child_process';

// Cloudflare Workers Builds sets WORKERS_CI_BRANCH to the branch being
// built. Gating on it here (rather than always running migrations) means
// local `pnpm build`/`wrangler dev` and PR preview builds never touch the
// remote D1 database — only a Workers Builds run against `main` does.
// Confirm this exact env var name against the Cloudflare dashboard docs for
// your account before relying on it in production; it is not covered by
// this repo's test suite since it depends on the Workers Builds runtime.
const branch = process.env.WORKERS_CI_BRANCH;

if (branch !== 'main') {
  console.log(
    `apply-d1-migrations-on-build: WORKERS_CI_BRANCH is ${branch ?? '(unset)'}, not "main" — skipping D1 migrations.`,
  );
  process.exit(0);
}

console.log('apply-d1-migrations-on-build: running on main, applying D1 migrations...');
const result = spawnSync(
  'pnpm',
  ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote'],
  {
    stdio: 'inherit',
    shell: true,
  },
);

process.exit(result.status ?? 1);
