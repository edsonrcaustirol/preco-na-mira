#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const host = '127.0.0.1';
const port = Number(process.env.PNM_PREVIEW_PORT || 4173);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

function resolveRequest(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, `http://${host}`).pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  const options = [candidate];
  if (!path.extname(candidate)) options.push(`${candidate}.html`, path.join(candidate, 'index.html'));
  return options.find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}

http.createServer((request, response) => {
  const file = resolveRequest(request.url || '/');
  if (!file) {
    const notFound = path.join(root, '404.html');
    response.writeHead(404, { 'content-type': mime['.html'], 'cache-control': 'no-store' });
    return fs.createReadStream(notFound).pipe(response);
  }
  response.writeHead(200, {
    'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(file).pipe(response);
}).listen(port, host, () => {
  console.log(`Prévia V18 disponível em http://${host}:${port}`);
});
