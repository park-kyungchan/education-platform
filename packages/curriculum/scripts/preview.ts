import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir,'../derived/ui/published-views');
const manifest = JSON.parse(readFileSync(resolve(import.meta.dir,'../derived/ui/ui-source-manifest.json'),'utf8')) as { views:Array<{name:string;title:string}> };
const names = new Set(manifest.views.map(v=>v.name));
const escape = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
const index = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>MathEducation source preview</title><h1>MathEducation UI source preview</h1><p>Derived UI snapshots. Source Page links need existing Space access. KaTeX CDN loading needs network. This is not a mathematical review.</p><ul>${manifest.views.map(v=>`<li><a href="/${v.name}.html">${escape(v.title)}</a></li>`).join('')}</ul></html>`;
const server = Bun.serve({hostname:'127.0.0.1',port: Number(process.env.PORT ?? 4173),fetch(req){const path=new URL(req.url).pathname;if(path==='/')return new Response(index,{headers:{'Content-Type':'text/html; charset=utf-8'}});const name=path.slice(1).replace(/\.html$/,'');if(!names.has(name)||path!==`/${name}.html`)return new Response('Not found',{status:404});return new Response(Bun.file(resolve(root,`${name}.html`)),{headers:{'Content-Type':'text/html; charset=utf-8'}});}});
console.log(`MathEducation source preview: ${server.url}`);
