// Live-site SEO audit: fetches a deployed sitemap.xml and each page's <head>,
// then runs the same title/description/OG checks as scripts/seo-audit.mjs.
// Unlike the local audit, this has no local data to fall back on, so a
// missing SITE_URL is a hard, clearly-messaged failure.

import { pathToFileURL } from 'node:url';
import { auditMeta } from './seo-audit.mjs';

export function resolveSiteUrl(argv, env) {
  const url = argv[2] ?? env.SITE_URL;
  if (!url) {
    throw new Error(
      'SITE_URL is not set. Pass it as `node scripts/seo-audit-live.mjs <url>` or set the SITE_URL env var.',
    );
  }
  return url.replace(/\/$/, '');
}

export function extractLocsFromSitemap(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
}

export function extractHeadFields(html) {
  const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(html);
  const descriptionMatch = /<meta\s+name="description"\s+content="([^"]*)"/.exec(html);
  const ogImageMatch = /<meta\s+property="og:image"\s+content="([^"]*)"/.exec(html);

  return {
    title: titleMatch?.[1],
    description: descriptionMatch?.[1],
    ogImage: ogImageMatch?.[1],
  };
}

function printIssues(label, issues) {
  if (issues.length === 0) {
    console.log(`  OK: ${label}`);
    return;
  }
  console.log(`  ISSUES: ${label}`);
  for (const issue of issues) {
    console.log(`    - ${issue}`);
  }
}

async function main() {
  let siteUrl;
  try {
    siteUrl = resolveSiteUrl(process.argv, process.env);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`SEO audit (live) — ${siteUrl}`);

  const sitemapResponse = await fetch(`${siteUrl}/sitemap.xml`);
  if (!sitemapResponse.ok) {
    console.error(
      `Failed to fetch sitemap.xml: ${sitemapResponse.status} ${sitemapResponse.statusText}`,
    );
    process.exit(1);
  }
  const locs = extractLocsFromSitemap(await sitemapResponse.text());

  for (const loc of locs) {
    const pageResponse = await fetch(loc);
    if (!pageResponse.ok) {
      printIssues(loc, [`failed to fetch page: ${pageResponse.status} ${pageResponse.statusText}`]);
      continue;
    }
    const fields = extractHeadFields(await pageResponse.text());
    printIssues(loc, auditMeta(fields));
  }

  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
