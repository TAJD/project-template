import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { DEFAULT_BASE_URL } from '@template/shared';
// This script runs under plain `node` (see the comment in generate-sitemap.mjs
// for why), so it reads published post frontmatter off disk via the same
// loader rather than importing posts.ts's Vite-only virtual module.
import { loadPublishedBlogEntries } from './lib/blog-content.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const distDir = path.join(webDir, 'dist');
const blogContentDir = path.resolve(webDir, '..', '..', 'content', 'blog');

const SITE_TITLE = 'Exemplar';
const SITE_DESCRIPTION = 'A production-ready starting point for new products.';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(dateStr) {
  return new Date(dateStr).toUTCString();
}

function toIso8601(dateStr) {
  return new Date(dateStr).toISOString();
}

function latestUpdatedIso(entries) {
  if (entries.length === 0) return toIso8601(new Date());
  const dates = entries.map((entry) => entry.frontmatter.updatedDate ?? entry.frontmatter.pubDate);
  return toIso8601(dates.reduce((latest, date) => (date > latest ? date : latest)));
}

export function renderRssFeed(entries, baseUrl) {
  const items = entries
    .map((entry) => {
      const link = new URL(`/blog/${entry.slug}`, baseUrl).toString();
      return `    <item>
      <title>${escapeXml(entry.frontmatter.title)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(entry.frontmatter.description)}</description>
      <guid>${escapeXml(link)}</guid>
      <pubDate>${toRfc822(entry.frontmatter.pubDate)}</pubDate>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <link>${escapeXml(baseUrl)}</link>
${items}
  </channel>
</rss>
`;
}

export function renderAtomFeed(entries, baseUrl) {
  const feedLink = new URL('/atom.xml', baseUrl).toString();
  const items = entries
    .map((entry) => {
      const link = new URL(`/blog/${entry.slug}`, baseUrl).toString();
      const updated = toIso8601(entry.frontmatter.updatedDate ?? entry.frontmatter.pubDate);
      return `  <entry>
    <title>${escapeXml(entry.frontmatter.title)}</title>
    <link href="${escapeXml(link)}" />
    <id>${escapeXml(link)}</id>
    <updated>${updated}</updated>
    <summary>${escapeXml(entry.frontmatter.description)}</summary>
  </entry>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE_TITLE)}</title>
  <subtitle>${escapeXml(SITE_DESCRIPTION)}</subtitle>
  <link href="${escapeXml(feedLink)}" rel="self" />
  <link href="${escapeXml(baseUrl)}" />
  <id>${escapeXml(baseUrl)}</id>
  <updated>${latestUpdatedIso(entries)}</updated>
${items}
</feed>
`;
}

// Feed readers show items in document order, so newest first — matching the
// /blog listing rather than the alphabetical order the loader returns.
export function sortNewestFirst(entries) {
  return [...entries].sort((a, b) =>
    a.frontmatter.pubDate < b.frontmatter.pubDate
      ? 1
      : a.frontmatter.pubDate > b.frontmatter.pubDate
        ? -1
        : 0,
  );
}

function main() {
  const entries = sortNewestFirst(loadPublishedBlogEntries(blogContentDir));
  const rss = renderRssFeed(entries, DEFAULT_BASE_URL);
  const atom = renderAtomFeed(entries, DEFAULT_BASE_URL);
  writeFileSync(path.join(distDir, 'feed.xml'), rss, 'utf-8');
  writeFileSync(path.join(distDir, 'atom.xml'), atom, 'utf-8');
  console.log(`Wrote RSS feed (${entries.length} item(s)) to dist/feed.xml`);
  console.log(`Wrote Atom feed (${entries.length} item(s)) to dist/atom.xml`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
