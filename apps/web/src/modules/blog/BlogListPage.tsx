import { getAllPosts } from './posts';
import { PostCard } from './PostCard';

export function BlogListPage() {
  const posts = getAllPosts();

  return (
    <div>
      <h1 className="text-2xl font-bold">Blog</h1>
      <div className="mt-4 flex flex-col gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
