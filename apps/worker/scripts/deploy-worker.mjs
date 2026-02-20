import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readGitShortSha(repoRoot) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (err) {
    return 'nogit';
  }
}

function createWorkerVersionId(sha) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  return `${stamp}-${sha}`;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(workerDir, '..', '..');
const sha = readGitShortSha(repoRoot);
const workerVersionId = createWorkerVersionId(sha);

console.log(`Deploying worker with WORKER_VERSION_ID=${workerVersionId}`);
execSync(`npx wrangler deploy --var WORKER_VERSION_ID:${workerVersionId}`, {
  cwd: workerDir,
  stdio: 'inherit'
});
