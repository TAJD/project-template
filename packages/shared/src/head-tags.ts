import type { RouteMeta } from './seo-types.js';

// Placeholder origin used to build canonical URLs when no real deployed
// origin is supplied. Callers (the prerender script, page-level head
// updates) should pass the site's actual base URL.
export const DEFAULT_BASE_URL = 'https://example.com';

export function renderHeadTags(meta: RouteMeta, baseUrl: string = DEFAULT_BASE_URL): string {
  const lines: string[] = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
  ];

  if (meta.ogImage) {
    lines.push(`<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />`);
  }

  if (meta.noindex) {
    lines.push('<meta name="robots" content="noindex" />');
  }

  const canonicalUrl = new URL(meta.path, baseUrl).toString();
  lines.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

  // Autodiscovery links so feed readers/browsers can find the site's syndication
  // feeds from any page's <head> — feed paths are fixed at the site root by
  // apps/web/scripts/generate-feeds.mjs.
  lines.push(
    `<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${escapeHtml(new URL('/feed.xml', baseUrl).toString())}" />`,
  );
  lines.push(
    `<link rel="alternate" type="application/atom+xml" title="Atom Feed" href="${escapeHtml(new URL('/atom.xml', baseUrl).toString())}" />`,
  );

  for (const entry of meta.jsonLd ?? []) {
    lines.push(`<script type="application/ld+json">${escapeJsonLd(entry)}</script>`);
  }

  return lines.join('\n');
}

// JSON-LD must not be HTML-escaped (that would corrupt the data), so instead
// escape the characters that could terminate the <script> block or open an HTML
// comment as JSON unicode escapes — same decoded values, inert as markup.
function escapeJsonLd(entry: object): string {
  return JSON.stringify(entry)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
