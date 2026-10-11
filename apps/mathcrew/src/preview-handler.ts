import { resolve, join } from 'node:path';
import { publicFiles } from './static-assets';
const root = resolve(import.meta.dir, '../dist');
const allowed = new Set<string>(publicFiles);
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
// Handler only: importing this module never launches a listener.
export async function handlePreview(request: Request): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  const path = new URL(request.url).pathname;
  if (path === '/ko') return new Response(null, { status: 308, headers: { ...headers, Location: '/ko/' } });
  const filename = path === '/' ? 'index.html' : path === '/ko/' ? 'ko/index.html' : path.slice(1);
  const exists = allowed.has(filename) && await Bun.file(join(root, filename)).exists();
  const file = Bun.file(join(root, exists ? filename : path.startsWith('/ko/') ? 'ko/404.html' : '404.html'));
  return new Response(request.method === 'HEAD' ? null : file, { status: exists ? 200 : 404, headers: { ...headers, 'Content-Type': exists && filename.endsWith('.ttf') ? 'font/ttf' : file.type } });
}
