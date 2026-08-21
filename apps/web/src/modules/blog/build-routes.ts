import { article, faqPage, type RouteMeta } from '@template/shared';
import type { PostFrontmatter } from './posts';

export type PublishedEntry = { slug: string; frontmatter: PostFrontmatter };

// Same placeholder origin used by seo.config.ts's consumers (the prerender
// and sitemap scripts) until the site has a real deployed domain.
const BASE_URL = 'https://example.com';
const SITE_AUTHOR = 'Exemplar';

// Pure frontmatter-in, RouteMeta-out mapping — the single source of truth
// for turning published post entries into registry routes with Article/
// FAQPage JSON-LD. Callable from the browser bundle (apps/web/src/modules/
// blog/index.ts, fed by posts.ts) and from the Node build scripts (fed by
// apps/web/scripts/lib/blog-content.mjs), which can't use posts.ts directly
// since it relies on Vite-only `import.meta.glob`/virtual modules.
export function buildBlogRoutes(publishedEntries: PublishedEntry[]): RouteMeta[] {
  const postRoutes = publishedEntries.map((post) => {
    const jsonLd: object[] = [
      article({
        headline: post.frontmatter.title,
        datePublished: post.frontmatter.pubDate,
        ...(post.frontmatter.updatedDate ? { dateModified: post.frontmatter.updatedDate } : {}),
        author: SITE_AUTHOR,
        ...(post.frontmatter.heroImage ? { image: post.frontmatter.heroImage } : {}),
        url: `${BASE_URL}/blog/${post.slug}`,
      }),
    ];

    if (post.frontmatter.faqs && post.frontmatter.faqs.length > 0) {
      jsonLd.push(faqPage({ questions: post.frontmatter.faqs }));
    }

    return {
      path: `/blog/${post.slug}`,
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      jsonLd,
      // `heroImage` (an author-supplied asset under apps/web/public/) wins when
      // set; otherwise fall back to the card that generate-og.mjs renders for
      // this route, so every post always has a resolvable og:image.
      ogImage: post.frontmatter.heroImage ?? `/og/blog-${post.slug}.png`,
    };
  });

  return [
    {
      path: '/blog',
      title: 'Blog',
      description: 'Articles and updates from Exemplar.',
      ogImage: '/og/blog.png',
    },
    ...postRoutes,
  ];
}
