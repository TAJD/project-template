import { getAllPosts, getAllTags, getPostBySlug, getPostsByTag } from './posts';

describe('posts loader', () => {
  it('parses frontmatter for a published post', () => {
    const post = getPostBySlug('getting-started-with-the-template');

    expect(post).toBeTruthy();
    expect(post?.frontmatter.title).toBe('Getting started with the template');
    expect(post?.frontmatter.pubDate).toBe('2026-01-12');
    expect(post?.frontmatter.tags).toContain('guide');
    expect(post?.readingTimeMinutes).toBeGreaterThan(0);
  });

  it('excludes draft posts from getAllPosts', () => {
    const slugs = getAllPosts().map((post) => post.slug);

    expect(slugs).not.toContain('a-draft-post-in-progress');
    expect(slugs).toContain('getting-started-with-the-template');
  });

  it('still returns a draft post via getPostBySlug', () => {
    const draft = getPostBySlug('a-draft-post-in-progress');

    expect(draft).toBeTruthy();
    expect(draft?.frontmatter.draft).toBe(true);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getPostBySlug('does-not-exist')).toBeUndefined();
  });

  it('sorts published posts by pubDate descending', () => {
    const posts = getAllPosts();
    const dates = posts.map((post) => post.frontmatter.pubDate);

    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('filters posts by tag, excluding drafts', () => {
    const guidePosts = getPostsByTag('guide');

    expect(guidePosts.map((post) => post.slug)).toContain('getting-started-with-the-template');
    expect(guidePosts.every((post) => !post.frontmatter.draft)).toBe(true);
  });

  it('returns an empty list for a tag with no published posts', () => {
    expect(getPostsByTag('does-not-exist')).toEqual([]);
  });

  it('collects all tags from published posts only, sorted', () => {
    const tags = getAllTags();

    expect(tags).toContain('guide');
    expect(tags).toContain('seo');
    expect(tags).not.toContain('notes'); // only present on the draft post
    expect(tags).toEqual([...tags].sort());
  });
});
