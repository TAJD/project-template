import { describe, expect, it } from 'vitest';
import { buildSitemapEntries, renderSitemapXml } from './sitemap-routes.js';

describe('buildSitemapEntries', () => {
  it('maps route paths to sitemap entries', () => {
    const entries = buildSitemapEntries([{ path: '/' }, { path: '/about' }]);
    expect(entries).toEqual([{ loc: '/' }, { loc: '/about' }]);
  });
});

describe('renderSitemapXml', () => {
  it('produces a well-formed urlset with absolute locs for each entry', () => {
    const xml = renderSitemapXml([{ loc: '/' }, { loc: '/about' }], 'https://example.com');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<loc>https://example.com/about</loc>');
    expect(xml).toContain('</urlset>');
  });

  it('includes lastmod when provided', () => {
    const xml = renderSitemapXml([{ loc: '/', lastmod: '2026-01-01' }], 'https://example.com');
    expect(xml).toContain('<lastmod>2026-01-01</lastmod>');
  });

  it('omits lastmod when not provided', () => {
    const xml = renderSitemapXml([{ loc: '/' }], 'https://example.com');
    expect(xml).not.toContain('<lastmod>');
  });
});
