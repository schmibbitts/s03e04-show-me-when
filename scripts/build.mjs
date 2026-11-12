// Copies app/ to dist/ and stamps the git sha into index.html (R6). Fails on a dirty tree so the
// stamped sha is always the code that ships.
import { execSync } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const dirty = execSync('git status --porcelain -- app').toString().trim();
if (dirty && !process.argv.includes('--allow-dirty')) {
  console.error('app/ has uncommitted changes; commit first so the build sha matches:\n' + dirty);
  process.exit(1);
}
const sha = execSync('git rev-parse --short=12 HEAD').toString().trim();
rmSync('dist', { recursive: true, force: true });
cpSync('app', 'dist', { recursive: true });
const html = readFileSync('dist/index.html', 'utf8').replaceAll('__BUILD_SHA__', sha);
writeFileSync('dist/index.html', html);
console.log(`dist/ built at ${sha}`);
