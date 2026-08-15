import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildSitemapEntries, renderSitemapXml } from '@template/shared';
import { routes as staticRoutes } from '../src/seo.config.ts';
// This script runs under plain `node` (via Node's built-in TS
// type-stripping), so it can't import the blog module directly — that
// pulls in posts.ts, which relies on Vite-only `import.meta.glob`/virtual
// modules. Read blog frontmatter off disk instead and build the same
// routes via the shared, pure buildBlogRoutes().
import { loadPublishedBlogEntries } from './lib/blog-content.mjs';
import { buildBlogRoutes } from '../src/modules/blog/build-routes.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const sitemapPath = path.join(webDir, 'dist', 'sitemap.xml');
const blogContentDir = path.resolve(webDir, '..', '..', 'content', 'blog');

// Placeholder origin used until the site is deployed to a real domain — mirrors
// the convention in packages/shared/src/head-tags.ts.
const BASE_URL = 'https://example.com';

function main() {
  const blogRoutes = buildBlogRoutes(loadPublishedBlogEntries(blogContentDir));
  const routes = [...staticRoutes, ...blogRoutes];
  const entries = buildSitemapEntries(routes);
  const xml = renderSitemapXml(entries, BASE_URL);
  writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`Wrote sitemap with ${entries.length} route(s) to dist/sitemap.xml`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
