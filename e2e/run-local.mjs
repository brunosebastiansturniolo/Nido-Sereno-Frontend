import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = resolve(frontendDir, '../nido-sereno-main');
const composeFile = resolve(backendDir, 'docker-compose.e2e.yml');

const compose = spawnSync(
  'docker',
  [
    'compose',
    '--project-name',
    'nido-sereno-e2e',
    '--file',
    composeFile,
    'up',
    '--detach',
    '--wait',
    '--force-recreate'
  ],
  { cwd: backendDir, stdio: 'inherit' }
);

if (compose.error) {
  console.error(`No se pudo ejecutar Docker Compose: ${compose.error.message}`);
  process.exit(1);
}
if (compose.status !== 0) process.exit(compose.status ?? 1);

const playwright = spawnSync(
  'npx',
  ['playwright', 'test', ...process.argv.slice(2)],
  {
    cwd: frontendDir,
    env: { ...process.env, PLAYWRIGHT_LOCAL_STACK: 'true' },
    stdio: 'inherit'
  }
);

if (playwright.error) {
  console.error(`No se pudo ejecutar Playwright: ${playwright.error.message}`);
  process.exit(1);
}
process.exit(playwright.status ?? 1);