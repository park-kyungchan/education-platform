/** Projection custody only. Validation and bounded source IO remain canonical code. */
import { createHash } from 'node:crypto';
import { readFile, realpath, readdir, lstat } from 'node:fs/promises';
import { resolve, dirname, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleRoot=resolve(import.meta.dir,'..');
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const packageNames=['ajv','ajv-formats','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string'];
const externalSpecifiers=['ajv/dist/2020.js','ajv-formats','node:crypto','node:fs/promises','node:path'];
const generationPaths=['ci/generate-projection.ts','ci/canonical-api.entry.ts','scripts/canonical-projection.ts'];
const canonicalCommit='ffba2462a08b9f8c83c6f87b1043403e5cb748d7';
async function exactBytes(path:string,max=2097152) {
 if(await realpath(path)!==path)throw Error('Projection path must be canonical');
 const bytes=await readFile(path);if(bytes.length>max)throw Error('Projection input exceeds bound');return bytes;
}
async function files(directory:string,prefix=''):Promise<string[]> {
 const result:string[]=[];
 for(const entry of await readdir(resolve(directory,prefix),{withFileTypes:true})) {
  const path=posix.join(prefix,entry.name);
  if(entry.isDirectory())result.push(...await files(directory,path));
  else if(entry.isFile())result.push(path);
  else throw Error('Unexpected external dependency file type');
 }
 return result.sort();
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function keys(value:any,expected:string[]) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...expected].sort().join('|'))throw Error('Unexpected projection metadata fields');
}
/** Check the actual executable import locations, including physical paths that a
 * previously cached resolver result must never be allowed to hide. */
async function verifyImporterClosure(root:string,importer:string,externalRoots:Map<string,string>,dependencies:any[]) {
 if(await realpath(importer)!==importer)throw Error('Projection importer path must be canonical');
 const lookupDirectories=new Set<string>();
 const inspected=new Set<string>();
 async function inspectLookups(start:string) {
  let directory=start;
  for(;;) {
   if(directory!==root&&!directory.startsWith(root+'/'))throw Error('External importer escaped consumer');
   const lookup=resolve(directory,'node_modules');
   if(!inspected.has(lookup)) {
    inspected.add(lookup);lookupDirectories.add(lookup);
    let entry;try{entry=await lstat(lookup);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(entry) {
     if(!entry.isDirectory()||entry.isSymbolicLink()||await realpath(lookup)!==lookup)throw Error('Noncanonical external lookup directory');
     if(directory!==root)for(const name of packageNames) {
      try{await lstat(resolve(lookup,name));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
      throw Error('External dependency physical lookup shadow: '+resolve(lookup,name));
     }
    }
   }
   if(directory===root)break;directory=dirname(directory);
  }
 }
 const resolutions:{importer:string;specifier:string;path:string}[]=[];
 async function resolveExact(directory:string,specifier:string,expected:string) {
  const actual=Bun.resolveSync(specifier,directory);
  if(actual!==expected||await realpath(actual)!==actual)throw Error('Actual projection importer resolution drift: '+specifier);
  resolutions.push({importer:directory,specifier,path:actual});
 }
 const importerDirectory=dirname(importer);await inspectLookups(importerDirectory);
 for(const name of packageNames) {
  const directory=externalRoots.get(name)!;
  if(directory!==resolve(root,'node_modules',name))throw Error('External dependency must use its fixed canonical root');
  await resolveExact(importerDirectory,name+'/package.json',resolve(directory,'package.json'));
  await resolveExact(importerDirectory,name,Bun.resolveSync(name,root));
 }
 for(const specifier of ['ajv/dist/2020.js','ajv-formats'])await resolveExact(importerDirectory,specifier,Bun.resolveSync(specifier,root));
 for(const dependency of dependencies) {
  const directory=externalRoots.get(dependency.name)!;
  const sourceDirectories=[...new Set<string>(dependency.files.filter((file:any)=>/\.(?:[cm]?js)$/.test(file.path)).map((file:any)=>dirname(resolve(directory,file.path))))].sort();
  for(const sourceDirectory of sourceDirectories) {
   await inspectLookups(sourceDirectory);
   for(const name of dependency.dependencies) {
    await resolveExact(sourceDirectory,name+'/package.json',resolve(externalRoots.get(name)!,'package.json'));
    await resolveExact(sourceDirectory,name,Bun.resolveSync(name,root));
   }
  }
 }
 return {importer,lookupDirectories:[...lookupDirectories].sort(),resolutions};
}
export async function verifyCanonicalProjection(root=moduleRoot) {
 root=await realpath(root);
 const lockBytes=await exactBytes(resolve(root,'harness/agent-platform.lock.json'));
 const pin=JSON.parse(lockBytes.toString());
 const manifest=JSON.parse((await exactBytes(resolve(root,'ci/generated/canonical-api.manifest.json'))).toString());
 keys(manifest,['schema','codeOwner','generatedOnly','nativePermissionGranted','source','compiler','build','generationInputs','externalSpecifiers','externalPackages','compiledInputs','generated','fixture','qualification']);
 keys(manifest.source,['repository','commit','tree','canonicalLockSha256','inputs']);
 keys(manifest.compiler,['name','version','revision','sha256','bytes']);
 keys(manifest.build,['target','format','minify','splitting','tsconfigSha256']);
 if(!same(manifest.build,{target:'bun',format:'esm',minify:false,splitting:false,tsconfigSha256:hash('{"compilerOptions":{}}\n')}))throw Error('Projection compiler configuration drift');
 keys(manifest.generated,['path','sha256']);keys(manifest.fixture,['path','sha256']);
 if(manifest.qualification!=='compiled-canonical-ci-projection; not clone/install/native-provider proof')throw Error('Projection qualification drift');
 if(manifest.schema!=='math.canonical-api-projection.v1'||manifest.codeOwner!=='agent-platform'||manifest.generatedOnly!==true||manifest.nativePermissionGranted!==false||
  pin.commit!==canonicalCommit||manifest.source.commit!==canonicalCommit||manifest.source.repository!==pin.repository||manifest.source.canonicalLockSha256!==hash(lockBytes)||
  !/^[a-f0-9]{40}$/.test(manifest.source.tree)||pin.files.length!==17||pin.installedOntologyFiles.length!==38)throw Error('Canonical projection identity drift');
 const expected=[...pin.files.map((p:any)=>({namespace:'core-source',path:p.path,sha256:p.sha256})),...pin.installedOntologyFiles.map((p:any)=>({namespace:'ontology-release',path:p.path,sha256:p.sha256}))];
 if(!same(manifest.source.inputs,expected)||!same(manifest.externalSpecifiers,externalSpecifiers))throw Error('Canonical projection input closure drift');
 if(manifest.generated.path!=='ci/generated/canonical-api.js'||manifest.fixture.path!=='ci/generated/canonical-test-inputs.json')throw Error('Unexpected generated projection paths');
 for(const output of [manifest.generated,manifest.fixture])if(hash(await exactBytes(resolve(root,output.path)))!==output.sha256)throw Error('Generated canonical projection drift');
 if(!same(manifest.generationInputs.map((p:any)=>p.path),generationPaths))throw Error('Projection generator closure drift');
 for(const input of manifest.generationInputs){keys(input,['path','sha256']);if(hash(await exactBytes(resolve(root,input.path)))!==input.sha256)throw Error('Projection generation source drift');}
 const compiler=manifest.compiler;
 if(compiler.name!=='Bun'||compiler.version!=='1.4.3'||!/^[a-f0-9]{40}$/.test(compiler.revision)||!/^[a-f0-9]{64}$/.test(compiler.sha256)||!Number.isSafeInteger(compiler.bytes)||compiler.bytes<=0)throw Error('Invalid projection compiler provenance');
 const allowedInputs=new Map(expected.map(input=>[input.namespace+':'+input.path,input.sha256]));
 allowedInputs.set('consumer-entry:ci/canonical-api.entry.ts',manifest.generationInputs.find((p:any)=>p.path==='ci/canonical-api.entry.ts').sha256);
 const reached=new Set<string>();
 for(const input of manifest.compiledInputs) {
  keys(input,['path','sha256','bytes','imports','format']);
  if(reached.has(input.path)||allowedInputs.get(input.path)!==input.sha256||!Number.isSafeInteger(input.bytes)||input.bytes<=0||!Array.isArray(input.imports))throw Error('Compiled canonical graph drift');
  reached.add(input.path);
  for(const edge of input.imports){
   if(Object.keys(edge).some(key=>!['path','kind','external','original','with'].includes(key))||edge.kind!=='import-statement'||(edge.external!==undefined&&edge.external!==true))throw Error('Unexpected compiled import metadata');
   if(edge.external?!['ajv/dist/2020.js','ajv-formats','crypto','fs/promises','path'].includes(edge.path):!allowedInputs.has(edge.path))throw Error('Unexpected compiled import');
   if(edge.with!==undefined){keys(edge.with,['type']);if(edge.with.type!=='json')throw Error('Unexpected import attribute');}
  }
 }
 if(!reached.has('consumer-entry:ci/canonical-api.entry.ts'))throw Error('Compiled entry proof absent');
 const fixture=JSON.parse((await exactBytes(resolve(root,manifest.fixture.path))).toString());
 keys(fixture,['schema','canonicalLockSha256','commit','sourceFiles','ontologyFiles','recordClass','inputs']);
 if(fixture.schema!=='math.canonical-test-inputs.v1'||fixture.canonicalLockSha256!==hash(lockBytes)||fixture.commit!==canonicalCommit||fixture.sourceFiles!==17||fixture.ontologyFiles!==38||fixture.inputs.length!==55)throw Error('Canonical test fixture identity drift');
 for(let i=0;i<expected.length;i++) {
  const input=fixture.inputs[i],source=expected[i]!;
  keys(input,['kind','path','sha256','base64']);
  if(input.kind!==(source.namespace==='core-source'?'source':'ontology')||input.path!==source.path||input.sha256!==source.sha256||typeof input.base64!=='string'||hash(Buffer.from(input.base64,'base64'))!==source.sha256)throw Error('Canonical test fixture source drift');
 }
 const coreLock=Bun.JSONC.parse(Buffer.from(fixture.inputs.find((p:any)=>p.kind==='source'&&p.path==='bun.lock').base64,'base64').toString()) as any;
 const localLock=Bun.JSONC.parse((await exactBytes(resolve(root,'bun.lock'))).toString()) as any;
 if(!same(manifest.externalPackages.map((p:any)=>p.name),packageNames))throw Error('Unexpected external package closure');
 const externalRoots=new Map<string,string>();
 for(const dependency of manifest.externalPackages) {
  keys(dependency,['name','version','lockEntrySha256','archiveIntegrity','files','dependencies']);
  const locked=coreLock.packages[dependency.name];
  if(!same(localLock.packages[dependency.name],locked)||hash(JSON.stringify(locked))!==dependency.lockEntrySha256||dependency.archiveIntegrity!==locked.at(-1))throw Error('External dependency lock drift');
  const packageFile=Bun.resolveSync(dependency.name+'/package.json',root),directory=await realpath(dirname(packageFile));
  if(!directory.startsWith(root+'/node_modules/'))throw Error('External dependency resolves outside consumer');
  externalRoots.set(dependency.name,directory);
  const metadata=JSON.parse((await exactBytes(resolve(directory,'package.json'))).toString());
  if(metadata.name!==dependency.name||metadata.version!==dependency.version||locked[0]!==dependency.name+'@'+dependency.version||!same(Object.keys(metadata.dependencies??{}).sort(),dependency.dependencies))throw Error('External package identity drift');
  const sourceFiles=await files(directory);
  if(!same(sourceFiles,dependency.files.map((p:any)=>p.path)))throw Error('External dependency file set drift');
  for(const file of dependency.files){keys(file,['path','sha256']);if(hash(await exactBytes(resolve(directory,file.path)))!==file.sha256)throw Error('External dependency bytes drift');}
 }
 for(const dependency of manifest.externalPackages)for(const name of dependency.dependencies) {
  const actual=await realpath(dirname(Bun.resolveSync(name+'/package.json',externalRoots.get(dependency.name)!)));
  if(actual!==externalRoots.get(name))throw Error('External dependency import shadow');
 }
 const importerClosure=await verifyImporterClosure(root,resolve(root,manifest.generated.path),externalRoots,manifest.externalPackages);
 return {manifest,fixture,externalRoots,importerClosure,source:{root:resolve(root,'ci/generated'),commit:canonicalCommit,mode:'compiled-canonical-ci-projection',scope:pin.scope,fullNativeProviderClosureVerified:false,authority:'none',nativePermissionGranted:false}};
}
let loaded:{sha256:string;api:any}|undefined;
export async function loadCanonicalProjection() {
 const before=await verifyCanonicalProjection(),digest=before.manifest.generated.sha256;
 if(loaded&&loaded.sha256!==digest)throw Error('Canonical projection successor requires a fresh process');
 const path=resolve(moduleRoot,before.manifest.generated.path);
 if(!loaded&&Object.hasOwn(require.cache,path))throw Error('Canonical projection imported before source verification');
 const api=loaded?.api??await import(pathToFileURL(path).href);
 const exports=['checkSources','localContextIo','readExact','validateArtifact','validateCheckpoint','validateReferences','validateWorkContextRequest'];
 if(!same(Object.keys(api).sort(),exports))throw Error('Canonical projected API differs');
 const after=await verifyCanonicalProjection();if(after.manifest.generated.sha256!==digest||!same(after.importerClosure,before.importerClosure))throw Error('Canonical projection changed during import');
 loaded={sha256:digest,api};return {...api,source:after.source};
}
export async function verifyOwnerReviewProjection(root=moduleRoot) {
 root=await realpath(root);
 const core=await verifyCanonicalProjection(root);
 const providerBytes=await exactBytes(resolve(root,'harness/common-ci-provider.json')),provider=JSON.parse(providerBytes.toString());
 const manifest=JSON.parse((await exactBytes(resolve(root,'ci/generated/native-review.manifest.json'))).toString());
 keys(provider,['schema','codeOwner','nativePermissionGranted','source','policy']);
 keys(provider.source,['repository','commit','tree','inputs']);
 keys(provider.policy,['repository','projectId','domainId','semanticOwner','scope','statusContext','publisher']);
 keys(provider.policy.publisher,['id','login','type']);
 const project=JSON.parse((await exactBytes(resolve(root,'project.json'))).toString());
 if(provider.schema!=='math.owner-review-provider.v1'||provider.codeOwner!=='agent-platform'||provider.nativePermissionGranted!==false||
  provider.source.repository!=='https://github.com/park-kyungchan/agent-platform.git'||!/^[a-f0-9]{40}$/.test(provider.source.commit)||!/^[a-f0-9]{40}$/.test(provider.source.tree)||
  provider.source.inputs.map((p:any)=>p.path).join('|')!=='ci/quality/receipt-validation-gate.ts|ci/quality/receipt-validator.ts'||
  provider.policy.repository!=='park-kyungchan/math-research-module'||provider.policy.projectId!==project.projectId||provider.policy.domainId!==project.domainId||provider.policy.semanticOwner!==project.projectId||
  provider.policy.scope!=='portable-onboarding-source-ci'||provider.policy.statusContext!=='native-independent-review'||
  !same(provider.policy.publisher,{id:'241037670',login:'park-kyungchan',type:'User'}))throw Error('Owner review projection policy drift');
 for(const input of provider.source.inputs){keys(input,['path','sha256']);if(!/^[a-f0-9]{64}$/.test(input.sha256))throw Error('Invalid owner review source pin');}
 keys(manifest,['schema','codeOwner','generatedOnly','nativePermissionGranted','source','canonicalCoreManifestSha256','compiler','build','generationInputs','externalSpecifiers','compiledInputs','generated','qualification']);
 if(manifest.schema!=='math.owner-review-projection.v1'||manifest.codeOwner!=='agent-platform'||manifest.generatedOnly!==true||manifest.nativePermissionGranted!==false||
  manifest.qualification!=='generated-owner-scoped-review-verifier; no native activation or authentication inferred'||
  !same(manifest.source,{...provider.source,providerPinSha256:hash(providerBytes)})||manifest.canonicalCoreManifestSha256!==hash(await exactBytes(resolve(root,'ci/generated/canonical-api.manifest.json'))))throw Error('Owner review source identity drift');
 if(!same(manifest.compiler,core.manifest.compiler)||!same(manifest.build,core.manifest.build)||!same(manifest.externalSpecifiers,externalSpecifiers))throw Error('Owner review compiler closure drift');
 const generation=['ci/generate-projection.ts','ci/native-review.entry.ts','scripts/canonical-projection.ts','ci/native-review.ts'];
 if(!same(manifest.generationInputs.map((p:any)=>p.path),generation))throw Error('Owner review generation closure drift');
 for(const input of manifest.generationInputs){keys(input,['path','sha256']);if(hash(await exactBytes(resolve(root,input.path)))!==input.sha256)throw Error('Owner review generation source drift');}
 keys(manifest.generated,['path','sha256']);
 if(manifest.generated.path!=='ci/generated/native-review.js'||hash(await exactBytes(resolve(root,manifest.generated.path)))!==manifest.generated.sha256)throw Error('Generated owner review bytes drift');
 const allowed=new Map<string,string>([
  ...provider.source.inputs.map((p:any)=>['review-source:'+p.path,p.sha256]),
  ...core.manifest.source.inputs.filter((p:any)=>p.namespace==='ontology-release').map((p:any)=>['ontology-release:'+p.path,p.sha256]),
  ['consumer-entry:ci/native-review.entry.ts',manifest.generationInputs.find((p:any)=>p.path==='ci/native-review.entry.ts').sha256],
 ]);
 const reached=new Set<string>();
 for(const input of manifest.compiledInputs) {
  keys(input,['path','sha256','bytes','imports','format']);
  if(reached.has(input.path)||allowed.get(input.path)!==input.sha256||!Number.isSafeInteger(input.bytes)||input.bytes<=0||!Array.isArray(input.imports))throw Error('Owner review compiled graph drift');
  reached.add(input.path);
  for(const edge of input.imports){
   if(Object.keys(edge).some(key=>!['path','kind','external','original','with'].includes(key))||!['import-statement','dynamic-import'].includes(edge.kind)||(edge.external!==undefined&&edge.external!==true))throw Error('Unexpected owner review import metadata');
   if(edge.external?!['ajv/dist/2020.js','ajv-formats','crypto','fs/promises','path'].includes(edge.path):!allowed.has(edge.path))throw Error('Unpinned owner review compiled import');
   if(edge.with!==undefined){keys(edge.with,['type']);if(edge.with.type!=='json')throw Error('Unexpected owner review import attribute');}
  }
 }
 for(const path of ['consumer-entry:ci/native-review.entry.ts',...provider.source.inputs.map((p:any)=>'review-source:'+p.path)])if(!reached.has(path))throw Error('Required owner review input absent');
 const importerClosure=await verifyImporterClosure(root,resolve(root,manifest.generated.path),core.externalRoots,core.manifest.externalPackages);
 return {core,provider,manifest,importerClosure};
}
let loadedReview:{sha256:string;api:any}|undefined;
export async function loadOwnerReviewProjection() {
 const before=await verifyOwnerReviewProjection(),digest=before.manifest.generated.sha256,path=resolve(moduleRoot,before.manifest.generated.path);
 if(loadedReview&&loadedReview.sha256!==digest)throw Error('Owner review projection successor requires a fresh process');
 if(!loadedReview&&Object.hasOwn(require.cache,path))throw Error('Owner review projection imported before source verification');
 const api=loadedReview?.api??await import(pathToFileURL(path).href);
 if(!same(Object.keys(api).sort(),['policy','runReviewGate','validateOwnerScopedReviewWithEvidence'])||!same(api.policy,before.provider.policy))throw Error('Owner review entry API/policy differs');
 const after=await verifyOwnerReviewProjection();if(after.manifest.generated.sha256!==digest||!same(after.importerClosure,before.importerClosure))throw Error('Owner review projection changed during import');
 loadedReview={sha256:digest,api};return api;
}
