import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('../academy-workbench-recovery-20261013'),files=new Set(),builtins=new Set();
const imports=/\b(?:import|export)\s+(?:[^'";]+?\s+from\s*)?['"]([^'"]+)['"]/g;
function walk(path){path=resolve(path);if(!path.startsWith(root+'/')||path.includes('/node_modules/')||path.includes('/legacy/'))throw Error('Unexpected server input: '+path);if(files.has(path))return;files.add(path);for(const m of readFileSync(path,'utf8').matchAll(imports)){if(m[1].startsWith('node:'))builtins.add(m[1]);else if(m[1].startsWith('.'))walk(resolve(dirname(path),m[1]));else throw Error('Non-native server import: '+m[1]);}}
walk(resolve(root,'src/server/main.ts'));
const browser=JSON.parse(readFileSync(resolve(root,'validation/browser-build-inputs.json'),'utf8'));
for(const [path,item] of Object.entries(browser.inputs)){if(!path.startsWith('src/client/')&&path!=='src/shared/date.ts')throw Error('Unexpected browser input: '+path);if(item.imports.some(i=>i.external))throw Error('External browser import: '+path);files.add(resolve(root,path));}
for(const path of ['public/index.html','public/app.js','public/app.css'])files.add(resolve(root,path));
const banned=/chatgpt\.com|sites\.oai|signin-with-chatgpt|oai-authenticated|oai-sites-authorization|cloudflare:/i;
for(const path of files)if(banned.test(readFileSync(path,'utf8')))throw Error('Hosted-runtime marker: '+relative(root,path));
const manifest=[...files].sort().map(path=>{const bytes=readFileSync(path);return{path:relative(root,path),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
const result={schemaVersion:'academy.independent-runtime-closure/1',generatedAt:new Date().toISOString(),candidate:root,passed:true,files:manifest,runtimeDigest:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),serverBuiltins:[...builtins].sort(),externalRuntimePackages:[],browserExternalImports:[],limits:['Static closure and marker review; not a universal no-network or security guarantee.','No private data, operational credentials or external source services used.']};
writeFileSync('runtime-closure.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,runtimeFileCount:manifest.length,runtimeDigest:result.runtimeDigest}));
