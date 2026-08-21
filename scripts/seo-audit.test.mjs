import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditMeta, auditHeadings, parseFrontmatter } from './seo-audit.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const blogDir = path.join(repoRoot, 'content', 'blog');

test('auditMeta flags a missing/too-long description and missing OG image', () => {
  const issues = auditMeta({
    title: 'A well-sized title for the page',
    description: 'x'.repeat(200),
    ogImage: undefined,
  });

  assert.ok(issues.some((issue) => issue.includes('description too long')));
  assert.ok(issues.some((issue) => issue.includes('missing OG image')));
});

test('auditMeta flags a missing description outright', () => {
  const issues = auditMeta({ title: 'Title', description: undefined, ogImage: '/og/home.png' });
  assert.ok(issues.some((issue) => issue.includes('missing description')));
});

test('auditMeta does not flag a well-formed entry', () => {
  const issues = auditMeta({
    title: 'Exemplar',
    description: 'A production-ready starting point for new products.',
    ogImage: '/og/home.png',
  });

  assert.deepEqual(issues, []);
});

test('auditHeadings flags missing H1 and skipped heading levels', () => {
  const issues = auditHeadings('## Intro\n\n#### Too deep too fast\n');
  assert.ok(issues.some((issue) => issue.includes('no H1')));
  assert.ok(issues.some((issue) => issue.includes('skips from H2 to H4')));
});

test('auditHeadings does not flag a well-formed heading structure', () => {
  const issues = auditHeadings('# Title\n\n## Section\n\n### Subsection\n');
  assert.deepEqual(issues, []);
});

test('auditHeadings with expectH1:false accepts an MDX body that starts at H2', () => {
  const issues = auditHeadings('## Section\n\n### Subsection\n', { expectH1: false });
  assert.deepEqual(issues, []);
});

test('auditHeadings with expectH1:false flags an H1 in the body', () => {
  const issues = auditHeadings('# Duplicate title\n\n## Section\n', { expectH1: false });
  assert.ok(issues.some((issue) => issue.includes('body contains an H1')));
});

test('auditMeta with requireOgImage:false does not demand an OG image', () => {
  const issues = auditMeta(
    { title: 'Title', description: 'A concise description.', ogImage: undefined },
    { requireOgImage: false },
  );
  assert.deepEqual(issues, []);
});

test('parseFrontmatter extracts simple YAML frontmatter fields', () => {
  const content =
    '---\ntitle: My Post\ndescription: A post about things.\n---\n# My Post\n\nBody text.\n';
  const { frontmatter, body } = parseFrontmatter(content);
  assert.equal(frontmatter.title, 'My Post');
  assert.equal(frontmatter.description, 'A post about things.');
  assert.ok(body.includes('Body text.'));
});

test('the CLI script exits 0, flags a broken MDX fixture, and does not flag a well-formed one', () => {
  // content/blog may already hold real posts (the blog module, PT-9) — only
  // touch the two fixture files this test owns, never the directory itself,
  // so real content survives a test run.
  const blogDirPreexisted = existsSync(blogDir);
  mkdirSync(blogDir, { recursive: true });
  const brokenFixturePath = path.join(blogDir, 'broken-fixture.mdx');
  const goodFixturePath = path.join(blogDir, 'good-fixture.mdx');
  writeFileSync(
    brokenFixturePath,
    `---\ntitle: Broken Post\ndescription: ${'x'.repeat(200)}\n---\n# Duplicate title in body\n`,
  );
  writeFileSync(
    goodFixturePath,
    '---\ntitle: Good Post\ndescription: A concise, well-formed description under the limit.\n---\n## Section\n\n### Subsection\n',
  );

  try {
    const output = execFileSync('node', ['scripts/seo-audit.mjs'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    assert.ok(
      output.includes('ISSUES: content\\blog\\broken-fixture.mdx') ||
        output.includes('ISSUES: content/blog/broken-fixture.mdx'),
    );
    assert.ok(
      output.includes('OK: content\\blog\\good-fixture.mdx') ||
        output.includes('OK: content/blog/good-fixture.mdx'),
    );
  } finally {
    unlinkSync(brokenFixturePath);
    unlinkSync(goodFixturePath);
    if (!blogDirPreexisted) rmdirSync(blogDir);
  }
});
