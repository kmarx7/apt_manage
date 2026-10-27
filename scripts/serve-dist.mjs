#!/usr/bin/env node
/*
 * dist/를 vercel.json의 헤더(CSP 등)를 그대로 붙여 내려 주는 로컬 서버.
 * 배포 전에 보안 헤더 아래에서 PDF·엑셀·오프라인이 동작하는지 확인하는 용도.
 *   npm run preview:vercel   → http://localhost:4174
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const port = Number(process.env.PORT ?? 4174);
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

/** vercel.json의 source 패턴(정규식 형태)을 경로에 맞춰 본다 */
const headersFor = (path) =>
  config.headers
    .filter((h) => new RegExp(`^${h.source}$`).test(path))
    .flatMap((h) => h.headers);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  let file = normalize(join(dist, path));
  if (!file.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    path = '/index.html';
    file = join(dist, 'index.html');
  }
  for (const { key, value } of headersFor(path)) res.setHeader(key, value);
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`dist + vercel.json 헤더: http://localhost:${port}`));
