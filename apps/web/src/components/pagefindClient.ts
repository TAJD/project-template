export type PagefindResult = {
  data: () => Promise<{ url: string; excerpt: string; meta: { title?: string } }>;
};

export type PagefindModule = {
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
};

// Pagefind's CLI (`pagefind --site dist`, run at the end of `apps/web`'s build
// script) writes this module into dist/pagefind/pagefind.js as a runtime
// asset — it does not exist as an npm package or on disk in dev, so it can't
// be a static import. Isolated in its own module (rather than inlined in
// Search.tsx) so tests can mock it without fighting Vite's handling of the
// bare `/pagefind/pagefind.js` specifier.
export function loadPagefind(): Promise<PagefindModule> {
  // The path is built at runtime (not a string literal) so Vite's import
  // analysis and Rollup's build never try to statically resolve it — it
  // only ever exists as a URL the browser fetches directly, after a real
  // build has run `pagefind --site dist`.
  const pagefindUrl = '/pagefind/pagefind.js';
  return import(/* @vite-ignore */ pagefindUrl);
}
