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
const result = spawnSync('pnpm', ['--filter', 'web', 'run', 'build'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
