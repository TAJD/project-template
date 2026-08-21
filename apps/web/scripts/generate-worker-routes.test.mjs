import { describe, expect, it } from 'vitest';
import { buildSpaRoutesFile } from './generate-worker-routes.mjs';

describe('buildSpaRoutesFile', () => {
  it('renders each given path as an entry in the generated array', () => {
    const output = buildSpaRoutesFile(['/', '/blog/hello-world']);
    expect(output).toContain("'/'");
    expect(output).toContain("'/blog/hello-world'");
    expect(output).toMatch(/export const spaRoutes = \[/);
  });

  it('output is driven by the input paths, not hardcoded — adding a route changes it', () => {
    const before = buildSpaRoutesFile(['/']);
    expect(before).not.toContain('/new-fixture-route');

    const after = buildSpaRoutesFile(['/', '/new-fixture-route']);
    expect(after).toContain("'/new-fixture-route'");
  });
});
