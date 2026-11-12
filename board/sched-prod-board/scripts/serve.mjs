// Tiny static server for dist/ (no dependencies).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const port = Number(process.env.PORT || 5174);
createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[\\/]+/, '');
  const file = join('dist', p === '' ? 'index.html' : p);
  if (!file.startsWith('dist')) return res.writeHead(403).end();
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end('not found'); }
}).listen(port, () => console.log(`serving dist/ on http://localhost:${port}`));
