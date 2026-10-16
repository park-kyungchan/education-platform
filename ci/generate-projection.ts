/** Generation only: immutable common Git objects own every review predicate. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,chmodSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,posix} from 'node:path';

const root=resolve(import.meta.dir,'..');
const manifestPath=resolve(root,'architecture/common-ci-provider.json');
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const [commonRoot,mode,...extra]=Bun.argv.slice(2);
if(!commonRoot||(mode&&mode!=='--write')||extra.length)throw Error('Usage: bun ci/generate-projection.ts <common-root> [--write]');
const provider=JSON.parse(readFileSync(manifestPath,'utf8'));
if(provider.schema!=='education.common-ci-projection.v2'||provider.codeOwner!=='agent-platform'||provider.nativePermissionGranted!==false)throw Error('Invalid common CI owner');
const compiler=provider.compiler;
if(compiler.name!=='Bun'||Bun.version!==compiler.version||Bun.revision!==compiler.revision||hash(readFileSync(process.execPath))!==compiler.sha256||statSync(process.execPath).size!==compiler.bytes)throw Error('Pinned projection compiler mismatch');
if(!/^[a-f0-9]{40}$/.test(provider.source.commit)||!/^[a-f0-9]{40}$/.test(provider.source.tree))throw Error('Invalid immutable common source identity');
if(provider.build.target!=='bun'||provider.build.format!=='esm'||provider.build.minify!==false||provider.build.splitting!==false)throw Error('Pinned build settings mismatch');
const git=(args:string[])=>execFileSync('git',['-C',resolve(commonRoot),...args]);
const tree=git(['rev-parse',provider.source.commit+'^{tree}']).toString('utf8').trim();
if(tree!==provider.source.tree)throw Error('Pinned common commit/tree mismatch');
const sources=new Map<string,Buffer>();
for(const input of provider.source.inputs){
 if(!/^ci\/(?:source-check|quality\/receipt-validation-gate|quality\/receipt-validator)\.ts$/.test(input.path)||sources.has(input.path))throw Error('Unexpected canonical projection input');
 const bytes=git(['show',provider.source.commit+':'+input.path]);
 if(hash(bytes)!==input.sha256)throw Error('Immutable common input hash mismatch: '+input.path);
 sources.set(input.path,bytes);
}
if(sources.size!==3)throw Error('Incomplete canonical projection inputs');
const local=new Map<string,Buffer>();
for(const input of provider.generationInputs){
 if(!['ci/native-review.entry.ts','ci/generate-projection.ts'].includes(input.path)||local.has(input.path))throw Error('Unexpected local generation input');
 const bytes=readFileSync(resolve(root,input.path));
 if(hash(bytes)!==input.sha256)throw Error('Local generation input hash mismatch: '+input.path);
 local.set(input.path,bytes);
}
if(local.size!==2)throw Error('Incomplete local generation inputs');
const entry=local.get('ci/native-review.entry.ts')!;
const config='{"compilerOptions":{}}\n';
if(hash(config)!==provider.build.tsconfigSha256)throw Error('Pinned build configuration mismatch');
const temporary=mkdtempSync(join(tmpdir(),'education-ci-projection-'));
const loaded=new Map<string,string>();
let result;
try{
 const configPath=join(temporary,'tsconfig.json');writeFileSync(configPath,config);chmodSync(configPath,0o400);
 result=await Bun.build({
  entrypoints:['education-native-review-entry'],root:temporary,target:'bun',format:'esm',minify:false,splitting:false,metafile:true,tsconfig:configPath,
  plugins:[{name:'immutable-common-ci-inputs',setup(build){
   build.onResolve({filter:/.*/},args=>{
    if(args.path==='education-native-review-entry'&&!args.importer)return {path:'ci/native-review.entry.ts',namespace:'education-entry'};
    if(args.importer==='ci/native-review.entry.ts'&&args.path==='../../agent-platform/ci/source-check')return {path:'ci/source-check.ts',namespace:'agent-platform'};
    if(sources.has(args.importer)&&args.path.startsWith('./')){
     const path=posix.normalize(posix.join(posix.dirname(args.importer),args.path))+'.ts';
     if(sources.has(path))return {path,namespace:'agent-platform'};
    }
    if(sources.has(args.importer)&&['node:crypto','node:fs/promises','node:os','node:path'].includes(args.path))return {path:args.path,external:true};
    throw Error('Unpinned transitive common import: '+args.path);
   });
   build.onLoad({filter:/.*/,namespace:'education-entry'},()=>{
    loaded.set('education-entry:ci/native-review.entry.ts',hash(entry));return {contents:entry.toString('utf8'),loader:'ts'};
   });
   build.onLoad({filter:/.*/,namespace:'agent-platform'},args=>{
    const bytes=sources.get(args.path);if(!bytes)throw Error('Unpinned common input');
    const contents=bytes.toString('utf8');if(!Buffer.from(contents).equals(bytes))throw Error('Non-UTF8 canonical input');
    loaded.set('agent-platform:'+args.path,hash(bytes));return {contents,loader:'ts'};
   });
  }}],
 });
 if(!result.success)throw Error(result.logs.map(String).join('\n'));
 if(!readFileSync(configPath).equals(Buffer.from(config)))throw Error('Owned compiler configuration changed');
}finally{rmSync(temporary,{recursive:true,force:true});}
const graph=result.metafile;
if(!graph||Object.keys(graph.inputs).sort().join('|')!==[...loaded.keys()].sort().join('|')||loaded.size!==4)throw Error('Compiled projection graph differs from pinned immutable inputs');
for(const input of provider.generationInputs)if(hash(readFileSync(resolve(root,input.path)))!==input.sha256)throw Error('Local generation source changed');
if(git(['rev-parse',provider.source.commit+'^{tree}']).toString('utf8').trim()!==tree)throw Error('Canonical source identity changed');
if(hash(readFileSync(process.execPath))!==compiler.sha256)throw Error('Projection compiler bytes changed');
const output=result.outputs[0];if(!output||result.outputs.length!==1)throw Error('Unexpected projection outputs');
const bytes=Buffer.from(await output.arrayBuffer());
const generated={path:'ci/native-review-gate.js',sha256:hash(bytes)};
const compiledInputs=[...loaded].sort(([a],[b])=>a.localeCompare(b)).map(([path,sha256])=>({path,sha256,...graph.inputs[path]}));
if(mode==='--write'){
 writeFileSync(resolve(root,generated.path),bytes);
 provider.generated=[generated];provider.compiledInputs=compiledInputs;
 writeFileSync(manifestPath,JSON.stringify(provider,null,2)+'\n');
}else if(hash(readFileSync(resolve(root,generated.path)))!==generated.sha256||JSON.stringify(provider.compiledInputs)!==JSON.stringify(compiledInputs))throw Error('Generated projection is not reproducible from its pinned immutable inputs');
console.log(JSON.stringify({status:'pass',mode:mode==='--write'?'generate':'verify',commonCommit:provider.source.commit,commonTree:tree,compiledInputs:loaded.size,generated,nativePermissionGranted:false}));
