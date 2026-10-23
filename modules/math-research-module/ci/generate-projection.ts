/** One generation mechanism for immutable canonical dependencies; no copied predicates. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, realpath, readdir, mkdir, writeFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { tmpdir } from 'node:os';

const root=resolve(import.meta.dir,'..');
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
const git=(directory:string,...args:string[])=>execFileSync('git',['-C',directory,...args]);
const externals=['ajv/dist/2020.js','ajv-formats','node:crypto','node:fs/promises','node:path'];
const packages=['ajv','ajv-formats','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string'];
const compilerConfig='{"compilerOptions":{}}\n';
type Input={namespace:string;path:string;bytes:Buffer;sha256:string};
async function emit(path:string,bytes:Buffer,write:boolean) {
 const target=resolve(root,path);
 if(write) {
  await mkdir(dirname(target),{recursive:true});
  if(await realpath(dirname(target))!==dirname(target)||(existsSync(target)&&await realpath(target)!==target))throw Error('Unsafe generated output path');
  await writeFile(target,bytes);
 } else if(!bytes.equals(await readFile(target)))throw Error('Projection is not reproducible: '+path);
}
async function files(directory:string,prefix=''):Promise<string[]> {
 const rows:string[]=[];
 for(const entry of await readdir(resolve(directory,prefix),{withFileTypes:true})) {
  const path=posix.join(prefix,entry.name);
  if(entry.isDirectory())rows.push(...await files(directory,path));
  else if(entry.isFile())rows.push(path);
  else throw Error('Nonregular projection dependency: '+path);
 }
 return rows.sort();
}
async function externalClosure(coreLock:any) {
 const localLock=Bun.JSONC.parse(await readFile(resolve(root,'bun.lock'),'utf8')) as any;
 const closure=[];
 for(const name of packages) {
  const expected=coreLock.packages[name],actual=localLock.packages[name];
  if(!expected||JSON.stringify(expected)!==JSON.stringify(actual))throw Error('External lock differs from canonical dependency: '+name);
  const packageFile=Bun.resolveSync(name+'/package.json',root);
  const directory=await realpath(dirname(packageFile));
  if(!directory.startsWith(root+'/node_modules/'))throw Error('External dependency escaped consumer installation');
  const metadata=JSON.parse(await readFile(packageFile,'utf8'));
  if(expected[0]!==name+'@'+metadata.version)throw Error('External package identity drift');
  const integrity=expected.at(-1);
  if(typeof integrity!=='string'||!integrity.startsWith('sha512-'))throw Error('Canonical external archive integrity absent');
  const cache=resolve(root,'.private/projection-package-archives');await mkdir(cache,{recursive:true});
  if(await realpath(cache)!==cache)throw Error('Unsafe projection archive cache');
  const archive=resolve(cache,name+'-'+metadata.version+'.tgz');
  if(!existsSync(archive)) {
   const response=await fetch('https://registry.npmjs.org/'+name+'/-/'+name+'-'+metadata.version+'.tgz',{redirect:'error'});
   if(!response.ok)throw Error('Canonical external archive unavailable');await writeFile(archive,new Uint8Array(await response.arrayBuffer()),{flag:'wx',mode:0o600});
  }
  if(createHash('sha512').update(await readFile(archive)).digest('base64')!==integrity.slice(7))throw Error('Canonical external archive integrity mismatch');
  const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).split('\n').filter(Boolean);
  if(entries.some(path=>!path.startsWith('package/')||path.split('/').includes('..')||path.includes('\\')))throw Error('Unsafe canonical external archive path');
  const extracted=await mkdtemp(resolve(tmpdir(),'math-external-source-'));
  let sourceFiles;
  try {
   execFileSync('tar',['-xzf',archive,'--strip-components=1','--no-same-owner','-C',extracted]);
   const paths=await files(extracted);
   if(JSON.stringify(paths)!==JSON.stringify(await files(directory)))throw Error('Installed external source set differs from locked archive');
   sourceFiles=await Promise.all(paths.map(async path=>{
    const expectedBytes=await readFile(resolve(extracted,path)),installedBytes=await readFile(resolve(directory,path));
    if(!expectedBytes.equals(installedBytes))throw Error('Installed external bytes differ from locked archive');
    return {path,sha256:hash(expectedBytes)};
   }));
  } finally {await rm(extracted,{recursive:true,force:true});}
  closure.push({name,version:metadata.version,lockEntrySha256:hash(JSON.stringify(expected)),archiveIntegrity:integrity,files:sourceFiles,dependencies:Object.keys(metadata.dependencies??{}).sort()});
 }
 return closure;
}
async function build(inputs:Map<string,Input>,entryPath:string,entryImports:Record<string,string>) {
 const loaded=new Map<string,string>();
 const entry=await readFile(resolve(root,entryPath));
 const temporary=await mkdtemp(resolve(tmpdir(),'math-projection-compiler-')),configPath=resolve(temporary,'tsconfig.json');
 await writeFile(configPath,compilerConfig,{mode:0o400});
 try {
 const result=await Bun.build({entrypoints:['projection-entry'],root,target:'bun',format:'esm',minify:false,splitting:false,metafile:true,tsconfig:configPath,
  plugins:[{name:'immutable-canonical-projection',setup(build) {
   build.onResolve({filter:/.*/},args=>{
    if(!args.importer&&args.path==='projection-entry')return {path:entryPath,namespace:'consumer-entry'};
    if(args.importer===entryPath&&entryImports[args.path]) {
     const key=entryImports[args.path]!,input=inputs.get(key);if(!input)throw Error('Missing canonical entry input');
     return {path:input.path,namespace:input.namespace};
    }
    if(externals.includes(args.path))return {path:args.path,external:true};
    if(args.path==='@palantirkc/ontology')return {path:'dist/index.js',namespace:'ontology-release'};
    if(args.path.startsWith('./')||args.path.startsWith('../')) {
     const importers=[...inputs.values()].filter(input=>input.path===args.importer);
     if(importers.length!==1)throw Error('Ambiguous canonical importer');
     const namespace=importers[0]!.namespace;
     const joined=posix.normalize(posix.join(posix.dirname(args.importer),args.path));
     const options=[joined,joined.replace(/\.js$/,'.ts'),joined+'.ts',joined+'.json'];
     const input=options.map(path=>inputs.get(namespace+':'+path)).find(Boolean);
     if(input)return {path:input.path,namespace:input.namespace};
    }
    throw Error('Unpinned canonical projection import: '+args.namespace+':'+args.importer+' -> '+args.path);
   });
   build.onLoad({filter:/.*/,namespace:'consumer-entry'},()=>{
    loaded.set('consumer-entry:'+entryPath,hash(entry));return {contents:entry.toString('utf8'),loader:'ts'};
   });
   for(const namespace of new Set([...inputs.values()].map(input=>input.namespace)))build.onLoad({filter:/.*/,namespace},args=>{
    const input=inputs.get(namespace+':'+args.path);if(!input)throw Error('Unpinned canonical input');
    if(!Buffer.from(input.bytes.toString('utf8')).equals(input.bytes))throw Error('NonUTF8 executable projection input');
    loaded.set(namespace+':'+input.path,input.sha256);
    return {contents:input.bytes.toString('utf8'),loader:input.path.endsWith('.json')?'json':input.path.endsWith('.ts')?'ts':'js'};
   });
  }}]});
 if(!result.success)throw Error(result.logs.map(String).join('\n'));
 if(result.outputs.length!==1||!result.metafile)throw Error('Unexpected projection output graph');
 const graph=result.metafile;
 if(Object.keys(graph.inputs).sort().join('|')!==[...loaded.keys()].sort().join('|'))throw Error('Projection loaded graph differs');
 if(!(await readFile(configPath)).equals(Buffer.from(compilerConfig))||!entry.equals(await readFile(resolve(root,entryPath))))throw Error('Projection compiler input changed during build');
 return {bytes:Buffer.from(await result.outputs[0]!.arrayBuffer()),compiledInputs:[...loaded].sort(([a],[b])=>a.localeCompare(b)).map(([path,sha256])=>({path,sha256,...graph.inputs[path]}))};
 } finally {await rm(temporary,{recursive:true,force:true});}
}
async function coreInputs(coreRoot:string) {
 const lockBytes=await readFile(resolve(root,'harness/agent-platform.lock.json'));
 const pin=JSON.parse(lockBytes.toString());
 if(pin.commit!=='ffba2462a08b9f8c83c6f87b1043403e5cb748d7'||pin.files.length!==17||pin.installedOntologyFiles.length!==38)throw Error('Canonical core pin changed');
 const inputs=new Map<string,Input>(),fixture=[];
 for(const file of pin.files) {
  const bytes=git(coreRoot,'show',pin.commit+':'+file.path);
  if(hash(bytes)!==file.sha256||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==file.gitBlobSha1)throw Error('Immutable canonical Git bytes differ: '+file.path);
  inputs.set('core-source:'+file.path,{namespace:'core-source',path:file.path,bytes,sha256:file.sha256});
  fixture.push({kind:'source',path:file.path,sha256:file.sha256,base64:bytes.toString('base64')});
 }
 const contextPath=resolve(coreRoot,'packages/work-continuity/src/context/source.ts');
 const ontologyRoot=await realpath(resolve(dirname(Bun.resolveSync('@palantirkc/ontology',dirname(contextPath))),'..'));
 for(const file of pin.installedOntologyFiles) {
  const path=resolve(ontologyRoot,file.path);if(await realpath(path)!==path)throw Error('Unsafe immutable Ontology input');
  const bytes=await readFile(path);if(hash(bytes)!==file.sha256)throw Error('Immutable Ontology bytes differ: '+file.path);
  inputs.set('ontology-release:'+file.path,{namespace:'ontology-release',path:file.path,bytes,sha256:file.sha256});
  fixture.push({kind:'ontology',path:file.path,sha256:file.sha256,base64:bytes.toString('base64')});
 }
 return {pin,lockBytes,inputs,fixture};
}
async function coreProjection(coreRoot:string,write:boolean) {
 const {pin,lockBytes,inputs,fixture}=await coreInputs(coreRoot);
 const result=await build(inputs,'ci/canonical-api.entry.ts',{
  'canonical:ontology-validation':'core-source:packages/ontology/src/validation.ts',
  'canonical:context-validation':'core-source:packages/work-continuity/src/context/validation.ts',
  'canonical:context-source':'core-source:packages/work-continuity/src/context/source.ts',
 });
 const fixtureBytes=Buffer.from(json({schema:'math.canonical-test-inputs.v1',canonicalLockSha256:hash(lockBytes),commit:pin.commit,sourceFiles:17,ontologyFiles:38,recordClass:'GeneratedTestDependencyFixtureNotCloneOrNativeProvider',inputs:fixture}));
 const manifest={schema:'math.canonical-api-projection.v1',codeOwner:'agent-platform',generatedOnly:true,nativePermissionGranted:false,
  source:{repository:pin.repository,commit:pin.commit,tree:git(coreRoot,'rev-parse',pin.commit+'^{tree}').toString().trim(),canonicalLockSha256:hash(lockBytes),inputs:[...inputs.values()].map(({namespace,path,sha256})=>({namespace,path,sha256}))},
  compiler:{name:'Bun',version:Bun.version,revision:Bun.revision,sha256:hash(await readFile(process.execPath)),bytes:(await stat(process.execPath)).size},
  build:{target:'bun',format:'esm',minify:false,splitting:false,tsconfigSha256:hash(compilerConfig)},
  generationInputs:await Promise.all(['ci/generate-projection.ts','ci/canonical-api.entry.ts','scripts/canonical-projection.ts'].map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))}))),
  externalSpecifiers:externals,externalPackages:await externalClosure(Bun.JSONC.parse(git(coreRoot,'show',pin.commit+':bun.lock').toString())),
  compiledInputs:result.compiledInputs,generated:{path:'ci/generated/canonical-api.js',sha256:hash(result.bytes)},fixture:{path:'ci/generated/canonical-test-inputs.json',sha256:hash(fixtureBytes)},
  qualification:'compiled-canonical-ci-projection; not clone/install/native-provider proof'};
 const manifestBytes=Buffer.from(json(manifest));
 const outputs=[['ci/generated/canonical-api.js',result.bytes],['ci/generated/canonical-test-inputs.json',fixtureBytes],['ci/generated/canonical-api.manifest.json',manifestBytes]] as const;
 for(const [path,bytes] of outputs) {
  await emit(path,bytes,write);
 }
 console.log(json({status:'pass',mode:write?'generate':'verify',source:manifest.source.commit,inputs:inputs.size,compiledInputs:result.compiledInputs.length,outputBytes:result.bytes.length,fixtureBytes:fixtureBytes.length,nativePermissionGranted:false}));
}
async function reviewProjection(coreRoot:string,reviewRoot:string,write:boolean) {
 const {inputs:core,pin}=await coreInputs(coreRoot);
 const providerBytes=await readFile(resolve(root,'harness/common-ci-provider.json')),provider=JSON.parse(providerBytes.toString());
 if(provider.schema!=='math.owner-review-provider.v1'||provider.codeOwner!=='agent-platform'||provider.nativePermissionGranted!==false||
  provider.source.repository!==pin.repository||!/^[a-f0-9]{40}$/.test(provider.source.commit)||!/^[a-f0-9]{40}$/.test(provider.source.tree)||
  provider.source.inputs.map((p:any)=>p.path).join('|')!=='ci/quality/receipt-validation-gate.ts|ci/quality/receipt-validator.ts')throw Error('Invalid exact review provider pin');
 if(git(reviewRoot,'rev-parse',provider.source.commit+'^{tree}').toString().trim()!==provider.source.tree)throw Error('Review provider tree differs');
 const inputs=new Map<string,Input>([...core].filter(([,input])=>input.namespace==='ontology-release'));
 for(const file of provider.source.inputs) {
  const bytes=git(reviewRoot,'show',provider.source.commit+':'+file.path);
  if(hash(bytes)!==file.sha256)throw Error('Immutable owner review API drift');
  inputs.set('review-source:'+file.path,{namespace:'review-source',path:file.path,bytes,sha256:file.sha256});
 }
 const result=await build(inputs,'ci/native-review.entry.ts',{'canonical:owner-review':'review-source:ci/quality/receipt-validation-gate.ts'});
 const manifest={schema:'math.owner-review-projection.v1',codeOwner:'agent-platform',generatedOnly:true,nativePermissionGranted:false,
  source:{...provider.source,providerPinSha256:hash(providerBytes)},
  canonicalCoreManifestSha256:hash(await readFile(resolve(root,'ci/generated/canonical-api.manifest.json'))),
  compiler:{name:'Bun',version:Bun.version,revision:Bun.revision,sha256:hash(await readFile(process.execPath)),bytes:(await stat(process.execPath)).size},
  build:{target:'bun',format:'esm',minify:false,splitting:false,tsconfigSha256:hash(compilerConfig)},
  generationInputs:await Promise.all(['ci/generate-projection.ts','ci/native-review.entry.ts','scripts/canonical-projection.ts','ci/native-review.ts'].map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))}))),
  externalSpecifiers:externals,compiledInputs:result.compiledInputs,generated:{path:'ci/generated/native-review.js',sha256:hash(result.bytes)},
  qualification:'generated-owner-scoped-review-verifier; no native activation or authentication inferred'};
 for(const [path,bytes]of [['ci/generated/native-review.js',result.bytes],['ci/generated/native-review.manifest.json',Buffer.from(json(manifest))]] as const) {
  await emit(path,bytes,write);
 }
 console.log(json({status:'pass',mode:write?'generate':'verify',reviewProvider:provider.source.commit,inputs:inputs.size,compiledInputs:result.compiledInputs.length,outputBytes:result.bytes.length,nativePermissionGranted:false}));
}
if(import.meta.main) {
 if(Bun.version!=='1.4.3')throw Error('Projection regeneration requires the reviewed Bun1.4.3 compiler');
 const existing=resolve(root,'ci/generated/canonical-api.manifest.json');
 if(existsSync(existing)) {
  const compiler=JSON.parse(await readFile(existing,'utf8')).compiler;
  if(compiler.version!==Bun.version||compiler.revision!==Bun.revision||compiler.sha256!==hash(await readFile(process.execPath))||compiler.bytes!==(await stat(process.execPath)).size)throw Error('Pinned projection compiler changed; review a compiler successor explicitly');
 }
 const [mode,coreRoot,...args]=Bun.argv.slice(2);
 if(!coreRoot||!['core','review'].includes(mode??''))throw Error('Usage: bun ci/generate-projection.ts core <core-root> [--write] | review <core-root> <review-root> [--write]');
 if(mode==='core') {if(args.length>1||(args[0]&&args[0]!=='--write'))throw Error('Invalid core generation arguments');await coreProjection(resolve(coreRoot),args[0]==='--write');}
 else {const [reviewRoot,flag,...extra]=args;if(!reviewRoot||extra.length||(flag&&flag!=='--write'))throw Error('Invalid review generation arguments');await reviewProjection(resolve(coreRoot),resolve(reviewRoot),flag==='--write');}
}
