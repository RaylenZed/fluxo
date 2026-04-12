import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const nextDir = path.join(appRoot, '.next');
const standaloneCandidates = [
  path.join(nextDir, 'standalone', 'apps', 'web'),
  path.join(nextDir, 'standalone'),
];

const standaloneRoot = standaloneCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'server.js'))
);

if (!standaloneRoot) {
  console.warn('[prepare-standalone] No standalone server output found, skipping asset copy.');
  process.exit(0);
}

const copyDir = (source, destination) => {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
};

copyDir(path.join(appRoot, 'public'), path.join(standaloneRoot, 'public'));
copyDir(path.join(nextDir, 'static'), path.join(standaloneRoot, '.next', 'static'));

console.log(`[prepare-standalone] Copied static assets into ${standaloneRoot}`);
