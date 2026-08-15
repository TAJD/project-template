import { describe, expect, it } from 'vitest';
import { article, breadcrumbList, faqPage, webSite } from './structured-data.js';

describe('webSite', () => {
  it('returns a WebSite JSON-LD object', () => {
    expect(webSite({ name: 'Exemplar', url: 'https://example.com' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Exemplar',
      url: 'https://example.com',
    });
  });
});

describe('article', () => {
  it('returns an Article JSON-LD object with a nested Person author', () => {
    const result = article({
      headline: 'Hello',
      datePublished: '2026-01-01',
      author: 'Jane',
      url: 'https://example.com/hello',
    }) as Record<string, unknown>;
    expect(result['@type']).toBe('Article');
    expect(result.author).toEqual({ '@type': 'Person', name: 'Jane' });
    expect(result).not.toHaveProperty('dateModified');
    expect(result).not.toHaveProperty('image');
  });

  it('includes optional dateModified and image when provided', () => {
    const result = article({
      headline: 'Hello',
      datePublished: '2026-01-01',
      dateModified: '2026-01-02',
      author: 'Jane',
      image: 'https://example.com/img.png',
      url: 'https://example.com/hello',
    }) as Record<string, unknown>;
    expect(result.dateModified).toBe('2026-01-02');
    expect(result.image).toBe('https://example.com/img.png');
  });
});

describe('faqPage', () => {
  it('returns a FAQPage JSON-LD object with nested Question/Answer entities', () => {
    const result = faqPage({ questions: [{ question: 'Q1', answer: 'A1' }] }) as Record<
      string,
      unknown
    >;
    expect(result['@type']).toBe('FAQPage');
    expect(result.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'Q1',
        acceptedAnswer: { '@type': 'Answer', text: 'A1' },
      },
    ]);
  });
});

describe('breadcrumbList', () => {
  it('returns a BreadcrumbList JSON-LD object with positioned ListItem entities', () => {
    const result = breadcrumbList({
      items: [
        { name: 'Home', url: 'https://example.com/' },
        { name: 'Blog', url: 'https://example.com/blog' },
      ],
    }) as Record<string, unknown>;
    expect(result['@type']).toBe('BreadcrumbList');
    expect(result.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://example.com/blog' },
    ]);
  });
});
