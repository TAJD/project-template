import './index';
import { routes } from '../../seo.config';

describe('blog route registration', () => {
  it('registers the /blog listing route', () => {
    const listing = routes.find((route) => route.path === '/blog');

    expect(listing).toBeTruthy();
    expect(listing?.title).toBeTruthy();
  });

  it('registers a well-formed Article entry for a published post', () => {
    const entry = routes.find((route) => route.path === '/blog/getting-started-with-the-template');

    expect(entry).toBeTruthy();
    expect(entry?.jsonLd?.length).toBeGreaterThan(0);

    const articleLd = entry?.jsonLd?.find(
      (item): item is Record<string, unknown> =>
        (item as { '@type'?: string })['@type'] === 'Article',
    );
    expect(articleLd).toBeTruthy();
    expect(articleLd?.headline).toBe('Getting started with the template');
    expect(articleLd?.datePublished).toBe('2026-01-12');
    expect(articleLd?.dateModified).toBe('2026-01-15');
    expect((articleLd?.author as { name?: string })?.name).toBe('Exemplar');
  });

  it('registers a FAQPage entry when the post has non-empty faqs', () => {
    const entry = routes.find((route) => route.path === '/blog/getting-started-with-the-template');

    const faqLd = entry?.jsonLd?.find(
      (item): item is Record<string, unknown> =>
        (item as { '@type'?: string })['@type'] === 'FAQPage',
    );
    expect(faqLd).toBeTruthy();
    expect(Array.isArray(faqLd?.mainEntity)).toBe(true);
    expect((faqLd?.mainEntity as unknown[]).length).toBeGreaterThan(0);
  });

  it('does not register a FAQPage entry for a post with an empty faqs array', () => {
    const entry = routes.find(
      (route) => route.path === '/blog/structured-data-without-the-headache',
    );

    const faqLd = entry?.jsonLd?.find(
      (item) => (item as { '@type'?: string })['@type'] === 'FAQPage',
    );
    expect(faqLd).toBeUndefined();
  });

  it('never registers the draft post', () => {
    const draftEntry = routes.find((route) => route.path === '/blog/a-draft-post-in-progress');

    expect(draftEntry).toBeUndefined();
  });
});
