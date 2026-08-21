import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..', '..');
const blogContentModule = path.join(scriptDir, 'blog-content.mjs');

function runNode(code) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf-8',
  });
}

describe('loadPublishedBlogEntries', () => {
  it('returns [] when contentDir does not exist', () => {
    const output = runNode(`
      import { loadPublishedBlogEntries } from ${JSON.stringify(pathToFileUrl(blogContentModule))};
      console.log(JSON.stringify(loadPublishedBlogEntries(${JSON.stringify(path.join(webDir, 'does-not-exist'))})));
    `);
    expect(JSON.parse(output.trim())).toEqual([]);
  });
});

describe('loadBlogRoutes', () => {
  it('builds routes when the blog module is present', async () => {
    const tmpDir = mktempInWebDir();
    try {
      const output = runNode(`
        import { loadBlogRoutes } from ${JSON.stringify(pathToFileUrl(blogContentModule))};
        const routes = await loadBlogRoutes([
          { slug: 'hello', content: 'body', frontmatter: { title: 'Hello', description: 'World', pubDate: '2026-01-01' } },
        ]);
        console.log(JSON.stringify(routes));
      `);
      const routes = JSON.parse(output.trim());
      expect(routes.some((route) => route.path === '/blog/hello')).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resolves to [] without throwing when the blog module has been removed', () => {
    const tmpDir = mktempInWebDir();
    const relocatedModule = path.join(tmpDir, 'blog-content.mjs');
    writeFileSync(
      relocatedModule,
      `
      import { existsSync } from 'node:fs';
      const buildRoutesPath = ${JSON.stringify(path.join(tmpDir, 'does-not-exist', 'build-routes.ts'))};
      export async function loadBlogRoutes(entries) {
        if (!existsSync(buildRoutesPath)) return [];
        const { buildBlogRoutes } = await import(buildRoutesPath);
        return buildBlogRoutes(entries);
      }
      `,
      'utf-8',
    );
    try {
      const output = runNode(`
        import { loadBlogRoutes } from ${JSON.stringify(pathToFileUrl(relocatedModule))};
        const routes = await loadBlogRoutes([]);
        console.log(JSON.stringify(routes));
      `);
      expect(JSON.parse(output.trim())).toEqual([]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

function mktempInWebDir() {
  const dir = mkdtempSync(path.join(webDir, '.tmp-blog-content-test-'));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function pathToFileUrl(p) {
  return new URL(`file://${p.replace(/\\/g, '/')}`).href;
}
