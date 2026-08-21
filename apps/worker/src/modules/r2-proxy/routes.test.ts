import { beforeEach, describe, expect, it } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../index';

// On Windows, this suite's R2 seeding can hit the isolated-storage EBUSY
// teardown failure documented in docs/windows-notes.md — tests here pass,
// the run itself can fail during rollback. Not reproduced on the ubuntu CI
// runner this template uses. isolatedStorage: false would fix it but isn't
// safe to set worker-wide (see that doc), and this project has no per-file
// override, so it's left as a known Windows-local flake rather than worked
// around here.

async function run(request: Request, overrideEnv: typeof env = env) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, overrideEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

const BODY = 'the quick brown fox jumps over the lazy dog';

beforeEach(async () => {
  const bucket = env.DATA_BUCKET;
  if (!bucket) throw new Error('DATA_BUCKET is not configured in the test environment');
  await bucket.put('hello.txt', BODY);
  await bucket.put('snapshots/2026-01-01.json', '{}');
});

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
    const res = await run(new Request('http://localhost/data/hello.txt'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(BODY);
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('content-length')).toBe(String(BODY.length));
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-expose-headers')).toContain('Content-Range');
  });

  it('serves a closed byte range as 206 with Content-Range', async () => {
    const res = await run(
      new Request('http://localhost/data/hello.txt', { headers: { range: 'bytes=4-8' } }),
    );
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('quick');
    expect(res.headers.get('content-range')).toBe(`bytes 4-8/${BODY.length}`);
    expect(res.headers.get('content-length')).toBe('5');
  });

  it('serves a suffix range', async () => {
    const res = await run(
      new Request('http://localhost/data/hello.txt', { headers: { range: 'bytes=-3' } }),
    );
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('dog');
  });

  it('returns 416 for an unsatisfiable range', async () => {
    const res = await run(
      new Request('http://localhost/data/hello.txt', {
        headers: { range: `bytes=${BODY.length + 10}-${BODY.length + 20}` },
      }),
    );
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe(`bytes */${BODY.length}`);
  });

  it('uses the immutable cache-control for a snapshots/ key', async () => {
    const res = await run(new Request('http://localhost/data/snapshots/2026-01-01.json'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('uses the default cache-control for any other key', async () => {
    const res = await run(new Request('http://localhost/data/hello.txt'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });
});

describe('HEAD /data/*', () => {
  it('returns headers without a body for the whole object', async () => {
    const res = await run(new Request('http://localhost/data/hello.txt', { method: 'HEAD' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
    expect(res.headers.get('content-length')).toBe(String(BODY.length));
  });

  it('returns 206 headers without a body for a byte range', async () => {
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
