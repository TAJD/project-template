import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { renderHeadTags } from '@template/shared';
// Node's built-in TS type-stripping (default-on from 22.18) resolves this
// .ts import at runtime — see root package.json's engines.node.
import { routes } from '../src/seo.config.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const distIndexPath = path.join(webDir, 'dist', 'index.html');

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

// dist/index.html is a client-rendered SPA shell — <div id="root"></div> is
// empty until React hydrates, so it has nothing for Pagefind (which reads
// static HTML) to index. Give it a hidden, real (non-fake) snapshot of the
// home route's title/description so the site has at least one indexable page.
export function injectBodyContent(html, bodyContent) {
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex === -1) {
    throw new Error('Could not find </body> in HTML');
  }
  return `${html.slice(0, bodyCloseIndex)}${bodyContent}\n${html.slice(bodyCloseIndex)}`;
}

function main() {
  if (!existsSync(distIndexPath)) {
    console.error(`dist/index.html not found at ${distIndexPath}. Run vite build first.`);
    process.exit(1);
  }

  const homeRoute = routes.find((route) => route.path === '/');
  if (!homeRoute) {
    console.error('No route registered for "/" — cannot prerender home head tags.');
    process.exit(1);
  }

  const headContent = renderHeadTags(homeRoute);
  const html = readFileSync(distIndexPath, 'utf-8');
  const withHead = injectHeadTags(html, headContent);
  const bodyContent = `<div data-pagefind-body hidden><h1>${escapeHtml(homeRoute.title)}</h1><p>${escapeHtml(homeRoute.description)}</p></div>`;
  const updated = injectBodyContent(withHead, bodyContent);
  writeFileSync(distIndexPath, updated, 'utf-8');
  console.log(`Prerendered head tags for "${homeRoute.path}" into dist/index.html`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
