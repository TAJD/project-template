import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..', '..');
const blogContentModule = path.join(scriptDir, 'blog-content.mjs');

function runNode(code) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf-8',
  });
}

// Temp scaffolding is created under apps/web (not the OS tmpdir) so relative
// `import`s inside the copied module — and its own bare `gray-matter`
// import — still resolve via the real node_modules tree; ESM resolution
// doesn't consult NODE_PATH. Prefixed with `.tmp-` (root .gitignore) so a
// crash between mkdtemp and the `finally` cleanup can't leave junk tracked.
function mktempInWebDir() {
  return mkdtempSync(path.join(webDir, '.tmp-blog-content-test-'));
}

describe('loadPublishedBlogEntries', () => {
  it('returns [] when contentDir does not exist', () => {
    const output = runNode(`
      import { loadPublishedBlogEntries } from ${JSON.stringify(pathToFileURL(blogContentModule).href)};
      console.log(JSON.stringify(loadPublishedBlogEntries(${JSON.stringify(path.join(webDir, 'does-not-exist'))})));
    `);
    expect(JSON.parse(output.trim())).toEqual([]);
  });
});

describe('loadBlogRoutes', () => {
  it('builds routes when the blog module is present', () => {
    const output = runNode(`
      import { loadBlogRoutes } from ${JSON.stringify(pathToFileURL(blogContentModule).href)};
      const routes = await loadBlogRoutes([
        { slug: 'hello', content: 'body', frontmatter: { title: 'Hello', description: 'World', pubDate: '2026-01-01' } },
      ]);
      console.log(JSON.stringify(routes));
    `);
    const routes = JSON.parse(output.trim());
    expect(routes.some((route) => route.path === '/blog/hello')).toBe(true);
  });

  it('resolves to [] without throwing when the blog module has been removed', () => {
    // Exercises the real blog-content.mjs, relocated to a scratch tree that
    // mirrors its actual scripts/lib -> ../../src/modules/blog/build-routes.ts
    // layout but omits build-routes.ts — reproducing PT-42 (a deleted blog
    // module) rather than asserting against a hand-rewritten stand-in.
    const tmpDir = mktempInWebDir();
    try {
      const relocatedLib = path.join(tmpDir, 'scripts', 'lib');
      mkdirSync(relocatedLib, { recursive: true });
      const relocatedModule = path.join(relocatedLib, 'blog-content.mjs');
      copyFileSync(blogContentModule, relocatedModule);

      const output = runNode(`
        import { loadBlogRoutes } from ${JSON.stringify(pathToFileURL(relocatedModule).href)};
        const routes = await loadBlogRoutes([]);
        console.log(JSON.stringify(routes));
      `);
      expect(JSON.parse(output.trim())).toEqual([]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
