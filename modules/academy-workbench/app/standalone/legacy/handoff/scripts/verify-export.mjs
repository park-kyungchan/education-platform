/** Static handoff integrity checks only. Does not build, run the app, call a source API or configure authentication. */
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const p=join(dir,e.name);if(lstatSync(p).isSymbolicLink())throw Error('symlink forbidden: '+relative(root,p));
 return e.isDirectory()?walk(p):[p];
});
const failures=[];
const manifest=JSON.parse(readFileSync(join(root,'validation/manifest.json'),'utf8'));
const expected=new Map(manifest.files.map(f=>[f.path,f.sha256]));
const ignore=new Set(['validation/manifest.json']);
const patterns=[
 ['private source identifier',/(?:Sentinel_|page_space_|page_|thread_)[a-f0-9]{24,}/],
 ['private key',/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/],
 ['credential-like token',/(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})/],
 ['encoded data payload',/(?:data:[^\s,]{0,100};base64,|H4sI[A-Za-z0-9+/=]{40,})/],
 ['old workspace path',/\/workspace\/scratch\//]
];
for(const p of walk(root)){
 const rel=relative(root,p).replaceAll('\\','/'),b=readFileSync(p);
 if(/(?:^|\/)(?:\.git|node_modules|\.sites-runtime|dist)(?:\/|$)|\.(?:zip|gz|tar|pdf|png|jpe?g|webp|woff2?|sqlite|db|pile)$/i.test(rel))failures.push(rel+': prohibited file type or path');
 if(b.includes(0))failures.push(rel+': binary NUL');
 let t;try{t=new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{failures.push(rel+': not UTF-8 text');continue;}
 for(const [label,rx] of patterns)if(rx.test(t))failures.push(rel+': '+label);
 if(!ignore.has(rel)){
  if(!expected.has(rel))failures.push(rel+': absent from manifest');
  else if(expected.get(rel)!==sha(b))failures.push(rel+': SHA-256 mismatch');
 }
 if(rel.endsWith('.json'))try{JSON.parse(t);}catch{failures.push(rel+': invalid JSON');}
}
for(const rel of expected.keys())if(!walk(root).some(p=>relative(root,p).replaceAll('\\','/')===rel))failures.push(rel+': missing file');
if(failures.length){console.error(JSON.stringify({status:'failed',failures},null,2));process.exit(1);}
console.log(JSON.stringify({status:'passed',scope:'static export integrity only',files:expected.size+1,appTestsRun:false,externalRequests:0,limitations:'Pattern checks are not exhaustive privacy certification. Review every new or changed file.'},null,2));
