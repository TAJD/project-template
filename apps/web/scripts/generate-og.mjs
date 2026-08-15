import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { routes as staticRoutes } from '../src/seo.config.ts';
// See generate-sitemap.mjs for why this script reads blog frontmatter off
// disk instead of importing the blog module directly.
import { loadPublishedBlogEntries } from './lib/blog-content.mjs';
import { buildBlogRoutes } from '../src/modules/blog/build-routes.ts';

const require = createRequire(import.meta.url);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const ogDir = path.join(webDir, 'dist', 'og');
const publicDefaultPath = path.join(webDir, 'public', 'og', 'default.png');
const blogContentDir = path.resolve(webDir, '..', '..', 'content', 'blog');

const WIDTH = 1200;
const HEIGHT = 630;

// Satori can't resolve CSS custom properties (it doesn't run in a browser),
// so the design-token hex values are hardcoded here from apps/web/src/index.css.
// If the palette tokens change during rebrand, update these too.
const COLORS = {
  paper: '#ffffff',
  ink: '#1a1a1a',
  accent: '#2563eb',
};

// Satori requires TTF/OTF/WOFF font data — the installed Inter package only
// ships WOFF2 (which satori can't parse) as a variable font. @fontsource/inter
// (static, non-variable) ships plain WOFF files per weight, which satori does
// support directly, so those are used instead of hunting for a TTF.
const fontRegular = readFileSync(
  require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'),
);
const fontBold = readFileSync(
  require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff'),
);

export function slugForPath(routePath) {
  if (routePath === '/') return 'home';
  return routePath.replace(/^\/|\/$/g, '').replace(/\//g, '-');
}

export function buildCard(title, description) {
  return {
    type: 'div',
    props: {
      style: {
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        backgroundColor: COLORS.paper,
        color: COLORS.ink,
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: '64px',
              height: '8px',
              backgroundColor: COLORS.accent,
              marginBottom: '40px',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '64px', fontWeight: 700, lineHeight: 1.15 },
            children: title,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '32px', marginTop: '24px', color: COLORS.ink, opacity: 0.75 },
            children: description,
          },
        },
      ],
    },
  };
}

async function renderPng(title, description) {
  const svg = await satori(buildCard(title, description), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
    ],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  return resvg.render().asPng();
}

async function main() {
  mkdirSync(ogDir, { recursive: true });

  const routes = [...staticRoutes, ...buildBlogRoutes(loadPublishedBlogEntries(blogContentDir))];

  for (const route of routes) {
    const png = await renderPng(route.title, route.description);
    const filePath = path.join(ogDir, `${slugForPath(route.path)}.png`);
    writeFileSync(filePath, png);
    console.log(`Wrote OG image for "${route.path}" to ${path.relative(webDir, filePath)}`);
  }

  // Site-default fallback: reuse the committed static asset from public/og/
  // if present (so it survives a clean dist/ wipe without regenerating),
  // otherwise generate a generic site-level card so dist/og/default.png
  // always exists.
  const defaultDistPath = path.join(ogDir, 'default.png');
  if (existsSync(publicDefaultPath)) {
    writeFileSync(defaultDistPath, readFileSync(publicDefaultPath));
  } else {
    const png = await renderPng('Exemplar', 'A production-ready starting point for new products.');
    writeFileSync(defaultDistPath, png);
  }
  console.log(`Wrote default OG image to ${path.relative(webDir, defaultDistPath)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
