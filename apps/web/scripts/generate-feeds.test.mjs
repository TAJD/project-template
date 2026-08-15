import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderRssFeed, renderAtomFeed } from './generate-feeds.mjs';
import { loadPublishedBlogEntries } from './lib/blog-content.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const blogContentDir = path.resolve(scriptDir, '..', '..', '..', 'content', 'blog');
const BASE_URL = 'https://example.com';

// jsdom (the vitest environment for apps/web) provides a global DOMParser,
// which can also parse XML — used here to assert well-formedness and pick
// elements out of the generated feeds without adding an XML dependency.
function parseXml(xml) {
  const doc = new globalThis.DOMParser().parseFromString(xml, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror');
  return { doc, errors: parserError.length > 0 ? [parserError[0].textContent] : [] };
}

describe('feed generation against the real content directory', () => {
  const entries = loadPublishedBlogEntries(blogContentDir);

  it('loads at least one published post and excludes drafts', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => !entry.frontmatter.draft)).toBe(true);
    expect(entries.some((entry) => entry.slug === 'a-draft-post-in-progress')).toBe(false);
  });

  describe('RSS', () => {
    const xml = renderRssFeed(entries, BASE_URL);
    const { doc, errors } = parseXml(xml);

    it('is well-formed XML with the RSS 2.0 root element', () => {
      expect(errors).toEqual([]);
      expect(doc.documentElement.tagName).toBe('rss');
      expect(doc.documentElement.getAttribute('version')).toBe('2.0');
    });

    it('contains one <item> per published post with absolute links', () => {
      const items = doc.getElementsByTagName('item');
      expect(items.length).toBe(entries.length);
      for (const entry of entries) {
        const expectedLink = new URL(`/blog/${entry.slug}`, BASE_URL).toString();
        expect(xml).toContain(`<title>${entry.frontmatter.title}</title>`);
        expect(xml).toContain(`<link>${expectedLink}</link>`);
        expect(xml).toContain(`<guid>${expectedLink}</guid>`);
      }
    });

    it('formats pubDate as RFC 822', () => {
      const rfc822 = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;
      const pubDates = Array.from(doc.getElementsByTagName('pubDate')).map(
        (node) => node.textContent,
      );
      expect(pubDates.length).toBe(entries.length);
      for (const value of pubDates) {
        expect(value).toMatch(rfc822);
      }
    });

    it('excludes draft posts', () => {
      expect(xml).not.toContain('A draft post in progress');
    });
  });

  describe('Atom', () => {
    const xml = renderAtomFeed(entries, BASE_URL);
    const { doc, errors } = parseXml(xml);

    it('is well-formed XML with the Atom feed root element and namespace', () => {
      expect(errors).toEqual([]);
      expect(doc.documentElement.tagName).toBe('feed');
      expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2005/Atom');
    });

    it('contains one <entry> per published post with absolute links and ids', () => {
      const entryNodes = doc.getElementsByTagName('entry');
      expect(entryNodes.length).toBe(entries.length);
      for (const entry of entries) {
        const expectedLink = new URL(`/blog/${entry.slug}`, BASE_URL).toString();
        expect(xml).toContain(`<id>${expectedLink}</id>`);
        expect(xml).toContain(`href="${expectedLink}"`);
      }
    });

    it('formats updated as ISO 8601, preferring updatedDate over pubDate', () => {
      const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      const updated = Array.from(doc.getElementsByTagName('updated')).map(
        (node) => node.textContent,
      );
      expect(updated.length).toBeGreaterThan(0);
      for (const value of updated) {
        expect(value).toMatch(iso8601);
      }

      const withUpdatedDate = entries.find((entry) => entry.frontmatter.updatedDate);
      if (withUpdatedDate) {
        expect(xml).toContain(new Date(withUpdatedDate.frontmatter.updatedDate).toISOString());
      }
    });

    it('excludes draft posts', () => {
      expect(xml).not.toContain('A draft post in progress');
    });
  });
});
