import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const root=process.cwd(),hash=b=>createHash('sha256').update(b).digest('hex'),seen=new Set(),imports=[];
const serverBuild=await build({entryPoints:['src/server/main.ts'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,metafile:true});
for(const [file,value] of Object.entries(serverBuild.metafile.inputs)){assert(file.startsWith('src/server/')||file.startsWith('src/shared/')||file.startsWith('fixtures/'),'unexpected server input '+file);seen.add(resolve(file));for(const imp of value.imports){imports.push({from:file,specifier:imp.path});if(imp.external)assert(imp.path.startsWith('node:')||(imp.path.startsWith('.')&&Object.hasOwn(serverBuild.metafile.inputs,relative(root,resolve(dirname(file),imp.path)))),'external server dependency '+imp.path);}}
const meta=JSON.parse(readFileSync('validation/browser-build-inputs.json','utf8'));
for(const [file,v] of Object.entries(meta.inputs)){assert(file.startsWith('src/client/')||file==='src/shared/date.ts','unexpected browser input '+file);for(const imp of v.imports)assert(!imp.external,'external browser import '+imp.path);}
for(const out of Object.values(meta.outputs))for(const imp of out.imports)assert(!imp.external,'external output import');
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);}
const runtimeFiles=[...files('src'),...files('fixtures'),...files('public')].filter(p=>!p.endsWith('.d.ts')).sort();
const forbidden=/chatgpt\.com|oai-authenticated|OAI-Sites-Authorization|signin-with-chatgpt|cloudflare|modelContext|\/academy-rails-current/i;
for(const p of runtimeFiles){const text=readFileSync(p,'utf8');assert(!forbidden.test(text),'platform dependency marker '+p);if(seen.has(resolve(p)))assert(!/\bfetch\s*\(|\bhttps?\s*\.\s*(?:request|get)\s*\(/.test(text),'outbound server request '+p);}
const manifest=runtimeFiles.map(path=>{const b=readFileSync(path);return{path,bytes:b.length,sha256:hash(b)};}),runtimeDigest=hash(JSON.stringify(manifest));
const report={schemaVersion:'academy.runtime-dependency-audit/1',checkedAt:new Date().toISOString(),runtimeDigest,runtimeDigestDefinition:'sha256(JSON.stringify(sorted array of {path,bytes,sha256})))',runtimeFiles:manifest,serverClosure:[...seen].map(p=>relative(root,p)).sort(),serverImports:imports,browserInputs:Object.keys(meta.inputs).sort(),results:{serverExternalPackages:0,browserExternalImports:0,platformMarkers:0,outboundServerCalls:0,legacyInRuntime:false,privateDataInBrowserBundle:false},limitations:['Static dependency scans are bounded source checks, not a proof against all possible future code changes.','Browser tests deny external fetch and use real loopback API responses; GUI checks are reported separately.','No actual source import, operational credential provisioning, external deployment or source identity verification is claimed.']};
writeFileSync('validation/runtime-dependency-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({runtimeDigest,files:manifest.length,serverClosure:seen.size,browserInputs:report.browserInputs.length,results:report.results}));
