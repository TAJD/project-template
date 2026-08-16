// Regression test for PT-18's dry-run finding: ensure-web-dist.mjs used to
// shell out to `pnpm --filter web run build`, a name-based filter that
// matches nothing — and still exits 0 — once apps/web/package.json is renamed
// per docs/new-project.md's own stamp-a-new-project instructions.
// This exercises the script end-to-end against a fake workspace with a
// *renamed* web package and a stub `pnpm` on PATH, asserting the script
// still finds and "builds" it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  chmodSync,
  cpSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('ensure-web-dist.mjs builds apps/web even when its package.json name is not "web"', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ensure-web-dist-'));
  try {
    const workerDir = path.join(root, 'apps', 'worker');
    const webDir = path.join(root, 'apps', 'web');
    const scriptsDir = path.join(workerDir, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(webDir, { recursive: true });

    // Renamed per docs/new-project.md step 2 — this is the scenario that
    // broke the old name-based `--filter web`.
    writeFileSync(path.join(webDir, 'package.json'), JSON.stringify({ name: 'acme-web' }));

    const realScript = path.join(import.meta.dirname, 'ensure-web-dist.mjs');
    // Copy rather than symlink for portability across platforms/CI.
    cpSync(realScript, path.join(scriptsDir, 'ensure-web-dist.mjs'));

    // Fake `pnpm` on PATH: only "builds" (creates dist/) when invoked with a
    // path-style filter (starts with "./" or "../"), never for a bare
    // package-name filter. The `existsSync(dist)` assertion below is what
    // actually pins the behaviour; the shim's non-zero exit for a name filter
    // is just a louder signal than real pnpm's silent exit 0.
    const binDir = path.join(root, 'bin');
    mkdirSync(binDir, { recursive: true });
    const isWin = process.platform === 'win32';
    const shimScript = path.join(binDir, 'pnpm-shim.mjs');
    writeFileSync(
      shimScript,
      `import { mkdirSync } from 'node:fs';\n` +
        `const filter = process.argv[3];\n` +
        `if (filter && (filter.startsWith('./') || filter.startsWith('../'))) {\n` +
        `  mkdirSync(${JSON.stringify(path.join(webDir, 'dist'))}, { recursive: true });\n` +
        `  process.exit(0);\n` +
        `}\n` +
        `process.exit(1);\n`,
    );
    const shimPath = path.join(binDir, isWin ? 'pnpm.cmd' : 'pnpm');
    const shimBody = isWin
      ? `@node "${shimScript}" %*\r\n`
      : `#!/bin/sh\nexec node "${shimScript}" "$@"\n`;
    writeFileSync(shimPath, shimBody);
    if (!isWin) chmodSync(shimPath, 0o755);

    const result = spawnSync('node', [path.join(scriptsDir, 'ensure-web-dist.mjs')], {
      cwd: workerDir,
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
      encoding: 'utf8',
      shell: false,
    });

    assert.equal(result.status, 0, `script failed:\n${result.stdout}\n${result.stderr}`);
    assert.ok(existsSync(path.join(webDir, 'dist')), 'apps/web/dist should have been created');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
