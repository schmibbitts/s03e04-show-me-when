// Starts serve.mjs from the repo root, whatever the caller's cwd.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
process.chdir(dirname(dirname(fileURLToPath(import.meta.url))));
await import('./serve.mjs');
