import { Link } from 'react-router';
import { Card } from '../../components/Card';
import type { Post } from './posts';

export function PostCard({ post }: { post: Post }) {
  return (
    <Card>
      <h3 className="text-lg font-semibold">
        <Link to={`/blog/${post.slug}`}>{post.frontmatter.title}</Link>
      </h3>
      <p className="mt-1 text-sm text-muted">
        {post.frontmatter.pubDate} &middot; {post.readingTimeMinutes} min read
      </p>
      <p className="mt-2 text-ink">{post.frontmatter.description}</p>
      {post.frontmatter.tags && post.frontmatter.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {post.frontmatter.tags.map((tag) => (
            <li key={tag}>
              <Link
                to={`/tags/${tag}`}
                className="rounded-full border border-rule px-3 py-1 text-xs text-muted hover:text-accent"
              >
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
