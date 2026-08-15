/// <reference types="vitest/config" />
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeSlug from 'rehype-slug';
import matter from 'gray-matter';

const webDir = path.dirname(fileURLToPath(import.meta.url));
const blogContentDir = path.resolve(webDir, '../../content/blog');

// @mdx-js/rollup's transform hook matches every request for a `.mdx` path
// (it strips the query string before filtering), so a `?raw` glob import
// of the same files gets swallowed and returns the compiled component
// instead of raw text. A virtual module sidesteps that: it reads the
// frontmatter with gray-matter directly off disk (at dev/build time, via
// Node) and hands posts.ts a plain array it can import synchronously,
// while `import.meta.glob` on the real .mdx paths is left for the MDX
// plugin to compile into renderable post-body components.
function blogFrontmatterPlugin(): Plugin {
  const virtualModuleId = 'virtual:blog-frontmatter';
  const resolvedId = '\0' + virtualModuleId;
  return {
    name: 'blog-frontmatter',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedId;
      return undefined;
    },
    load(id) {
      if (id !== resolvedId) return;
      const files = readdirSync(blogContentDir).filter((file) => file.endsWith('.mdx'));
      const entries = files.map((file) => {
        const raw = readFileSync(path.join(blogContentDir, file), 'utf-8');
        const { data, content } = matter(raw);
        return {
          slug: file.replace(/\.mdx$/, ''),
          frontmatter: data,
          wordCount: content.trim().split(/\s+/).filter(Boolean).length,
        };
      });
      return `export default ${JSON.stringify(entries)};`;
    },
  };
}

export default defineConfig({
  plugins: [
    blogFrontmatterPlugin(),
    // MDX handles the body of blog posts (GFM tables/task lists, heading slugs).
    // remark-frontmatter strips the YAML block from the rendered component.
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkGfm],
      rehypePlugins: [rehypeSlug],
    }),
    react(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
