import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildSitemapEntries, renderSitemapXml } from '@template/shared';
import { routes } from '../src/seo.config.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const sitemapPath = path.join(webDir, 'dist', 'sitemap.xml');

// Placeholder origin used until the site is deployed to a real domain — mirrors
// the convention in packages/shared/src/head-tags.ts.
const BASE_URL = 'https://example.com';

function main() {
  const entries = buildSitemapEntries(routes);
  const xml = renderSitemapXml(entries, BASE_URL);
  writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`Wrote sitemap with ${entries.length} route(s) to dist/sitemap.xml`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
