import { registerRoutes } from '../../seo.config';
import { getAllPosts } from './posts';
import { buildBlogRoutes } from './build-routes';

export { BlogListPage } from './BlogListPage';
export { BlogPostPage } from './BlogPostPage';
export { DraftPostPage } from './DraftPostPage';
export { TagPage } from './TagPage';

// Registering here — rather than in seo.config.ts — is the module's
// contribution point: seo.config.ts never needs to know blog posts exist.
// Drafts are excluded because getAllPosts() already filters them out.
registerRoutes(buildBlogRoutes(getAllPosts()));
