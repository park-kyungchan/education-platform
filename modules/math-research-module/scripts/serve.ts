import { resolve, sep } from 'node:path';
import { build, root } from './build';
await build();
const dist = resolve(root, 'dist');
const hostname = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const server = Bun.serve({ hostname, port, async fetch(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Bad request', { status: 400 }); }
  const filePath = resolve(dist, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (filePath !== dist && !filePath.startsWith(dist + sep)) return new Response('Forbidden', { status: 403 });
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response('Not found', { status: 404 });
  return new Response(request.method === 'HEAD' ? null : file, { headers: {
    'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'", 'Cache-Control': 'no-store'
  } });
} });
console.log(`Research pilot: http://${server.hostname}:${server.port} (local-only by default)`);
