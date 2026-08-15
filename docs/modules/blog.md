# Blog module

An MDX-backed blog: routes, drafts, tags, and SEO registration, all self-contained so
the module can be removed without touching unrelated code.

## Touch-points

- **`apps/web/vite.config.ts`** — `@mdx-js/rollup` plugin (compiles `.mdx` post bodies
  with `remark-gfm`, `remark-frontmatter`, `rehype-slug`) and the `blogFrontmatterPlugin`
  virtual module (`virtual:blog-frontmatter`) that reads `content/blog/*.mdx`
  frontmatter with `gray-matter` at dev/build time.
- **`apps/web/src/App.tsx`** — imports `./modules/blog` and mounts the `/blog`,
  `/blog/:slug`, `/draft/:slug`, and `/tags/:tag` routes inside `Layout`.
- **`apps/web/src/components/Layout.tsx`** — the "Blog" nav link.
- **`apps/web/src/seo.config.ts`** — untouched directly; the module calls the existing
  `registerRoutes()` contribution hook (from `apps/web/src/modules/blog/index.ts`) to
  add the `/blog` listing route and one entry per published post.
- **`apps/web/src/vite-env.d.ts`** — `*.mdx` module type declaration.
- **`apps/web/scripts/lib/blog-content.mjs`** — reads `content/blog/*.mdx` frontmatter
  off disk for the build scripts below (they run under plain `node` and can't use the
  Vite virtual module).
- **`apps/web/scripts/prerender.mjs`**, **`generate-og.mjs`**, **`generate-sitemap.mjs`**,
  **`generate-worker-routes.mjs`** — each composes `staticRoutes` with
  `buildBlogRoutes(loadPublishedBlogEntries(...))` so posts get prerendered HTML, OG
  cards, sitemap entries, and worker routes. Removing the module means deleting those
  two imports and the `[...staticRoutes, ...blogRoutes]` line from each script.
- **`apps/web/src/modules/blog/`** — all module code (loader, pages, route
  registration).
- **`content/blog/`** — the MDX post source files, at the repo root (outside
  `apps/web`).

## Removal steps

1. In `apps/web/src/App.tsx`, remove the `import { BlogListPage, BlogPostPage,
DraftPostPage, TagPage } from './modules/blog'` line and the four `<Route>` entries
   it added (`/blog`, `/blog/:slug`, `/draft/:slug`, `/tags/:tag`).
2. In `apps/web/src/components/Layout.tsx`, remove the `<Link to="/blog">Blog</Link>`
   nav entry.
3. In `apps/web/vite.config.ts`, remove the `mdx()` plugin entry, its
   `remark-gfm`/`remark-frontmatter`/`rehype-slug` imports, and the
   `blogFrontmatterPlugin` function plus its entry in the `plugins` array.
4. Delete `apps/web/src/vite-env.d.ts` (or just its `*.mdx` module declaration, if the
   file has picked up other unrelated content by then).
5. In `apps/web/scripts/prerender.mjs`, `generate-og.mjs`, `generate-sitemap.mjs`, and
   `generate-worker-routes.mjs`, remove the `loadPublishedBlogEntries`/`buildBlogRoutes`
   imports and collapse `[...staticRoutes, ...blogRoutes]` back to `staticRoutes`. Delete
   `apps/web/scripts/lib/blog-content.mjs`.
6. Delete `apps/web/src/modules/blog/` and `content/blog/`.
7. Remove the now-unused dependencies from `apps/web/package.json`:
   `@mdx-js/rollup`, `remark-gfm`, `remark-frontmatter`, `rehype-slug`, `gray-matter`.
   Run `pnpm install` afterwards.
8. Run `pnpm check` to confirm the sitemap/registry tests and the rest of the suite
   are still green with the module gone.

## Feeds and search

PT-10 added RSS/Atom feed generation (`apps/web/scripts/generate-feeds.mjs`) and a
Pagefind-powered search UI (`apps/web/src/components/Search.tsx`) as part of the
blog module's build/runtime story, but neither is blog-specific:

- `generate-feeds.mjs` reads `content/blog/*.mdx` via `scripts/lib/blog-content.mjs`
  and only produces entries from that directory. If the blog module is removed per
  the steps above, `feed.xml`/`atom.xml` would be empty-but-valid feeds — remove
  `generate-feeds.mjs` from `apps/web/package.json`'s `build` script and the
  autodiscovery `<link rel="alternate" ...>` tags in
  `packages/shared/src/head-tags.ts` too, unless another content source is later
  wired into feed generation.
- Pagefind indexes whatever HTML ends up in `apps/web/dist` at build time, not just
  blog content. If the project still has other prerendered/indexed pages (e.g. the
  home page) after blog is removed, keep `pagefind --site dist` in the build script
  and keep `Search` mounted in `Layout.tsx` — search isn't hard-required on the blog
  module. Only drop the Pagefind build step and `Search` component if the project
  ends up with no indexable content at all.
