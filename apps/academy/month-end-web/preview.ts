import {resolve, sep} from 'node:path';
import {realpath} from 'node:fs/promises';
const root = await realpath(resolve(import.meta.dir,'dist'));
const port = Number(Bun.env.PORT ?? 4173);
const server = Bun.serve({hostname:'127.0.0.1',port,async fetch(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed',{status:405});
  let path:string;
  try {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    // Exercise GitHub project-page asset paths locally as well as the root URL.
    const relative = pathname.replace(/^\/education-platform(?=\/|$)/,'').replace(/^\//,'') || 'index.html';
    if (relative.split('/').some(part=>part.startsWith('.'))) return new Response('Not found',{status:404});
    path = await realpath(resolve(root,relative));
    if (!path.startsWith(root + sep)) return new Response('Not found',{status:404});
  } catch {return new Response('Not found',{status:404});}
  const file = Bun.file(path);
  return new Response(request.method === 'HEAD' ? null : file,{headers:{'Content-Type':file.type,'X-Content-Type-Options':'nosniff'}});
}});
console.log(`Month-end preview: ${server.url} (loopback only; synthetic data)`);
