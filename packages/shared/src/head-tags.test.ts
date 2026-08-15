import { describe, expect, it } from 'vitest';
import { renderHeadTags } from './head-tags.js';
import type { RouteMeta } from './seo-types.js';

describe('renderHeadTags', () => {
  const meta: RouteMeta = {
    path: '/',
    title: 'Exemplar',
    description: 'A production-ready starting point for new products.',
  };

  it('renders title and meta description', () => {
    const html = renderHeadTags(meta);
    expect(html).toContain('<title>Exemplar</title>');
    expect(html).toContain(
      '<meta name="description" content="A production-ready starting point for new products." />',
    );
  });

  it('renders Open Graph title and description', () => {
    const html = renderHeadTags(meta);
    expect(html).toContain('<meta property="og:title" content="Exemplar" />');
    expect(html).toContain(
      '<meta property="og:description" content="A production-ready starting point for new products." />',
    );
  });

  it('omits og:image when not provided', () => {
    const html = renderHeadTags(meta);
    expect(html).not.toContain('og:image');
  });

  it('renders og:image when provided', () => {
    const html = renderHeadTags({ ...meta, ogImage: 'https://example.com/og.png' });
    expect(html).toContain('<meta property="og:image" content="https://example.com/og.png" />');
  });

  it('renders a canonical link built from the base URL and path', () => {
    const html = renderHeadTags(meta, 'https://example.com');
    expect(html).toContain('<link rel="canonical" href="https://example.com/" />');
  });

  it('renders a JSON-LD script per entry', () => {
    const html = renderHeadTags({
      ...meta,
      jsonLd: [{ '@type': 'WebSite', name: 'Exemplar' }],
    });
    expect(html).toContain(
      '<script type="application/ld+json">{"@type":"WebSite","name":"Exemplar"}</script>',
    );
  });

  it('escapes markup-significant characters in JSON-LD so it cannot break out of the script tag', () => {
    const html = renderHeadTags({
      ...meta,
      jsonLd: [{ '@type': 'Article', headline: '</script><script>alert(1)</script>' }],
    });
    expect(html).not.toContain('</script><script>');
    expect(html).toContain('\\u003c/script\\u003e');

    const payload = html.slice(
      html.indexOf('application/ld+json">') + 'application/ld+json">'.length,
      html.lastIndexOf('</script>'),
    );
    expect(JSON.parse(payload)).toEqual({
      '@type': 'Article',
      headline: '</script><script>alert(1)</script>',
    });
  });

  it('omits JSON-LD blocks when not provided', () => {
    const html = renderHeadTags(meta);
    expect(html).not.toContain('application/ld+json');
  });

  it('escapes HTML-sensitive characters in title and description', () => {
    const html = renderHeadTags({
      path: '/',
      title: 'Cats & "Dogs" <3',
      description: 'A & B',
    });
    expect(html).toContain('<title>Cats &amp; &quot;Dogs&quot; &lt;3</title>');
    expect(html).toContain('content="A &amp; B"');
  });
});
