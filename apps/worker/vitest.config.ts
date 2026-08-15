import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ['./src/test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            // TEST_AUTH_TOKEN is injected here rather than in wrangler.toml
            // so it never ships with a deploy — see the comment in
            // wrangler.toml and modules/auth/test-auth.ts.
            bindings: { TEST_MIGRATIONS: migrations, TEST_AUTH_TOKEN: 'local-test-auth-token' },
          },
        },
      },
    },
  };
});
