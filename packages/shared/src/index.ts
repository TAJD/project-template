export type SiteConfig = {
  name: string;
};

export type { RouteMeta } from './seo-types.js';
export { renderHeadTags, DEFAULT_BASE_URL } from './head-tags.js';
export type { SitemapEntry } from './sitemap-routes.js';
export { buildSitemapEntries, renderSitemapXml } from './sitemap-routes.js';
export { article, breadcrumbList, faqPage, webSite } from './structured-data.js';
