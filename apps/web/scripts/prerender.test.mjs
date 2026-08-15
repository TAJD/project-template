import { describe, expect, it } from 'vitest';
import { injectHeadTags } from './prerender.mjs';

describe('injectHeadTags', () => {
  it('replaces the content between the seo:head markers', () => {
    const html =
      '<head>\n<!-- seo:head:start -->\n<title>Placeholder</title>\n<!-- seo:head:end -->\n</head>';
    const result = injectHeadTags(html, '<title>Exemplar</title>');
    expect(result).toContain('<title>Exemplar</title>');
    expect(result).not.toContain('Placeholder');
    expect(result).toContain('<!-- seo:head:start -->');
    expect(result).toContain('<!-- seo:head:end -->');
  });

  it('throws when the markers are missing', () => {
    expect(() => injectHeadTags('<head></head>', '<title>x</title>')).toThrow();
  });
});
