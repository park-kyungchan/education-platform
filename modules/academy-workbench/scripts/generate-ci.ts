/** Transport-only generator: immutable Git and locked archives own every executable input. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,readdirSync,lstatSync,realpathSync,statSync} from 'node:fs';
import {resolve,dirname,posix,join} from 'node:path';
import {tmpdir} from 'node:os';
import {gunzipSync} from 'node:zlib';
const root=resolve(import.meta.dir,'..'),providerPath='ci/provider.json',outputPath='ci/generated/native-review-gate.js',kind:string='academy',generatorPath='scripts/generate-ci.ts';
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
const packages=['ajv','ajv-formats','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string'];
const builtin=['node:crypto','node:fs/promises','node:path'];
const sourcePaths=['ci/quality/receipt-validation-gate.ts','ci/quality/receipt-validator.ts'];
const commit='d754776b2d513d30ccf8fb4772ee67a4afb7b500';
const ontologyHash='3f9995d0b91d2ad39dfc7cedbb6e35b1cb9d29c2e57223ca0c076d2030319406';
const compilerHash='7ce7d6b654eddeec20afddf2396317fba6dc19ab52788a27e894e1806bf8f24b';
const [commonRoot,archiveRoot,mode,...extra]=Bun.argv.slice(2);
if(!commonRoot||!archiveRoot||(mode&&mode!=='--write')||extra.length)throw Error('Usage: bun '+generatorPath+' <immutable-common-git-root> <locked-npm-archive-root> [--write]');
if(Bun.version!=='1.4.3'||Bun.revision!=='c6da4a4d3010e5553438c60f6bd76d981976867c'||hash(readFileSync(process.execPath))!==compilerHash)throw Error('Pinned Bun1.4.3 compiler mismatch');
const provider=JSON.parse(readFileSync(resolve(root,providerPath),'utf8'));
if(provider.schema!==kind+'.owner-review-projection.v1'||provider.codeOwner!=='agent-platform'||provider.nativePermissionGranted!==false||provider.source.commit!==commit||provider.source.inputs.map((p:any)=>p.path).join('|')!==sourcePaths.join('|'))throw Error('Invalid fixed canonical review provider');
const git=(...args:string[])=>execFileSync('git',['-C',resolve(commonRoot),...args],{maxBuffer:16*1024*1024});
if(git('rev-parse',commit+'^{tree}').toString().trim()!==provider.source.tree)throw Error('Immutable common tree mismatch');
const config='{"compilerOptions":{}}\n',temporary=mkdtempSync(join(tmpdir(),kind+'-owner-review-'));
const inputs=new Map<string,Buffer>();
const add=(path:string,bytes:Buffer)=>{if(inputs.has(path))throw Error('Duplicate projection input');inputs.set(path,bytes);};
const fileRows=(directory:string,prefix=''):Array<{path:string,bytes:Buffer}>=>readdirSync(resolve(directory,prefix)).flatMap(name=>{
 const path=posix.join(prefix,name),target=resolve(directory,path),stat=lstatSync(target);
 if(stat.isDirectory())return fileRows(directory,path);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Nonregular archive source');
 return [{path,bytes:readFileSync(target)}];
}).sort((a,b)=>a.path.localeCompare(b.path));
function unpack(archive:Buffer,label:string){
 const file=resolve(temporary,label+'.tgz'),directory=resolve(temporary,label);writeFileSync(file,archive);mkdirSync(directory);
 const rows=execFileSync('tar',['-tzf',file],{encoding:'utf8',maxBuffer:4*1024*1024}).split('\n').filter(Boolean);
 if(rows.length>2048||rows.some(path=>!path.startsWith('package/')||path.includes('\\')||path.split('/').some(p=>p==='..'||p==='.')))throw Error('Unsafe dependency archive path');
 execFileSync('tar',['-xzf',file,'--strip-components=1','--no-same-owner','-C',directory]);return fileRows(directory);
}
let generated:Buffer,compiledInputs:any[],ontology:any,externalPackages:any[]=[],licenses:string[]=['Generated from the exact SHA512-verified public dependency archives.\n'];
try{
 for(const pin of provider.source.inputs){const bytes=git('show',commit+':'+pin.path);if(hash(bytes)!==pin.sha256)throw Error('Canonical source hash mismatch');add('review/'+pin.path,bytes);}
 const archive=git('show',commit+':releases/palantirkc-ontology-0.2.0.tgz');if(hash(archive)!==ontologyHash)throw Error('Immutable Ontology0.2.0 archive changed');
 const ontologyFiles=unpack(archive,'ontology');
 if(ontologyFiles.length!==38)throw Error('Immutable Ontology file denominator changed');
 for(const file of ontologyFiles)add('ontology/'+file.path,file.bytes);
 ontology={repository:provider.source.repository,sourceCommit:commit,archivePath:'releases/palantirkc-ontology-0.2.0.tgz',archiveSha256:ontologyHash,version:'0.2.0',files:ontologyFiles.map(({path,bytes})=>({path,sha256:hash(bytes)}))};
 if(kind==='education'){
  if(hash(readFileSync(resolve(root,ontology.archivePath)))!==ontologyHash)throw Error('Existing Education immutable Ontology differs');
 }else{
  const pin=JSON.parse(readFileSync(resolve(root,'harness/agent-platform.lock.json'),'utf8'));
  if(pin.commit!=='ffba2462a08b9f8c83c6f87b1043403e5cb748d7'||pin.files.length!==17||pin.installedOntologyFiles.length!==38||pin.files.find((p:any)=>p.path===ontology.archivePath)?.sha256!==ontologyHash||JSON.stringify(pin.installedOntologyFiles.map((p:any)=>({path:p.path,sha256:p.sha256})).sort((a:any,b:any)=>a.path.localeCompare(b.path)))!==JSON.stringify(ontology.files))throw Error('Existing Academy immutable core/Ontology pin differs');
  const cache=readFileSync(resolve(root,provider.legacyDependency.archivePath));
  const bundle=JSON.parse(gunzipSync(cache).toString());
  if(bundle.commit!==pin.commit||bundle.files.length!==17||provider.legacyDependency.lockSha256!==hash(readFileSync(resolve(root,'harness/agent-platform.lock.json'))))throw Error('Legacy Academy source cache identity changed');
  for(let i=0;i<pin.files.length;i++){const row=bundle.files[i],expected=pin.files[i];if(row.path!==expected.path||hash(Buffer.from(row.bytesBase64,'base64'))!==expected.sha256)throw Error('Legacy source cache drift');}
 }
 const lockBytes=git('show',commit+':bun.lock'),lock=Bun.JSONC.parse(lockBytes.toString()) as any;
 provider.dependenciesLock={sourceCommit:commit,path:'bun.lock',sha256:hash(lockBytes)};
 for(const name of packages){
  const row=lock.packages[name],version=row?.[0]?.slice(name.length+1),integrity=row?.at(-1);
  if(typeof version!=='string'||typeof integrity!=='string'||!integrity.startsWith('sha512-'))throw Error('Canonical external lock absent');
  const archive=readFileSync(resolve(archiveRoot,name+'-'+version+'.tgz'));
  if(archive.length>2097152||createHash('sha512').update(archive).digest('base64')!==integrity.slice(7))throw Error('Locked dependency archive integrity mismatch');
  const files=unpack(archive,name),metadata=JSON.parse(files.find(p=>p.path==='package.json')!.bytes.toString());
  if(metadata.name!==name||metadata.version!==version||Object.keys(metadata.dependencies??{}).some(name=>!packages.includes(name)))throw Error('Unexpected external package closure');
  const license=files.find(file=>/^license(?:\.txt)?$/i.test(file.path));if(!license)throw Error('Locked dependency license absent');licenses.push('\n===== '+name+'@'+version+' =====\n'+license.bytes.toString());
  for(const file of files)add('npm/'+name+'/'+file.path,file.bytes);
  externalPackages.push({name,version,lockEntrySha256:hash(JSON.stringify(row)),archiveIntegrity:integrity,archiveSha256:hash(archive),files:files.map(({path,bytes})=>({path,sha256:hash(bytes)})),dependencies:Object.keys(metadata.dependencies??{}).sort()});
 }
 const entry=readFileSync(resolve(root,'ci/native-review.entry.ts'));add('consumer/ci/native-review.entry.ts',entry);
 const loaded=new Set<string>(),configPath=resolve(temporary,'tsconfig.json');writeFileSync(configPath,config,{mode:0o400});
 const virtual:Record<string,string>={'canonical:owner-review':'review/ci/quality/receipt-validation-gate.ts','canonical:review-manifest':'review/ci/quality/receipt-validator.ts','canonical:ontology':'ontology/dist/index.js'};
 const choose=(path:string)=>[path,path.replace(/\.js$/,'.ts'),path+'.ts',path+'.js',path+'.json',path+'/index.js'].find(p=>inputs.has(p));
 const result=await Bun.build({entrypoints:['projection-entry'],root:temporary,target:'bun',format:'esm',minify:false,splitting:false,metafile:true,tsconfig:configPath,
 plugins:[{name:'immutable-owner-review-inputs',setup(build){build.onResolve({filter:/.*/},args=>{
  if(!args.importer&&args.path==='projection-entry')return {path:'consumer/ci/native-review.entry.ts',namespace:'immutable'};
  if(builtin.includes(args.path))return{path:args.path,external:true};
  if(args.importer==='consumer/ci/native-review.entry.ts'&&virtual[args.path])return {path:virtual[args.path],namespace:'immutable'};
  if(args.path==='@palantirkc/ontology')return{path:'ontology/dist/index.js',namespace:'immutable'};
  let target:string|undefined;
  if(args.path.startsWith('./')||args.path.startsWith('../'))target=choose(posix.normalize(posix.join(posix.dirname(args.importer),args.path)));
  else{const [name,...suffix]=args.path.split('/');if(packages.includes(name!)){let sub=suffix.join('/');if(!sub){const metadata=JSON.parse(inputs.get('npm/'+name+'/package.json')!.toString());sub=metadata.main??'index.js';}target=choose('npm/'+name+'/'+sub);}}
  if(!target)throw Error('Unpinned transitive projection import: '+args.importer+' -> '+args.path);
  return{path:target,namespace:'immutable'};
 });build.onLoad({filter:/.*/,namespace:'immutable'},args=>{const bytes=inputs.get(args.path);if(!bytes||!Buffer.from(bytes.toString()).equals(bytes))throw Error('Unknown/nonUTF8 compiler input');loaded.add('immutable:'+args.path);return{contents:bytes.toString(),loader:args.path.endsWith('.json')?'json':args.path.endsWith('.ts')?'ts':'js'};});}}]});
 if(!result.success||result.outputs.length!==1||!result.metafile)throw Error('Canonical owner review build failed: '+result.logs.map(String).join('\n'));
 if(Object.keys(result.metafile.inputs).sort().join('|')!==[...loaded].sort().join('|'))throw Error('Compiled source denominator drift');
 if(!entry.equals(readFileSync(resolve(root,'ci/native-review.entry.ts')))||readFileSync(configPath,'utf8')!==config)throw Error('Compiler input changed');
 generated=Buffer.from(await result.outputs[0]!.arrayBuffer());compiledInputs=Object.entries(result.metafile.inputs).sort(([a],[b])=>a.localeCompare(b)).map(([path,metadata])=>({path,sha256:hash(inputs.get(path.slice('immutable:'.length))!),...metadata}));
}finally{rmSync(temporary,{recursive:true,force:true});}
const generationPaths=[generatorPath,'ci/native-review.entry.ts','ci/verify-projection.ts'];
if(kind==='academy')generationPaths.push('ci/require-v2-receipt.ts');
provider.ontology=ontology;provider.externalPackages=externalPackages;
provider.compiler={name:'Bun',version:Bun.version,revision:Bun.revision,sha256:compilerHash,bytes:statSync(process.execPath).size};
provider.build={target:'bun',format:'esm',minify:false,splitting:false,tsconfigSha256:hash(config)};
provider.generationInputs=generationPaths.map(path=>({path,sha256:hash(readFileSync(resolve(root,path)))}));
const licenseBytes=Buffer.from(licenses.join('\n'));
provider.compiledInputs=compiledInputs!;provider.generated=[{path:outputPath,sha256:hash(generated!)},{path:'ci/THIRD-PARTY-LICENSES.txt',sha256:hash(licenseBytes)}];
provider.qualification='bundled immutable owner review API, Ontology0.2.0 and integrity-verified locked public dependencies; no native authentication/activation or domain acceptance inferred';
if(kind==='academy')provider.generated.push({path:provider.legacyDependency.archivePath,sha256:hash(readFileSync(resolve(root,provider.legacyDependency.archivePath)))});
const bytes=Buffer.from(json(provider));
if(mode==='--write'){writeFileSync(resolve(root,outputPath),generated!);writeFileSync(resolve(root,'ci/THIRD-PARTY-LICENSES.txt'),licenseBytes);writeFileSync(resolve(root,providerPath),bytes);}
else if(!generated!.equals(readFileSync(resolve(root,outputPath)))||!bytes.equals(readFileSync(resolve(root,providerPath)))||!licenseBytes.equals(readFileSync(resolve(root,'ci/THIRD-PARTY-LICENSES.txt'))))throw Error('Generated owner review projection is not reproducible');
console.log(JSON.stringify({status:'pass',mode:mode==='--write'?'generate':'verify',sourceCommit:commit,compiledInputs:compiledInputs!.length,dependencyPackages:externalPackages.length,ontologyFiles:ontology.files.length,outputBytes:generated!.length,nativePermissionGranted:false}));
