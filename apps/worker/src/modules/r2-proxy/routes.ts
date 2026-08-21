import { Hono, type Context } from 'hono';
import type { Env } from '../../env';
import { notFound, serverError } from '../../lib/errors';
import { parseRange } from './range';

export const r2Proxy = new Hono<{ Bindings: Env }>();

// Partitions that are written once and never mutated in place get a
// long-lived immutable cache; everything else gets a short TTL so a
// re-served/overwritten object doesn't stay stale in intermediate caches.
const IMMUTABLE_PREFIXES = ['snapshots/', 'events/', 'raw/'];
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const DEFAULT_CACHE_CONTROL = 'public, max-age=300';

function cacheControlFor(key: string): string {
  return IMMUTABLE_PREFIXES.some((prefix) => key.startsWith(prefix))
    ? IMMUTABLE_CACHE_CONTROL
    : DEFAULT_CACHE_CONTROL;
}

// Range and Content-Range aren't in the CORS-safelisted response-header set,
// so a cross-origin reader (e.g. duckdb-wasm) can request them fine but
// can't *read* them back off the response without this — the fetch silently
// looks like it worked while every range-aware caller falls back to
// whole-object reads.
//
// content-disposition/x-content-type-options/content-security-policy: this
// route serves whatever content-type was set when an object was written to
// R2, on the app's own origin. Without these, an object stored with e.g.
// content-type: text/html would render (and execute) as this origin — same
// cookie jar as the auth module's sessions — if anyone linked or navigated
// to it directly. "attachment" only affects top-level navigation, not
// subresource loads (<video src>, <img src>, fetch()), so it doesn't break
// this module's own use cases (media scrubbing, duckdb-wasm reads).
function baseHeaders(key: string, size: number, contentType: string, etag: string): HeadersInit {
  const filename = key.slice(key.lastIndexOf('/') + 1).replace(/"/g, '') || 'download';
  return {
    'accept-ranges': 'bytes',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'Accept-Ranges, Content-Range, Content-Length, ETag',
    'content-type': contentType,
    'content-disposition': `attachment; filename="${filename}"`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': 'sandbox',
    'cache-control': cacheControlFor(key),
    etag,
  };
}

async function handle(c: Context<{ Bindings: Env }>, method: 'GET' | 'HEAD') {
  const bucket = c.env.DATA_BUCKET;
  if (!bucket) return notFound().error;

  const key = c.req.param('key');
  if (!key) return notFound().error;

  try {
    const head = await bucket.head(key);
    if (!head) return notFound().error;

    const size = head.size;
    const contentType = head.httpMetadata?.contentType ?? 'application/octet-stream';
    const headers = baseHeaders(key, size, contentType, head.httpEtag);
    const range = parseRange(c.req.header('range'), size);

    if (range.type === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'content-range': `bytes */${size}` },
      });
    }

    if (range.type === 'none') {
      if (method === 'HEAD') {
        return new Response(null, { headers: { ...headers, 'content-length': String(size) } });
      }
      const object = await bucket.get(key);
      if (!object) return notFound().error;
      // Content-length comes from this fetch's own size, not the earlier
      // head() snapshot — if the object was overwritten with a different
      // size in between, trusting the stale size promises a body length
      // that this stream won't actually deliver, and the client stalls.
      return new Response(object.body, {
        headers: { ...headers, 'content-length': String(object.size) },
      });
    }

    const { start, end } = range;
    const length = end - start + 1;

    if (method === 'HEAD') {
      return new Response(null, {
        status: 206,
        headers: {
          ...headers,
          'content-range': `bytes ${start}-${end}/${size}`,
          'content-length': String(length),
        },
      });
    }
    const object = await bucket.get(key, { range: { offset: start, length } });
    if (!object) return notFound().error;
    // Same staleness guard as above, for the ranged case: derive the
    // headers from what R2 actually served (object.range), not from the
    // pre-fetch head() size.
    const servedRange = object.range;
    const servedOffset =
      servedRange && 'offset' in servedRange && typeof servedRange.offset === 'number'
        ? servedRange.offset
        : start;
    const servedLength =
      servedRange && 'length' in servedRange && typeof servedRange.length === 'number'
        ? servedRange.length
        : length;
    return new Response(object.body, {
      status: 206,
      headers: {
        ...headers,
        'content-range': `bytes ${servedOffset}-${servedOffset + servedLength - 1}/${object.size}`,
        'content-length': String(servedLength),
      },
    });
  } catch (err) {
    return serverError(err, c.env.LOG_LEVEL).error;
  }
}

// A named param with a `.+` constraint (rather than a bare `*`) is what
// makes the key available via c.req.param('key') once this app is mounted
// under a prefix with app.route() — a wildcard's capture isn't addressable
// the same way through a mounted sub-app.
r2Proxy.get('/:key{.+}', (c) => handle(c, 'GET'));
r2Proxy.on('HEAD', '/:key{.+}', (c) => handle(c, 'HEAD'));
