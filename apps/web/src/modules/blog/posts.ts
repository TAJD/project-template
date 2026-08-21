import type { ComponentType } from 'react';
// Virtual module provided by the blogFrontmatterPlugin in vite.config.ts —
// gray-matter runs there (at dev/build time, off disk) and hands back plain
// data here so it's available synchronously without fighting @mdx-js/rollup
// for the .mdx file's raw text. See the comment there for why.
// @ts-expect-error -- declared by the vite plugin, not a real module on disk
import blogFrontmatterEntries from 'virtual:blog-frontmatter';

export type Faq = { question: string; answer: string };

export type PostFrontmatter = {
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  heroImage?: string;
  draft?: boolean;
  tags?: string[];
  faqs?: Faq[];
};

export type Post = {
  slug: string;
  frontmatter: PostFrontmatter;
  readingTimeMinutes: number;
  Component: ComponentType;
};

type FrontmatterEntry = {
  slug: string;
  frontmatter: Record<string, unknown>;
  wordCount: number;
};

// The MDX-compiled React component for each post body (GFM + heading-slug
// support come from the remark/rehype plugins configured in vite.config.ts).
const componentModules = import.meta.glob('../../../../../content/blog/*.mdx', {
  eager: true,
}) as Record<string, { default: ComponentType }>;

function componentForSlug(slug: string): ComponentType {
  const entry = Object.entries(componentModules).find(([filePath]) =>
    filePath.endsWith(`/${slug}.mdx`),
  );
  if (!entry) throw new Error(`No MDX component found for blog post slug "${slug}"`);
  return entry[1].default;
}

// gray-matter (run in the vite plugin, via js-yaml) parses bare YAML dates
// like `2026-01-12` into full ISO timestamps once round-tripped through
// JSON — normalise back to a date-only string so frontmatter matches
// PostFrontmatter's type and feeds article() cleanly.
function toIsoDate(value: unknown): string {
  return String(value).slice(0, 10);
}

const allPosts: Post[] = (blogFrontmatterEntries as FrontmatterEntry[]).map((entry) => {
  const frontmatter = {
    ...entry.frontmatter,
    pubDate: toIsoDate(entry.frontmatter.pubDate),
    ...(entry.frontmatter.updatedDate
      ? { updatedDate: toIsoDate(entry.frontmatter.updatedDate) }
      : {}),
  } as PostFrontmatter;
  return {
    slug: entry.slug,
    frontmatter,
    readingTimeMinutes: Math.max(1, Math.round(entry.wordCount / 200)),
    Component: componentForSlug(entry.slug),
  };
});

export function getAllPosts(): Post[] {
  return allPosts
    .filter((post) => !post.frontmatter.draft)
    .sort((a, b) => (a.frontmatter.pubDate < b.frontmatter.pubDate ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | undefined {
  return allPosts.find((post) => post.slug === slug);
}

export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter((post) => post.frontmatter.tags?.includes(tag));
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllPosts()) {
    for (const tag of post.frontmatter.tags ?? []) tags.add(tag);
  }
  return [...tags].sort();
}
