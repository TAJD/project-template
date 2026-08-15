import type { RouteMeta } from './seo-types.js';

// Placeholder origin used to build canonical URLs when no real deployed
// origin is supplied. Callers (the prerender script, page-level head
// updates) should pass the site's actual base URL.
const DEFAULT_BASE_URL = 'https://example.com';

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

  const canonicalUrl = new URL(meta.path, baseUrl).toString();
  lines.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

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
