/** Loopback-only HTTP boundary. No native transport code or secrets enter browser builds. */
import { randomBytes } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { realpath, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { Application } from './contracts.ts';
import { requireValue, DomainInputError } from './validation.ts';
interface Options { applicationFactory:()=>Application; allowedOrigin:string; frontendRoot?:string; maxSessions?:number }
interface Session { application:Application; csrf:string; touched:number }
const POST_ROUTES=new Map([['/api/study-scope','setScope'],['/api/study','study'],['/api/intent','intent'],['/api/scope','sourceScope'],['/api/find','find'],['/api/review','review'],['/api/alignment','alignmentProposal']] as const);
const STATIC_ASSETS=new Set(['index.html','app.js','styles.css','review.html','.nojekyll','fonts/NotoSansKR-variable.woff2','fonts/NotoSerifKR-variable.woff2','fonts/NotoSansKR-OFL.txt','fonts/NotoSerifKR-OFL.txt']);
const allowedKeys:Record<string,string[]>={setScope:['researchTypeIds','researchRevision','edition','unit'],study:['scope','studied','summary','evidenceNotes','attribution','acceptance'],intent:['axes','notes'],sourceScope:['context','view','hierarchyId','parentId','offset','limit'],find:['context','study','intent','query','categoryId','limit'],review:['context','study','intent','pat_no','cursor','limit'],alignmentProposal:['context','study','intent','pat_no','axes']};
export function createRequestHandler(options:Options):(request:Request)=>Promise<Response>{
 const origin=new URL(options.allowedOrigin);requireValue(origin.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Loopback origin required');
 const sessions=new Map<string,Session>();
 const json=(status:number,value:unknown,cookie?:string)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...(cookie?{'set-cookie':cookie}:{})}});
 return async request=>{
  const url=new URL(request.url);
  if(request.headers.get('host')!==origin.host||url.origin!==origin.origin) return json(403,{ok:false,error:'Host denied'});
  const suppliedOrigin=request.headers.get('origin');if(suppliedOrigin&&suppliedOrigin!==origin.origin||request.headers.get('sec-fetch-site')==='cross-site')return json(403,{ok:false,error:'Origin denied'});
  const now=Date.now();for(const [id,s] of sessions)if(now-s.touched>30*60*1000)sessions.delete(id);
  let id=request.headers.get('cookie')?.match(/(?:^|;\s*)month_end_session=([a-f0-9]{48})(?:;|$)/)?.[1];let session=id?sessions.get(id):undefined;let cookie:string|undefined;
  if(url.pathname==='/api/session'){
   if(request.method!=='GET'||url.search)return json(405,{ok:false,error:'Session route accepts exact GET'});
   if(!session){if(sessions.size>=(options.maxSessions??64))return json(503,{ok:false,error:'Session capacity reached'});id=randomBytes(24).toString('hex');session={application:options.applicationFactory(),csrf:randomBytes(24).toString('hex'),touched:now};sessions.set(id,session);cookie=`month_end_session=${id}; Path=/; HttpOnly; SameSite=Strict`;}
   return json(200,{ok:true,data:{csrfToken:session.csrf}},cookie);
  }
  if(url.pathname.startsWith('/api/')){
   if(!session)return json(401,{ok:false,error:'Begin a bounded application session'});session.touched=now;
   try{
    if(request.method==='GET'){
     if(url.pathname==='/api/state'&&url.search==='')return json(200,{ok:true,data:session.application.snapshot()});
     if(url.pathname==='/api/context'&&url.search==='')return json(200,{ok:true,data:await session.application.context()});
     if(url.pathname==='/api/research'&&[...url.searchParams.keys()].join()==='typeId')return json(200,{ok:true,data:await session.application.research({typeId:url.searchParams.get('typeId')!})});
     if(url.pathname==='/api/navigation'&&[...url.searchParams.keys()].every(k=>k==='path'))return json(200,{ok:true,data:await session.application.navigate((url.searchParams.get('path')??'').split(',').filter(Boolean))});
     return json(404,{ok:false,error:'Unknown read route'});
    }
    const action=POST_ROUTES.get(url.pathname as Parameters<typeof POST_ROUTES.get>[0]);if(!action)return json(404,{ok:false,error:'Unknown action route'});
    if(request.method!=='POST'||url.search)return json(405,{ok:false,error:'Exact POST required'});
    if(suppliedOrigin!==origin.origin||request.headers.get('x-month-end-csrf')!==session.csrf)return json(403,{ok:false,error:'Session action context denied'});
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(415,{ok:false,error:'JSON required'});
    if(Number(request.headers.get('content-length')??0)>32768)return json(413,{ok:false,error:'Input too large'});
    const reader=request.body?.getReader();let count=0;const chunks:Uint8Array[]=[];
    if(reader)while(true){const part=await reader.read();if(part.done)break;count+=part.value.byteLength;if(count>32768){await reader.cancel();return json(413,{ok:false,error:'Input too large'});}chunks.push(part.value);}
    const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    requireValue(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>allowedKeys[action]!.includes(k)),'Unknown action input');
    const invoke=session.application[action] as (input:any)=>Promise<unknown>;
    return json(200,{ok:true,data:await invoke(body)});
   }catch(error){return json(400,{ok:false,error:error instanceof SyntaxError?'Invalid JSON':error instanceof DomainInputError?error.message.slice(0,300):'Source request unavailable or refused'});}
  }
  if(request.method!=='GET'||!options.frontendRoot)return json(404,{ok:false,error:'Route unavailable'});
  let pathname:string;try{pathname=decodeURIComponent(url.pathname);}catch{return json(400,{ok:false,error:'Invalid asset path'});}
  if(pathname.includes('\0')||pathname.includes('..')||pathname.includes('\\'))return json(404,{ok:false,error:'Asset unavailable'});
  const asset=pathname==='/'?'index.html':pathname.slice(1);if(!STATIC_ASSETS.has(asset))return json(404,{ok:false,error:'Asset unavailable'});
  const root=resolve(options.frontendRoot),path=resolve(root,asset);if(!path.startsWith(root+sep))return json(404,{ok:false,error:'Asset unavailable'});
  try{
   const canonicalRoot=await realpath(root),canonicalPath=await realpath(path),rootStat=await lstat(root),fileStat=await lstat(path);
   if(canonicalRoot!==root||canonicalPath!==path||!canonicalPath.startsWith(canonicalRoot+sep)||!rootStat.isDirectory()||rootStat.isSymbolicLink()||!fileStat.isFile()||fileStat.isSymbolicLink()||fileStat.size>64*1024*1024)return json(404,{ok:false,error:'Asset unavailable'});
   // Serve descriptor bytes, never a deferred path lookup that could follow a later symlink replacement.
   const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   try{const opened=await fd.stat();if(!opened.isFile()||opened.dev!==fileStat.dev||opened.ino!==fileStat.ino||opened.size!==fileStat.size)return json(404,{ok:false,error:'Asset unavailable'});
    const bytes=await fd.readFile();if(bytes.byteLength!==opened.size)return json(404,{ok:false,error:'Asset unavailable'});
    const type=asset.endsWith('.html')?'text/html; charset=utf-8':asset.endsWith('.js')?'application/javascript; charset=utf-8':asset.endsWith('.css')?'text/css; charset=utf-8':asset.endsWith('.woff2')?'font/woff2':'text/plain; charset=utf-8';
    return new Response(bytes,{headers:{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"}});
   }finally{await fd.close();}
  }catch{return json(404,{ok:false,error:'Asset unavailable'});}
 };
}
