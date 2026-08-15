import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  injectHeadTags,
  injectBodyContent,
  markdownToIndexableText,
  outputPathForRoute,
} from './prerender.mjs';

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

describe('markdownToIndexableText', () => {
  it('drops fenced code blocks and markdown syntax, keeping prose', () => {
    const text = markdownToIndexableText(
      '## Why\n\nSome **bold** prose with a [link](https://example.com).\n\n```ts\nconst secret = 1;\n```\n\n- [ ] a task\n',
    );
    expect(text).toContain('Why');
    expect(text).toContain('Some bold prose with a link.');
    expect(text).toContain('a task');
    expect(text).not.toContain('const secret');
    expect(text).not.toContain('```');
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
