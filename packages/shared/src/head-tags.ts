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
    lines.push(`<script type="application/ld+json">${JSON.stringify(entry)}</script>`);
  }

  return lines.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
