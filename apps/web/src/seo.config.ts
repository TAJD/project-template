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
  // The gated sample page (PT-15) — registered so it gets a real prerendered
  // head and stays SPA-routable on a hard refresh, but noindex: it gates on
  // subscription status, so it has nothing crawlers should index or list.
  defineRoute({
    path: '/members',
    title: 'Members',
    description: 'Premium sample content for subscribers.',
    noindex: true,
  }),
];

// Lets other modules (e.g. a future blog feature) contribute routes at their
// own load time without seo.config.ts needing to know about them.
export function registerRoutes(entries: RouteMeta[]): void {
  routes.push(...entries);
}
