---
title: R2 range-request proxy module
description: A read-only /data/* route serving R2 objects with correct HTTP range support, for anything that seeks into a large object. Opt-in — it 404s until a bucket is bound.
sidebar:
  order: 5
---

A read-only `/data/*` route that serves R2 objects with correct HTTP range
support: `Accept-Ranges`, `206` responses with `Content-Range`, suffix ranges
(`bytes=-N`), `HEAD` returning `Content-Length`, and CORS with
`Access-Control-Expose-Headers` so a cross-origin reader can actually read
those headers back.

Almost anything that seeks into a large object needs this — `<video>`/`<audio>`
scrubbing, resumable downloads, and especially client-side analytics
(duckdb-wasm, Parquet, Arrow): the failure mode when range support is wrong
isn't an error, it's a correct-but-catastrophically-slow whole-object fetch on
every read, which doesn't show up in tests that only assert correctness.

Opt-in: with `DATA_BUCKET` unset (the default), every request 404s, so a
project that hasn't provisioned a bucket yet still builds, deploys, and tests
clean.

## Touch-points

- **`apps/worker/src/modules/r2-proxy/range.ts`** — pure `parseRange(header,
size)`, no I/O. Returns `{ type: 'none' | 'single' | 'unsatisfiable' }`.
- **`apps/worker/src/modules/r2-proxy/routes.ts`** — the Hono sub-app
  (`r2Proxy`) mounted at `/data`.
- **`apps/worker/src/index.ts`** — one `app.route('/data', r2Proxy)` line.
- **`apps/worker/src/env.ts`** — `DATA_BUCKET?: R2Bucket` on `Env`.
- **`apps/worker/wrangler.toml`** — commented-out `[[r2_buckets]]` block.
- **`apps/worker/vitest.config.ts`** — `r2Buckets: ['DATA_BUCKET']` under
  `miniflare`, so the test environment has a working local bucket even though
  the real binding ships commented out.

## Removal steps

1. Delete `apps/worker/src/modules/r2-proxy/`.
2. In `apps/worker/src/index.ts`, remove the `r2Proxy` import and the
   `app.route('/data', r2Proxy)` line.
3. Remove the `DATA_BUCKET?: R2Bucket` field from `apps/worker/src/env.ts`.
4. Remove the commented `[[r2_buckets]]` block from `apps/worker/wrangler.toml`.
5. Remove `r2Buckets: ['DATA_BUCKET']` from `apps/worker/vitest.config.ts`.
6. Delete this page (`apps/docs/src/content/docs/modules/r2-proxy.md`) and the links
   to it from the modules index and the new-project checklist — a broken internal
   link fails the docs build.
7. Run `pnpm check` to confirm the rest of the suite is still green with the
   module gone.

## Enabling it for a real deployment

1. `wrangler r2 bucket create <bucket-name>`.
2. Uncomment the `[[r2_buckets]]` block in `apps/worker/wrangler.toml` and set
   `bucket_name`.
3. Deploy. `DATA_BUCKET` is now bound and `/data/*` serves real objects.

## This route is public

`/data/*` has no auth check and serves with `access-control-allow-origin: *`.
Any object put in `DATA_BUCKET` is readable by anyone who has (or guesses) its
key, from any origin — the account module's sessions do not gate this route.
Don't put anything non-public in `DATA_BUCKET`; if a project needs access
control on served objects, add it to this module before enabling it.

## Same-origin content safety

This route serves whatever `Content-Type` was set when an object was written
to R2, on the app's own origin — the same origin the auth module's session
cookies live on. Every response forces `Content-Disposition: attachment`,
`X-Content-Type-Options: nosniff`, and `Content-Security-Policy: sandbox`, so
an object stored with (or overridden to) a renderable content-type like
`text/html` can't execute as this origin if someone links or navigates to it
directly. `attachment` only affects top-level navigation — it doesn't block
subresource loads (`<video src>`, `<img src>`, `fetch()`), so this doesn't
interfere with the module's own use cases.

## Cache-control

Object keys under `snapshots/`, `events/`, or `raw/` — partitions this module
assumes are written once and never mutated in place — get
`public, max-age=31536000, immutable`. Every other key gets a short
`public, max-age=300`, so a re-served/overwritten object doesn't stay stale in
intermediate caches. Adjust `IMMUTABLE_PREFIXES` in `routes.ts` to match your
own bucket layout.

## Known limitation

The two `HEAD /data/*` tests in `routes.test.ts` are skipped. An HTTP request
with method `HEAD` that reads R2 storage crashes
`@cloudflare/vitest-pool-workers@0.9.14`'s isolated-storage teardown —
confirmed with a minimal repro (a bare Hono app doing nothing but one
`bucket.head()` call, no ranges, no route mounting) that it's the HEAD
method itself tripping the pop assertion, not this module's code. The
identical R2 read through a GET request is fully covered by the tests above
and passes clean. This reproduces on both Windows and Linux CI (see
[developing on Windows](../../start/windows-notes/) for the separate, Windows-only
R2 teardown flake this module also ran into). Fixing the HEAD issue needs a
`vitest-pool-workers` version that requires vitest `^4.1.0`; this repo pins
vitest `^2.1.x` workspace-wide, so the upgrade is out of scope here — tracked
on the PT-50 epic's decision log. Re-enable the two skipped tests once that
upgrade happens.
