import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(workerDir, '..', '..', 'web');
const webDist = path.join(webDir, 'dist');

if (existsSync(webDist)) {
  console.log('apps/web/dist already exists, skipping build');
  process.exit(0);
}

console.log('apps/web/dist missing, building apps/web...');
// Filter by relative path, not package name — apps/web/package.json's
// "name" is a stamp-time rename target (docs/new-project.md), and a
// name-based `--filter web` matches nothing once it's renamed while still
// exiting 0 ("No projects matched the filters"), so the missing dist/ only
// surfaces later as an unrelated-looking test failure.
const filter = './' + path.relative(process.cwd(), webDir).split(path.sep).join('/');
const result = spawnSync('pnpm', ['--filter', filter, 'run', 'build'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
