import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { injectHeadTags, outputPathForRoute } from './prerender.mjs';

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

describe('outputPathForRoute', () => {
  it('writes the home route to dist/index.html', () => {
    expect(outputPathForRoute('dist', '/')).toBe(path.join('dist', 'index.html'));
  });

  it('writes a nested route to its own directory index.html', () => {
    expect(outputPathForRoute('dist', '/blog/my-post')).toBe(
      path.join('dist', 'blog', 'my-post', 'index.html'),
    );
  });

  it('tolerates a trailing slash', () => {
    expect(outputPathForRoute('dist', '/blog/')).toBe(path.join('dist', 'blog', 'index.html'));
  });
});
