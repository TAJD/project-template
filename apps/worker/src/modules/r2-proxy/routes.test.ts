import { describe, expect, it } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../index';

async function run(request: Request, overrideEnv: typeof env = env) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, overrideEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

const BODY = 'the quick brown fox jumps over the lazy dog';

// Seeded per-test (not in a beforeEach) — vitest-pool-workers' isolated
// storage tracks mutations per test "task", and a beforeEach write can land
// outside the task boundary a given test rolls back against.
async function seed() {
  const bucket = env.DATA_BUCKET;
  if (!bucket) throw new Error('DATA_BUCKET is not configured in the test environment');
  await bucket.put('hello.txt', BODY);
  await bucket.put('snapshots/2026-01-01.json', '{}');
}

describe('GET /data/*', () => {
  it('returns 404 when the DATA_BUCKET binding is not configured', async () => {
    const res = await run(new Request('http://localhost/data/hello.txt'), {
      ...env,
      DATA_BUCKET: undefined,
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a missing key', async () => {
    const res = await run(new Request('http://localhost/data/does-not-exist.txt'));
    expect(res.status).toBe(404);
  });

  it('serves the whole object with Accept-Ranges and CORS-exposed headers', async () => {
    await seed();
    const res = await run(new Request('http://localhost/data/hello.txt'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(BODY);
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('content-length')).toBe(String(BODY.length));
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-expose-headers')).toContain('Content-Range');
    expect(res.headers.get('access-control-expose-headers')).toContain('ETag');
  });

  it('falls back to a default filename for a key with no basename', async () => {
    const bucket = env.DATA_BUCKET;
    if (!bucket) throw new Error('DATA_BUCKET is not configured in the test environment');
    await bucket.put('dir/', 'placeholder');
    const res = await run(new Request('http://localhost/data/dir/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="download"');
    await res.text();
  });

  it('forces attachment disposition and blocks MIME sniffing, so a maliciously-typed object cannot render as this origin', async () => {
    const bucket = env.DATA_BUCKET;
    if (!bucket) throw new Error('DATA_BUCKET is not configured in the test environment');
    await bucket.put('evil.txt', '<script>alert(document.cookie)</script>', {
      httpMetadata: { contentType: 'text/html' },
    });
    const res = await run(new Request('http://localhost/data/evil.txt'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="evil.txt"');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBe('sandbox');
    await res.text();
  });

  it('serves a closed byte range as 206 with Content-Range', async () => {
    await seed();
    const res = await run(
      new Request('http://localhost/data/hello.txt', { headers: { range: 'bytes=4-8' } }),
    );
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('quick');
    expect(res.headers.get('content-range')).toBe(`bytes 4-8/${BODY.length}`);
    expect(res.headers.get('content-length')).toBe('5');
  });

  it('serves a suffix range', async () => {
    await seed();
    const res = await run(
      new Request('http://localhost/data/hello.txt', { headers: { range: 'bytes=-3' } }),
    );
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('dog');
  });

  it('returns 416 for an unsatisfiable range', async () => {
    await seed();
    const res = await run(
      new Request('http://localhost/data/hello.txt', {
        headers: { range: `bytes=${BODY.length + 10}-${BODY.length + 20}` },
      }),
    );
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe(`bytes */${BODY.length}`);
  });

  it('uses the immutable cache-control for a snapshots/ key', async () => {
    await seed();
    const res = await run(new Request('http://localhost/data/snapshots/2026-01-01.json'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    await res.text();
  });

  it('uses the default cache-control for any other key', async () => {
    await seed();
    const res = await run(new Request('http://localhost/data/hello.txt'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    await res.text();
  });
});

// Skipped: an HTTP request with method 'HEAD' that reads R2 storage crashes
// @cloudflare/vitest-pool-workers@0.9.14's isolated-storage teardown here —
// confirmed via a minimal repro (a bare Hono app with a single bucket.head()
// call and no other logic, no route mounting, no ranges) that it's the HEAD
// method itself tripping the pop assertion, not this module's code: the
// identical bucket read through a GET request in the describe block above is
// fully covered and passes clean. Fixing this needs a vitest-pool-workers
// major bump that requires vitest ^4.1.0 (this repo pins vitest ^2.1.x
// everywhere) — out of proportion to this module. See PT-44 decision log on
// the PT-50 epic. Re-enable once the workspace can move to that vitest line.
describe('HEAD /data/*', () => {
  it.skip('returns headers without a body for the whole object', async () => {
    await seed();
    const res = await run(new Request('http://localhost/data/hello.txt', { method: 'HEAD' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
    expect(res.headers.get('content-length')).toBe(String(BODY.length));
  });

  it.skip('returns 206 headers without a body for a byte range', async () => {
    await seed();
    const res = await run(
      new Request('http://localhost/data/hello.txt', {
        method: 'HEAD',
        headers: { range: 'bytes=0-3' },
      }),
    );
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('');
    expect(res.headers.get('content-length')).toBe('4');
  });
});
