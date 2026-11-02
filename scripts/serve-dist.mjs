// Serves the GitHub Pages build locally under the same base path
// (/coach-connect-analytics/) and with the same 404.html fallback, so the
// Playwright suite tests exactly what gets deployed.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { ROOT } from './tracking-plan.mjs';

const BASE = '/coach-connect-analytics/';
const DIR = join(ROOT, 'dist', 'coach-connect-analytics', 'browser');
const PORT = Number(process.env.PORT ?? 4300);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { Location: BASE }).end();
    return;
  }
  const requested = decodeURIComponent(url.pathname.slice(BASE.length));
  const rel = requested === '' ? '' : normalize(requested);
  const file = join(DIR, rel);
  // Never serve anything outside the build folder.
  if (rel.startsWith('..') || !file.startsWith(DIR)) {
    res.writeHead(400).end();
    return;
  }
  if (rel && existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
    return;
  }
  // Same status GitHub Pages returns for an unknown path: 404 with the app shell.
  const fallback = rel ? '404.html' : 'index.html';
  res.writeHead(rel ? 404 : 200, { 'Content-Type': TYPES['.html'] });
  res.end(readFileSync(join(DIR, fallback)));
}).listen(PORT, () => console.log(`Serving ${DIR} at http://localhost:${PORT}${BASE}`));
