import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { renderHeadTags } from '@template/shared';
// Node's built-in TS type-stripping (default-on from 22.18) resolves this
// .ts import at runtime — see root package.json's engines.node.
import { routes as staticRoutes } from '../src/seo.config.ts';
// See generate-sitemap.mjs for why this script reads blog frontmatter off
// disk instead of importing the blog module directly.
import { loadPublishedBlogEntries } from './lib/blog-content.mjs';
import { buildBlogRoutes } from '../src/modules/blog/build-routes.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const distDir = path.join(webDir, 'dist');
const distIndexPath = path.join(distDir, 'index.html');
const blogContentDir = path.resolve(webDir, '..', '..', 'content', 'blog');

const START_MARKER = '<!-- seo:head:start -->';
const END_MARKER = '<!-- seo:head:end -->';

export function injectHeadTags(html, headContent) {
  const startIndex = html.indexOf(START_MARKER);
  const endIndex = html.indexOf(END_MARKER);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Could not find ${START_MARKER} / ${END_MARKER} markers in HTML`);
  }
  const before = html.slice(0, startIndex + START_MARKER.length);
  const after = html.slice(endIndex);
  return `${before}\n${headContent}\n${after}`;
}

// Every registered route gets its own static HTML file so crawlers (and the
// Cloudflare assets binding, which serves `/blog/x` from `/blog/x/index.html`)
// see that route's real title/description/canonical/JSON-LD instead of the
// home page's. The body stays the client-rendered SPA shell.
export function outputPathForRoute(distRoot, routePath) {
  const trimmed = routePath.replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return path.join(distRoot, 'index.html');
  return path.join(distRoot, ...trimmed.split('/'), 'index.html');
}

function main() {
  if (!existsSync(distIndexPath)) {
    console.error(`dist/index.html not found at ${distIndexPath}. Run vite build first.`);
    process.exit(1);
  }

  const blogRoutes = buildBlogRoutes(loadPublishedBlogEntries(blogContentDir));
  const routes = [...staticRoutes, ...blogRoutes];

  if (!routes.some((route) => route.path === '/')) {
    console.error('No route registered for "/" — cannot prerender the SPA shell.');
    process.exit(1);
  }

  // Read the untouched shell once; each route is rendered from it so the
  // markers are still present for every write, including index.html's own.
  const shell = readFileSync(distIndexPath, 'utf-8');

  for (const route of routes) {
    const html = injectHeadTags(shell, renderHeadTags(route));
    const outputPath = outputPathForRoute(distDir, route.path);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, html, 'utf-8');
  }

  console.log(`Prerendered head tags for ${routes.length} route(s) into dist/`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
