// Regression test for PT-42: prerender.mjs (and the sitemap/OG/worker-routes
// scripts) used to statically import the blog module's build-routes.ts,
// which fails to resolve — breaking the whole `pnpm run build` chain —
// once apps/web/src/modules/blog/ has been deleted.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPublishedBlogEntries, loadBlogRoutes } from './blog-content.mjs';

// apps/web root — the scaffold below is created under here (not the OS
// tmpdir) so Node's package resolution can still walk up to the real
// node_modules and find gray-matter, mirroring where these scripts live.
const webDir = path.resolve(import.meta.dirname, '..', '..');

const entries = [
  {
    slug: 'hello-world',
    frontmatter: { title: 'Hello world', description: 'A post.', pubDate: '2026-01-01' },
  },
];

describe('loadPublishedBlogEntries', () => {
  it('returns an empty array when the content directory does not exist', () => {
    expect(loadPublishedBlogEntries(path.join(tmpdir(), 'does-not-exist-' + Date.now()))).toEqual(
      [],
    );
  });
});

describe('loadBlogRoutes', () => {
  it('builds routes from the blog module when it is present', async () => {
    const routes = await loadBlogRoutes(entries);
    expect(routes.some((route) => route.path === '/blog/hello-world')).toBe(true);
  });

  // Runs under plain `node`, matching how these build scripts actually
  // execute in production, rather than through Vite/vitest's module graph
  // (which sandboxes dynamic imports to the project root and can't easily
  // simulate a deleted sibling module).
  it('resolves to an empty array without throwing when the blog module has been removed', () => {
    const root = mkdtempSync(path.join(webDir, '.tmp-blog-content-test-'));
    try {
      const libDir = path.join(root, 'scripts', 'lib');
      mkdirSync(libDir, { recursive: true });
      const realSource = readFileSync(path.join(import.meta.dirname, 'blog-content.mjs'), 'utf-8');
      writeFileSync(path.join(libDir, 'blog-content.mjs'), realSource);
      // No src/modules/blog/ created at all — simulates its deletion.

      const runnerPath = path.join(root, 'run.mjs');
      writeFileSync(
        runnerPath,
        `import { loadBlogRoutes } from './scripts/lib/blog-content.mjs';\n` +
          `const routes = await loadBlogRoutes(${JSON.stringify(entries)});\n` +
          `process.stdout.write(JSON.stringify(routes));\n`,
      );

      const output = execFileSync('node', [runnerPath], { cwd: root, encoding: 'utf-8' });
      expect(JSON.parse(output)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
