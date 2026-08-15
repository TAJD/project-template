// Submits the site's sitemap-eligible routes to IndexNow (https://www.indexnow.org)
// so search engines can be notified of new/changed pages without waiting for a crawl.
//
// Deploying with a real key requires two things beyond this script:
//   1. Set the INDEXNOW_KEY env var to your IndexNow key.
//   2. Place a `public/<key>.txt` file in apps/web/public/ containing just the key,
//      so it is served at https://<host>/<key>.txt as IndexNow requires.
// No fake key/key file is included here — this is a template with no real domain yet.
//
// This script is intentionally NOT part of `pnpm check` or the build — it's meant to
// be invoked as a separate, main-branch-gated CI step (wiring that step is out of
// scope for this ticket).

import { pathToFileURL } from 'node:url';
import { buildSitemapEntries } from '@template/shared';
import { routes } from '../apps/web/src/seo.config.ts';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

// Placeholder origin — replace with the site's real deployed origin at stamp-time,
// mirrors the convention in packages/shared/src/head-tags.ts.
const BASE_URL = 'https://example.com';

export async function submitToIndexNow(key, baseUrl = BASE_URL) {
  const host = new URL(baseUrl).host;
  const entries = buildSitemapEntries(routes);
  const urlList = entries.map((entry) => new URL(entry.loc, baseUrl).toString());

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${baseUrl}/${key}.txt`,
      urlList,
    }),
  });

  if (!response.ok) {
    throw new Error(`IndexNow submission failed: ${response.status} ${response.statusText}`);
  }

  return urlList;
}

async function main() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.log('INDEXNOW_KEY not set — skipping IndexNow submission.');
    process.exit(0);
  }

  const urlList = await submitToIndexNow(key);
  console.log(`Submitted ${urlList.length} URL(s) to IndexNow.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
