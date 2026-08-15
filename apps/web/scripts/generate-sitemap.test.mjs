import { describe, expect, it } from 'vitest';
import { buildSitemapEntries, renderSitemapXml } from '@template/shared';
import { routes } from '../src/seo.config.ts';

describe('sitemap generation against the real route registry', () => {
  it('produces well-formed XML containing every registered route', () => {
    const entries = buildSitemapEntries(routes);
    const xml = renderSitemapXml(entries, 'https://example.com');

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const expectedLoc = new URL(route.path, 'https://example.com').toString();
      expect(xml).toContain(`<loc>${expectedLoc}</loc>`);
    }
  });
});
