import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteUrl, extractLocsFromSitemap, extractHeadFields } from './seo-audit-live.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

test('resolveSiteUrl throws a clear error when SITE_URL is unset and no arg is given', () => {
  assert.throws(() => resolveSiteUrl(['node', 'seo-audit-live.mjs'], {}), /SITE_URL/);
});

test('resolveSiteUrl prefers a CLI arg, falls back to env, and strips trailing slash', () => {
  assert.equal(
    resolveSiteUrl(['node', 'seo-audit-live.mjs', 'https://example.com/'], {}),
    'https://example.com',
  );
  assert.equal(
    resolveSiteUrl(['node', 'seo-audit-live.mjs'], { SITE_URL: 'https://example.com' }),
    'https://example.com',
  );
});

test('extractLocsFromSitemap pulls every <loc> URL out of sitemap XML', () => {
  const xml =
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url><url><loc>https://example.com/blog</loc></url></urlset>';
  assert.deepEqual(extractLocsFromSitemap(xml), [
    'https://example.com/',
    'https://example.com/blog',
  ]);
});

test('extractHeadFields pulls title/description/og:image out of raw HTML', () => {
  const html =
    '<head><title>Exemplar</title><meta name="description" content="A description." /><meta property="og:image" content="/og/home.png" /></head>';
  assert.deepEqual(extractHeadFields(html), {
    title: 'Exemplar',
    description: 'A description.',
    ogImage: '/og/home.png',
  });
});

test('the CLI script exits non-zero with a clear message when SITE_URL is unset', () => {
  const env = { ...process.env };
  delete env.SITE_URL;

  assert.throws(
    () =>
      execFileSync('node', ['scripts/seo-audit-live.mjs'], {
        cwd: repoRoot,
        encoding: 'utf-8',
        env,
      }),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /SITE_URL/);
      return true;
    },
  );
});
