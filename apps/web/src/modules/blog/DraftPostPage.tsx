import { useParams } from 'react-router';
import { getPostBySlug } from './posts';
import { NotFound } from './NotFound';

// Unlisted preview route: serves a post by slug regardless of its `draft`
// flag. Never linked from nav/listing/tags and never registered with
// seo.config.ts, so it stays out of the sitemap — but it's reachable
// directly if you know the URL.
export function DraftPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return <NotFound />;
  }

  const { Component } = post;

  return (
    <article>
      <p className="mb-2 inline-block rounded-full border border-rule px-3 py-1 text-xs text-muted">
        Draft preview
      </p>
      <h1 className="text-2xl font-bold">{post.frontmatter.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {post.frontmatter.pubDate} &middot; {post.readingTimeMinutes} min read
      </p>
      <div className="mt-4">
        <Component />
      </div>
    </article>
  );
}
