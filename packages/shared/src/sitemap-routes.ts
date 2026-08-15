export type SitemapEntry = { loc: string; lastmod?: string };

export function buildSitemapEntries(routes: { path: string }[]): SitemapEntry[] {
  return routes.map((route) => ({ loc: route.path }));
}

export function renderSitemapXml(entries: SitemapEntry[], baseUrl: string): string {
  const urlTags = entries
    .map((entry) => {
      const loc = new URL(entry.loc, baseUrl).toString();
      const lastmodTag = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlTags}\n</urlset>\n`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
