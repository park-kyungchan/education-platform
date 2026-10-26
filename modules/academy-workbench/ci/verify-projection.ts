/** Projection custody only; canonical generated code owns all review and Ontology predicates. */
import {createHash} from 'node:crypto';
import {readFile,realpath,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
const moduleRoot=resolve(import.meta.dir,'..'),kind:string='academy',providerPath='ci/provider.json',outputPath='ci/generated/native-review-gate.js',generatorPath='scripts/generate-ci.ts';
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const policy={"repository":"park-kyungchan/academy-workbench","projectId":"academy-workbench","domainId":"academy-operations","semanticOwner":"academy-workbench","scope":"month-end-mcp-source-bridge","statusContext":"native-independent-review","publisher":{"id":"241037670","login":"park-kyungchan","type":"User"}};
const canonical=[{path:'ci/quality/receipt-validation-gate.ts',sha256:'1c0ce467315438c97a535b72b1e1f35fb7d4de50ecf9baef6f0255b80c9f183f'},{path:'ci/quality/receipt-validator.ts',sha256:'ac0e84e1742e3870f799fe3b2016abcc0d8ee48e8a347881fa7ed66a68563879'}];
async function bytes(root:string,path:string){if(!/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(path)||path.split('/').some(p=>p==='..'||p==='.'))throw Error('Unsafe projection path');const target=resolve(root,path);if(await realpath(target)!==target||!(await lstat(target)).isFile())throw Error('Noncanonical projection file');const value=await readFile(target);if(value.length>4194304)throw Error('Projection input exceeds finite bound');return value;}
export async function verifyProjection(root=moduleRoot){
 root=await realpath(root);const provider=JSON.parse((await bytes(root,providerPath)).toString());
 if(provider.schema!==kind+'.owner-review-projection.v1'||provider.codeOwner!=='agent-platform'||provider.generatedOnly!==true||provider.sourceOnly!==true||provider.nativePermissionGranted!==false||provider.runtimeAuthority!==false||provider.privateWorkOrSessionDataIncluded!==false)throw Error('Invalid owner review projection ownership');
 if(!same(provider.policy,policy)||!same(provider.source,{repository:'https://github.com/park-kyungchan/agent-platform.git',commit:'d754776b2d513d30ccf8fb4772ee67a4afb7b500',tree:'13e90dee21d39aa8b03402839e4f0bb9c9dfe58e',inputs:canonical}))throw Error('Fixed canonical source or owner policy drift');
 if(provider.compiler.name!=='Bun'||provider.compiler.version!=='1.4.3'||provider.compiler.revision!=='c6da4a4d3010e5553438c60f6bd76d981976867c'||provider.compiler.sha256!=='7ce7d6b654eddeec20afddf2396317fba6dc19ab52788a27e894e1806bf8f24b'||provider.compiler.bytes!==88979072)throw Error('Projection compiler drift');
 if(!same(provider.build,{target:'bun',format:'esm',minify:false,splitting:false,tsconfigSha256:hash('{"compilerOptions":{}}\n')}))throw Error('Projection compiler configuration drift');
 const generation=[generatorPath,'ci/native-review.entry.ts','ci/verify-projection.ts'];if(kind==='academy')generation.push('ci/require-v2-receipt.ts');
 if(!same(provider.generationInputs.map((p:any)=>p.path),generation)||provider.generator!==generatorPath||provider.generationEntry!=='ci/native-review.entry.ts')throw Error('Generation input denominator changed');
 for(const pin of provider.generationInputs)if(hash(await bytes(root,pin.path))!==pin.sha256)throw Error('Generation source drift');
 const ontology=provider.ontology;
 if(ontology.repository!==provider.source.repository||ontology.sourceCommit!==provider.source.commit||ontology.archivePath!=='releases/palantirkc-ontology-0.2.0.tgz'||ontology.version!=='0.2.0'||ontology.archiveSha256!=='3f9995d0b91d2ad39dfc7cedbb6e35b1cb9d29c2e57223ca0c076d2030319406'||ontology.files.length!==38)throw Error('Immutable Ontology0.2.0 source identity drift');
 if(kind==='education') {if(hash(await bytes(root,ontology.archivePath))!==ontology.archiveSha256)throw Error('Existing immutable Ontology drift');}
 else{
  const lock=await bytes(root,'harness/agent-platform.lock.json'),pin=JSON.parse(lock.toString());
  if(pin.commit!=='ffba2462a08b9f8c83c6f87b1043403e5cb748d7'||pin.files.length!==17||pin.installedOntologyFiles.length!==38||provider.legacyDependency.commit!==pin.commit||provider.legacyDependency.repository!==pin.repository||provider.legacyDependency.lockSha256!==hash(lock)||provider.legacyDependency.sourceFileCount!==17||provider.legacyDependency.generatedDependencyCopy!==true||provider.legacyDependency.independentlyMaintainedImplementation!==false||provider.legacyDependency.gitCheckoutClaimed!==false)throw Error('Immutable consumer dependency lineage changed');
  if(!same([...pin.installedOntologyFiles].map((p:any)=>({path:p.path,sha256:p.sha256})).sort((a:any,b:any)=>a.path.localeCompare(b.path)),ontology.files))throw Error('Ontology release file pins differ from existing consumer');
 }
 if(!same(provider.dependenciesLock,{sourceCommit:provider.source.commit,path:'bun.lock',sha256:'d7806f9e70a67ed59aa1121763e7ad766a3487222f7ff48c047676c1409f1a42'}))throw Error('Canonical public dependency lock drift');
 const packageNames=['ajv','ajv-formats','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string'];
 if(!same(provider.externalPackages.map((p:any)=>p.name),packageNames))throw Error('Bundled dependency denominator changed');
 const allowed=new Map<string,string>(canonical.map(p=>['immutable:review/'+p.path,p.sha256]));
 const add=(path:string,digest:string)=>{if(allowed.has(path)||!/^[a-f0-9]{64}$/.test(digest))throw Error('Duplicate/invalid compiled input pin');allowed.set(path,digest);};
 for(const pin of ontology.files)add('immutable:ontology/'+pin.path,pin.sha256);
 for(const pkg of provider.externalPackages){if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pkg.version)||!/^sha512-[A-Za-z0-9+/]+=*$/.test(pkg.archiveIntegrity)||!/^[a-f0-9]{64}$/.test(pkg.archiveSha256)||!/^[a-f0-9]{64}$/.test(pkg.lockEntrySha256)||pkg.files.length<1||pkg.files.length>2048||pkg.dependencies.some((name:string)=>!packageNames.includes(name)))throw Error('Bundled dependency provenance invalid');for(const pin of pkg.files){if(!/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(pin.path)||pin.path.split('/').some((p:string)=>p==='..'||p==='.'))throw Error('Unsafe dependency source pin');add('immutable:npm/'+pkg.name+'/'+pin.path,pin.sha256);}}
 add('immutable:consumer/ci/native-review.entry.ts',provider.generationInputs.find((p:any)=>p.path==='ci/native-review.entry.ts').sha256);
 if(!Array.isArray(provider.compiledInputs)||provider.compiledInputs.length<10||provider.compiledInputs.length>2048)throw Error('Compiled source closure outside bound');
 const seen=new Set<string>();
 for(const input of provider.compiledInputs){if(seen.has(input.path)||allowed.get(input.path)!==input.sha256||!Number.isSafeInteger(input.bytes)||input.bytes<=0||!Array.isArray(input.imports))throw Error('Compiled source pin mismatch');seen.add(input.path);for(const edge of input.imports)if(edge.external?!['crypto','fs/promises','path'].includes(edge.path):!allowed.has(edge.path))throw Error('Unpinned compiled dependency');}
 for(const path of ['immutable:consumer/ci/native-review.entry.ts',...canonical.map(p=>'immutable:review/'+p.path),'immutable:ontology/dist/index.js','immutable:ontology/dist/validation.js'])if(!seen.has(path))throw Error('Required canonical compiled input absent');
 const outputs=[outputPath,'ci/THIRD-PARTY-LICENSES.txt'];if(kind==='academy')outputs.push('ci/generated/agent-platform-ffba-source.json.gz');
 if(!same(provider.generated.map((p:any)=>p.path),outputs))throw Error('Generated output denominator changed');
 for(const output of provider.generated)if(hash(await bytes(root,output.path))!==output.sha256)throw Error('Generated projection byte drift');
 return{status:'pass',schema:provider.schema,sourceCommit:provider.source.commit,compiledInputs:seen.size,dependencyPackages:6,ontologyFiles:38,nativePermissionGranted:false};
}
if(import.meta.main)console.log(JSON.stringify(await verifyProjection()));
