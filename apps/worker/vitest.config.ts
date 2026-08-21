import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      // PT-15's narrative story-test suite lives at the repo root
      // (`tests/integration/`, not under `apps/worker/src/`) so it reads as
      // whole-system behaviour rather than one module's unit tests, but it
      // needs the same real workerd + D1 environment this project already
      // has configured here — pointing this pool at both globs, rather than
      // standing up a second vitest-pool-workers config, is the
      // least-surprising way to get it running in `pnpm check` without
      // duplicating the wrangler/miniflare wiring.
      include: ['src/**/*.{test,spec}.ts', '../../tests/integration/**/*.{test,spec}.ts'],
      setupFiles: ['./src/test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            // TEST_AUTH_TOKEN is injected here rather than in wrangler.toml
            // so it never ships with a deploy — see the comment in
            // wrangler.toml and modules/auth/test-auth.ts.
            bindings: { TEST_MIGRATIONS: migrations, TEST_AUTH_TOKEN: 'local-test-auth-token' },
            // DATA_BUCKET (see modules/r2-proxy/) ships commented out in
            // wrangler.toml so deploys opt in explicitly, but the test env
            // still needs a working local bucket to exercise the module —
            // miniflare provisions an in-memory one keyed by binding name.
            r2Buckets: ['DATA_BUCKET'],
          },
        },
      },
    },
  };
});
