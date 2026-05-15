import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const desktopRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(desktopRoot, '../..');
const resourcesDir = path.join(desktopRoot, 'resources');
const webResourceDir = path.join(resourcesDir, 'web');
const serverResourceDir = path.join(resourcesDir, 'server');
const pnpmStoreDir = path.join(repoRoot, 'node_modules', '.pnpm');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDir(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required resource: ${source}`);
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

fs.rmSync(resourcesDir, { recursive: true, force: true });
fs.mkdirSync(resourcesDir, { recursive: true });

run('pnpm', ['--filter', '@fluxo/server', 'build']);
run('pnpm', ['--filter', 'web', 'build']);

copyDir(path.join(repoRoot, 'apps/web/.next/standalone/apps/web'), webResourceDir);

run('pnpm', ['--filter', '@fluxo/server', 'deploy', '--prod', '--legacy', serverResourceDir]);

for (const relativePath of ['data', '.turbo', '.env', '.env.local']) {
  fs.rmSync(path.join(serverResourceDir, relativePath), { recursive: true, force: true });
}

const electronPackageDir = fs
  .readdirSync(pnpmStoreDir)
  .find((entry) => /^electron@\d+\.\d+\.\d+/.test(entry));
if (!electronPackageDir) {
  throw new Error('Electron package not found. Run pnpm install first.');
}
const electronPackagePath = path.join(pnpmStoreDir, electronPackageDir, 'node_modules', 'electron', 'package.json');
const electronVersion = JSON.parse(fs.readFileSync(electronPackagePath, 'utf8')).version;
run('pnpm', [
  '--filter',
  '@fluxo/desktop',
  'exec',
  'electron-rebuild',
  '--version',
  electronVersion,
  '--arch',
  process.arch,
  '--module-dir',
  serverResourceDir,
  '--only',
  'better-sqlite3',
]);

console.log(`[desktop] Prepared resources in ${resourcesDir}`);
