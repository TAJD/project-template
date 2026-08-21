import { useParams } from 'react-router';
import { FeedbackWidget } from '../feedback/FeedbackWidget';
import { getPostBySlug } from './posts';
import { NotFound } from './NotFound';

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post || post.frontmatter.draft) {
    return <NotFound />;
  }

  const { Component } = post;

  return (
    <article>
      <h1 className="text-2xl font-bold">{post.frontmatter.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {post.frontmatter.pubDate} &middot; {post.readingTimeMinutes} min read
      </p>
      <div className="blog-content mt-4">
        <Component />
      </div>
      <footer className="mt-8">
        <FeedbackWidget />
      </footer>
    </article>
  );
}
