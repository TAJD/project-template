// Regression test for the PT-18 review finding: push-secrets.ps1 invoked a
// bare `wrangler`, which only resolves on a machine that happens to have a
// global wrangler installed. In this template wrangler is a devDependency of
// apps/worker only, so a fresh clone would fail with CommandNotFound. The
// rest of the repo (root `deploy` script) goes through `pnpm --filter
// @template/worker exec wrangler` — this asserts the script does the same.
//
// Source-level assertion rather than an end-to-end run: executing the script
// would need pwsh plus real Cloudflare credentials, and the regression is
// entirely in how the binary is resolved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'push-secrets.ps1');
const source = readFileSync(scriptPath, 'utf8');

test('push-secrets.ps1 resolves wrangler through pnpm, never as a bare command', () => {
  const invocations = source.match(/^[^#\n]*\bwrangler\b[^\n]*$/gm) ?? [];
  const executing = invocations.filter((line) => /[&|]\s*(pnpm|wrangler)\b/.test(line));

  assert.ok(executing.length > 0, 'expected at least one wrangler invocation');
  for (const line of executing) {
    assert.doesNotMatch(
      line,
      /&\s*wrangler\b/,
      `bare \`& wrangler\` is not resolvable from a fresh clone: ${line.trim()}`,
    );
    assert.match(
      line,
      /pnpm\b[^\n]*\bexec\b[^\n]*\bwrangler\b/,
      `wrangler must be invoked via \`pnpm ... exec wrangler\`: ${line.trim()}`,
    );
  }
});

test('push-secrets.ps1 never echoes a secret value', () => {
  const writes = source.match(/^[^#\n]*Write-(Host|Output|Error)[^\n]*$/gm) ?? [];
  for (const line of writes) {
    assert.doesNotMatch(
      line,
      /\$vars\[/,
      `secret values must never be written to the console: ${line.trim()}`,
    );
  }
});
