import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHeadTags } from '@template/shared';
import { routes } from '../src/seo.config.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');

// Runs the real `pnpm run build` pipeline (tsc -> vite build -> prerender ->
// generate-worker-routes) end to end and asserts the prerendered Home head
// actually lands in the built dist/index.html between the seo:head markers.
describe('web build pipeline', () => {
  it('prerenders the Home route head into dist/index.html', () => {
    execSync('pnpm run build', { cwd: webDir, stdio: 'pipe' });

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
});
