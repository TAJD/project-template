import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderHeadTags } from '@template/shared';
import { routes } from '../src/seo.config.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');

// Runs the real `pnpm run build` pipeline (tsc -> vite build -> prerender ->
// generate-worker-routes) end to end and asserts the prerendered Home head
// actually lands in the built dist/index.html between the seo:head markers.
describe('web build pipeline', () => {
  beforeAll(() => {
    execSync('pnpm run build', { cwd: webDir, stdio: 'pipe' });
  }, 180_000);

  it('prerenders the Home route head into dist/index.html', () => {
    const html = readFileSync(path.join(webDir, 'dist', 'index.html'), 'utf-8');
    const startIndex = html.indexOf('<!-- seo:head:start -->');
    const endIndex = html.indexOf('<!-- seo:head:end -->');
    expect(startIndex).toBeGreaterThan(-1);
    expect(endIndex).toBeGreaterThan(startIndex);

    const between = html.slice(startIndex, endIndex);
    const homeRoute = routes.find((route) => route.path === '/');
    const expectedHead = renderHeadTags(homeRoute);
    expect(between).toContain(expectedHead);
  }, 120_000);

  it('prerenders each published post to its own HTML file with Article JSON-LD', () => {
    const slug = 'getting-started-with-the-template';
    const postHtmlPath = path.join(webDir, 'dist', 'blog', slug, 'index.html');
    expect(existsSync(postHtmlPath)).toBe(true);

    const html = readFileSync(postHtmlPath, 'utf-8');
    expect(html).toContain('<title>Getting started with the template</title>');
    expect(html).toContain(`<link rel="canonical" href="https://example.com/blog/${slug}" />`);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('"@type":"FAQPage"');
  }, 120_000);

  it('generates an OG image for every prerendered route, including posts', () => {
    for (const file of ['home.png', 'blog.png', 'blog-getting-started-with-the-template.png']) {
      expect(existsSync(path.join(webDir, 'dist', 'og', file))).toBe(true);
    }
  }, 120_000);

  it('indexes every prerendered page with Pagefind, including post bodies', () => {
    const entry = JSON.parse(
      readFileSync(path.join(webDir, 'dist', 'pagefind', 'pagefind-entry.json'), 'utf-8'),
    );
    // Home + /blog + the two published posts. A regression to shell-only
    // prerendering would drop this back to 1.
    expect(entry.languages.en.page_count).toBe(4);

    const postHtml = readFileSync(
      path.join(webDir, 'dist', 'blog', 'getting-started-with-the-template', 'index.html'),
      'utf-8',
    );
    expect(postHtml).toContain('data-pagefind-body');
    expect(postHtml).toContain('Most projects start by copying an old repo');
  }, 120_000);

  it('never prerenders a draft post', () => {
    expect(
      existsSync(path.join(webDir, 'dist', 'blog', 'a-draft-post-in-progress', 'index.html')),
    ).toBe(false);
  }, 120_000);
});
