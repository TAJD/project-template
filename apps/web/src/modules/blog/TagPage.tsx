import { useParams } from 'react-router';
import { getPostsByTag } from './posts';
import { PostCard } from './PostCard';

export function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const posts = tag ? getPostsByTag(tag) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Posts tagged &ldquo;{tag}&rdquo;</h1>
      {posts.length === 0 ? (
        <p className="mt-4 text-muted">No posts with this tag yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
