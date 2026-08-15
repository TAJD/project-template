import { env, applyD1Migrations } from 'cloudflare:test';

// Runs once per test file, before its tests, against workerd's real D1
// implementation (not a mock). `isolatedStorage` (pool-workers default)
// snapshots storage after this runs, so every test in the file starts from
// a freshly migrated, empty database.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
