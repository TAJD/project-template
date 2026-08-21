export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  jsonLd?: object[];
  ogImage?: string;
  // Emits a `<meta name="robots" content="noindex">` tag and excludes the
  // route from the generated sitemap — for routes that are registered (so
  // they get a real head/canonical and stay SPA-routable on refresh) but
  // shouldn't be crawled or listed, e.g. a gated members-only page.
  noindex?: boolean;
};
