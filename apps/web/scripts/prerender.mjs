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

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The built pages are client-rendered SPA shells — <div id="root"></div> is
// empty until React hydrates, so Pagefind (which reads static HTML) would find
// nothing to index. Append a hidden, real snapshot of the route's own content.
export function injectBodyContent(html, bodyContent) {
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex === -1) {
    throw new Error('Could not find </body> in HTML');
  }
  return `${html.slice(0, bodyCloseIndex)}${bodyContent}\n${html.slice(bodyCloseIndex)}`;
}

// Crude markdown-to-prose reduction, good enough for a search index: code
// blocks, table pipes and inline markers carry no useful search signal.
export function markdownToIndexableText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/gm, '')
    .replace(/[|>*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Every registered route gets its own static HTML file so crawlers (and the
// Cloudflare assets binding, which serves `/blog/x` from `/blog/x/index.html`)
// see that route's real title/description/canonical/JSON-LD instead of the
// home page's.
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

  const blogEntries = loadPublishedBlogEntries(blogContentDir);
  const routes = [...staticRoutes, ...buildBlogRoutes(blogEntries)];

  if (!routes.some((route) => route.path === '/')) {
    console.error('No route registered for "/" — cannot prerender the SPA shell.');
    process.exit(1);
  }

  const postBodyBySlug = new Map(
    blogEntries.map((entry) => [entry.slug, markdownToIndexableText(entry.content ?? '')]),
  );

  // Read the untouched shell once; each route is rendered from it so the
  // markers are still present for every write, including index.html's own.
  const shell = readFileSync(distIndexPath, 'utf-8');

  for (const route of routes) {
    const slug = route.path.startsWith('/blog/') ? route.path.slice('/blog/'.length) : undefined;
    const postBody = slug ? postBodyBySlug.get(slug) : undefined;
    const indexable = [
      `<h1>${escapeHtml(route.title)}</h1>`,
      `<p>${escapeHtml(route.description)}</p>`,
      ...(postBody ? [`<p>${escapeHtml(postBody)}</p>`] : []),
    ].join('');

    const withHead = injectHeadTags(shell, renderHeadTags(route));
    const html = injectBodyContent(withHead, `<div data-pagefind-body hidden>${indexable}</div>`);

    const outputPath = outputPathForRoute(distDir, route.path);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, html, 'utf-8');
  }

  console.log(`Prerendered ${routes.length} route(s) into dist/`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
