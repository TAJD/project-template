import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const publicDir = path.join(webDir, 'public');

const manifestPath = path.join(publicDir, 'site.webmanifest');
const indexHtmlPath = path.join(webDir, 'index.html');

const missing = [];

function checkPublicFile(urlPath, referencedBy) {
  const relative = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  const filePath = path.join(publicDir, relative);
  if (!existsSync(filePath)) {
    missing.push(`${urlPath} (referenced by ${referencedBy}, expected at ${filePath})`);
  }
}

if (!existsSync(manifestPath)) {
  missing.push(`public/site.webmanifest (referenced by index.html)`);
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  for (const icon of manifest.icons ?? []) {
    checkPublicFile(icon.src, 'site.webmanifest');
  }
}

const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
const hrefPattern = /href="(\/[^"]+)"/g;
for (const match of indexHtml.matchAll(hrefPattern)) {
  checkPublicFile(match[1], 'index.html');
}

if (missing.length > 0) {
  console.error('Missing public assets referenced by manifest/index.html:');
  for (const entry of missing) {
    console.error(`  - ${entry}`);
  }
  process.exit(1);
}

console.log('All public assets referenced by site.webmanifest/index.html exist.');
