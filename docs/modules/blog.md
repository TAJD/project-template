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
5. Delete `apps/web/src/modules/blog/` and `content/blog/`.
6. Remove the now-unused dependencies from `apps/web/package.json`:
   `@mdx-js/rollup`, `remark-gfm`, `remark-frontmatter`, `rehype-slug`, `gray-matter`.
   Run `pnpm install` afterwards.
7. Run `pnpm check` to confirm the sitemap/registry tests and the rest of the suite
   are still green with the module gone.
