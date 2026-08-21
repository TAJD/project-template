import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';

// gray-matter (via js-yaml) parses bare YAML dates like `2026-01-12` into
// Date objects — normalise to a date-only ISO string, matching PostFrontmatter.
function toIsoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

// Reads content/blog frontmatter directly off disk with gray-matter — the
// Node-script counterpart to the blogFrontmatterPlugin virtual module in
// vite.config.ts, since these build scripts run under plain `node` (via
// Node's built-in TS type-stripping) and can't use Vite-only APIs like
// `import.meta.glob`. Returns published entries only. Returns [] if
// contentDir doesn't exist, so build scripts stay buildable once the blog
// module (and its content directory) has been removed (PT-42).
export function loadPublishedBlogEntries(contentDir) {
  if (!existsSync(contentDir)) return [];
  const files = readdirSync(contentDir).filter((file) => file.endsWith('.mdx'));
  return files
    .map((file) => {
      const raw = readFileSync(path.join(contentDir, file), 'utf-8');
      const { data, content } = matter(raw);
      return {
        slug: file.replace(/\.mdx$/, ''),
        content,
        frontmatter: {
          ...data,
          pubDate: toIsoDate(data.pubDate),
          ...(data.updatedDate ? { updatedDate: toIsoDate(data.updatedDate) } : {}),
        },
      };
    })
    .filter((entry) => !entry.frontmatter.draft);
}

const buildRoutesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'modules',
  'blog',
  'build-routes.ts',
);

// Turns published entries into blog route metadata via the blog module's
// pure buildBlogRoutes(), imported dynamically so build scripts stay
// buildable once the blog module has been deleted (PT-42) — a static import
// would fail to resolve before any of these scripts got a chance to run.
export async function loadBlogRoutes(entries) {
  if (!existsSync(buildRoutesPath)) return [];
  const { buildBlogRoutes } = await import(pathToFileURL(buildRoutesPath).href);
  return buildBlogRoutes(entries);
}
