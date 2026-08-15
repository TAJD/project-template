import { describe, expect, it } from 'vitest';
import { injectHeadTags, injectBodyContent } from './prerender.mjs';

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

describe('injectBodyContent', () => {
  it('inserts content immediately before the closing body tag', () => {
    const html = '<body>\n<div id="root"></div>\n</body>';
    const result = injectBodyContent(html, '<div data-pagefind-body>hi</div>');
    expect(result).toContain('<div id="root"></div>');
    expect(result).toContain('<div data-pagefind-body>hi</div>');
    expect(result.indexOf('<div data-pagefind-body>hi</div>')).toBeLessThan(
      result.indexOf('</body>'),
    );
  });

  it('throws when </body> is missing', () => {
    expect(() => injectBodyContent('<html></html>', '<div>x</div>')).toThrow();
  });
});
