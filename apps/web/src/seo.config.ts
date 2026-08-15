import type { RouteMeta } from '@template/shared';

export function defineRoute(meta: RouteMeta): RouteMeta {
  return meta;
}

export const routes: RouteMeta[] = [
  defineRoute({
    path: '/',
    title: 'Exemplar',
    description: 'A production-ready starting point for new products.',
    ogImage: '/og/home.png',
  }),
];

// Lets other modules (e.g. a future blog feature) contribute routes at their
// own load time without seo.config.ts needing to know about them.
export function registerRoutes(entries: RouteMeta[]): void {
  routes.push(...entries);
}
