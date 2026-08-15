// Advisory SEO audit for the local route registry and any MDX blog content.
// Always exits 0 — this is a non-gating CI step, not a hard check (see check.yml).

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { routes } from '../apps/web/src/seo.config.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const blogDir = path.join(repoRoot, 'content', 'blog');

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

export function auditMeta({ title, description, ogImage }) {
  const issues = [];

  if (!title) {
    issues.push('missing title');
  } else if (title.length > TITLE_MAX) {
    issues.push(`title too long (${title.length} chars, recommended <=${TITLE_MAX})`);
  }

  if (!description) {
    issues.push('missing description');
  } else if (description.length > DESCRIPTION_MAX) {
    issues.push(
      `description too long (${description.length} chars, recommended <=${DESCRIPTION_MAX})`,
    );
  }

  if (!ogImage) {
    issues.push('missing OG image reference');
  }

  return issues;
}

export function auditHeadings(body) {
  const headingLevels = body
    .split('\n')
    .map((line) => /^(#{1,6})\s+/.exec(line))
    .filter(Boolean)
    .map((match) => match[1].length);

  const issues = [];
  const h1Count = headingLevels.filter((level) => level === 1).length;

  if (h1Count === 0) {
    issues.push('no H1 heading found');
  } else if (h1Count > 1) {
    issues.push(`multiple H1 headings found (${h1Count})`);
  }

  for (let i = 1; i < headingLevels.length; i++) {
    const prev = headingLevels[i - 1];
    const current = headingLevels[i];
    if (current - prev > 1) {
      issues.push(`heading level skips from H${prev} to H${current}`);
    }
  }

  return issues;
}

export function parseFrontmatter(content) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const fieldMatch = /^(\w+):\s*(.*)$/.exec(line);
    if (fieldMatch) {
      frontmatter[fieldMatch[1]] = fieldMatch[2].trim().replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter, body: match[2] };
}

function findMdxFiles(dir) {
  if (!existsSync(dir)) return [];

  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMdxFiles(entryPath));
    } else if (/\.mdx?$/.test(entry.name)) {
      results.push(entryPath);
    }
  }
  return results;
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

function main() {
  console.log('SEO audit — route registry');
  for (const route of routes) {
    printIssues(route.path, auditMeta(route));
  }

  const mdxFiles = findMdxFiles(blogDir);
  console.log(`\nSEO audit — content/blog (${mdxFiles.length} file(s))`);
  if (mdxFiles.length === 0) {
    console.log('  No MDX content found — skipping.');
  }
  for (const filePath of mdxFiles) {
    const relativePath = path.relative(repoRoot, filePath);
    const { frontmatter, body } = parseFrontmatter(readFileSync(filePath, 'utf-8'));
    const issues = [
      ...auditMeta({
        title: frontmatter.title,
        description: frontmatter.description,
        ogImage: frontmatter.ogImage,
      }),
      ...auditHeadings(body),
    ];
    printIssues(relativePath, issues);
  }

  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
