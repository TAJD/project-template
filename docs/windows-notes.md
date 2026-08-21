# Windows-specific gotchas

Issues that only reproduce on Windows, kept out of the shared config/docs above
because they don't apply on the Linux runners this template's CI uses.

## `@cloudflare/vitest-pool-workers` + an R2 bucket binding: "Isolated storage failed"

**Symptom:** with an R2 bucket binding and `@cloudflare/vitest-pool-workers`
default settings, a test run ends with:

```
Error: Isolated storage failed. There should be additional logs above.
  at WorkersTestRunner.updateStackedStorage
```

The tests themselves pass; the _suite_ fails. The "additional logs above" are,
on Windows:

```
EBUSY: resource busy or locked, unlink
  ...\miniflare-<hash>\r2\miniflare-R2BucketObject\<hash>.sqlite
```

**Cause:** isolated storage snapshots by unlinking miniflare's backing SQLite
file between suites. Windows won't unlink a file whose handle is still open,
so the rollback fails. It reproduces with `beforeAll` and `beforeEach` seeding
alike, which makes the seeding pattern a red herring when diagnosing it.

**Workaround**, in the affected `vitest.config.ts`:

```ts
export default defineWorkersConfig({
  test: { poolOptions: { workers: { isolatedStorage: false } } },
});
```

Safe when tests seed distinct keys and don't mutate shared state. Do **not**
set this template-wide — it's a real safety property for suites that do
mutate shared state, and this template ships no R2 binding by default.

**Verified:** the failure, the EBUSY cause, and that `isolatedStorage: false`
resolves it — on Windows 11, `@cloudflare/vitest-pool-workers` 0.9.14,
wrangler 4.105.0.

**Inferred, not verified:** that this is Windows-specific — not reproduced on
Linux/macOS. This template's CI workflow targets `ubuntu`, so CI would likely
never see it either way, which is exactly why this is documented here rather
than baked into the shared vitest config.
