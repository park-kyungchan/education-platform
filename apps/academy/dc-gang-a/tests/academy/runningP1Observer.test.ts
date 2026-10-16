import {test,expect} from 'bun:test';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {canonicalProjection,validateP1Projection} from '../../src/academy/product-control/running-p1-observer';
const owner=resolve(import.meta.dir,'../..'),boundary=resolve(owner,'runtime/product-control'),digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
function fictional(){
 const legacy='/opt/data/academy-release-staging-20261015-71c5a0e737e0',root='/opt/academy-product-supervisor/71c5a0e737e0',boot='00000000-0000-0000-0000-000000000000',namespace='pid:[12]',hash='a'.repeat(64),generation='b'.repeat(24);
 const common={startTicks:'1',namespace,bootId:boot};
 const rootManager={...common,pid:201,executable:'/usr/bin/python3.12',cwd:root,argv:['/usr/bin/python3.12','-I','-S','-B',root+'/root-product-bootstrap.py','--contract-sha',hash,'serve','postgres']};
 const manager={...common,pid:101,executable:'/usr/bin/python3.13',cwd:legacy,argv:['/usr/bin/python3.13','-I','-S','-B',legacy+'/native-product-os.py','serve','postgres']};
 const postgres={...common,pid:102,executable:'/usr/lib/postgresql/99/bin/postgres',cwd:'/opt/data/profiles/dc-gang-a-dev/academy/fictional',argv:['/usr/lib/postgresql/99/bin/postgres','-D','/opt/data/profiles/dc-gang-a-dev/academy/fictional','-c','config_file='+legacy+'/primary-runtime.conf']};
 const admission={sha256:hash,operations:['migrate','serve:app'],readOnly:true,retired:false};
 return {schema:'academy.running-pg-p1-observation.v1',hostContractSha256:hash,container:{id:hash,imageId:'sha256:'+hash,initPid:1,initStartTicks:'1',pidNamespace:namespace,bootId:boot},rootManager,rootActivation:admission,rootMigrationPermission:{...admission,operations:['migrate']},native:{schema:'academy.running-pg-native-observation.v1',taskId:'71c5a0e737e0',running:true,authoritySha256:hash,deploymentContractSha256:hash,nativeGatedReceiptSha256:hash,nativeRunningReceiptSha256:'c'.repeat(64),nativeReceiptPath:legacy+'/state/process-postgres-'+generation+'.json',generation,manager,postgres,postgresEndpoint:{path:'/opt/data/profiles/dc-gang-a-dev/academy/socket/.s.PGSQL.9999',filesystem:{device:'7',inode:'888',uid:10000,gid:10000,mode:0o700,ctimeNs:'1780000000000000001'},kernelInode:'777',ownerPid:102,ownerStartTicks:'1',ownerBootId:boot,ownerNamespace:namespace,listenerFds:['6']},nativeActivation:admission,migrationPermission:{...admission,operations:['migrate']},beforeAfterStable:true,PGActions:false},beforeAfterStable:true,readOnly:true,retirementPerformed:false,PGActions:false,P1Accepted:false};
}
test('strict fictional running metadata accepts unretired permissions without accepting P1',()=>expect(validateP1Projection(fictional())).toEqual(fictional()));
for(const [name,change] of [
 ['extra full authority',(v:any)=>v.native.authority={secret:'forbidden'}],
 ['nonboolean readonly',(v:any)=>v.readOnly=1],
 ['array to string coercion',(v:any)=>v.native.nativeActivation.operations='migrate'],
 ['unknown operation',(v:any)=>v.native.nativeActivation.operations=['credential:read']],
 ['unsafe timestamp number',(v:any)=>v.native.postgresEndpoint.filesystem.ctimeNs=1780000000000000001],
 ['foreign socket owner',(v:any)=>v.native.postgresEndpoint.ownerPid=999],
 ['changed generation path',(v:any)=>v.native.generation='c'.repeat(24)],
 ['non-PG argv',(v:any)=>v.native.postgres.argv.push('credential')],
 ['acceptance assertion',(v:any)=>v.P1Accepted=true],
] as const)test(name+' refused',()=>{const value=fictional();change(value);expect(()=>validateP1Projection(value)).toThrow();});
test('canonical projection contains only selected functions and observation-only endpoint capture',()=>{const source=readFileSync(resolve(boundary,'native-product-os.py'),'utf8'),projection=canonicalProjection(source);expect(projection).toContain('def capture_original_pg_endpoint(c,child):');expect(projection).toContain("need(value==expected,'original_pg_endpoint_pin_changed')");expect(projection).not.toContain('def main(');expect(projection).not.toContain('def checked_launch(');expect(()=>canonicalProjection('unrecognized source')).toThrow();});
test('late source canary refuses before any transport or mutable native module import',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'running-p1-source-'));let calls=0;const original=Bun.spawn;
 try{
  const product=join(directory,'src/academy/product-control'),native=join(directory,'runtime/product-control');mkdirSync(product,{recursive:true});mkdirSync(join(native,'running-p1'),{recursive:true});
  const orchestrator=readFileSync(resolve(owner,'src/academy/product-control/running-p1-observer.ts'),'utf8');writeFileSync(join(product,'running-p1-observer.ts'),orchestrator);
  const snapshots:Record<string,string>={canonical:readFileSync(join(boundary,'native-product-os.py'),'utf8'),io:readFileSync(join(boundary,'running-p1/readonly_io.py'),'utf8'),root:readFileSync(join(boundary,'running-p1/root_observer.py'),'utf8'),native:readFileSync(join(boundary,'running-p1/native_observer.py'),'utf8'),orchestrator,bootstrap:readFileSync(resolve(owner,'src/academy/product-control/running-p1-bootstrap.ts'),'utf8')};
  writeFileSync(join(product,'running-p1-bootstrap.ts'),snapshots.bootstrap!);writeFileSync(join(native,'native-product-os.py'),snapshots.canonical!);for(const [id,file] of [['io','readonly_io.py'],['root','root_observer.py'],['native','native_observer.py']])writeFileSync(join(native,'running-p1',file!),snapshots[id!]!);
  const graph=JSON.stringify({schema:'academy.running-p1-source-graph.v1',files:Object.fromEntries(Object.entries(snapshots).map(([k,v])=>[k,digest(v)]))});writeFileSync(join(native,'running-p1/source-graph.json'),graph);
  const mod=await import(join(product,'running-p1-observer.ts'));writeFileSync(join(native,'running-p1/native_observer.py'),snapshots.native+'\nraise RuntimeError("LOCAL_CANARY_MUST_NOT_EXECUTE")\n');
  Object.defineProperty(Bun,'spawn',{value:()=>{calls++;throw Error('transport must be blocked');}});
  const profile=Buffer.from(JSON.stringify({schema:'academy.running-p1-fixed-profile.v1',hostContractSha256:'cc15984302e48265bc852d8274d8cb0002c632249a45e6ce9c06ba05a396ed90',deploymentContractSha256:'04c1fef0049b64f9fdcc62a0c9c6b4aac06fef63e92d2d1052e6fc68c8a8016c',sshConfigSha256:'f'.repeat(64)}));
  await expect(mod.runReviewedOnce(profile,{selfSha256:digest(orchestrator),graphSha256:digest(graph),profileSha256:digest(profile)})).rejects.toThrow('source_image_drift');expect(calls).toBe(0);
 }finally{Object.defineProperty(Bun,'spawn',{value:original});rmSync(directory,{recursive:true,force:true});}
});
async function frozenBootstrapFixture(run:(module:any,paths:{observer:string;helper:string},pins:{bootstrapSha256:string;selfSha256:string;graphSha256:string})=>Promise<void>){
 const directory=mkdtempSync(join(tmpdir(),'p1-first-import-'));
 try{
  const product=join(directory,'src/academy/product-control'),native=join(directory,'runtime/product-control');mkdirSync(product,{recursive:true});mkdirSync(join(native,'running-p1'),{recursive:true});
  const snapshots={canonical:readFileSync(join(boundary,'native-product-os.py'),'utf8'),io:readFileSync(join(boundary,'running-p1/readonly_io.py'),'utf8'),root:readFileSync(join(boundary,'running-p1/root_observer.py'),'utf8'),native:readFileSync(join(boundary,'running-p1/native_observer.py'),'utf8'),orchestrator:readFileSync(resolve(owner,'src/academy/product-control/running-p1-observer.ts'),'utf8'),bootstrap:readFileSync(resolve(owner,'src/academy/product-control/running-p1-bootstrap.ts'),'utf8')};
  const entry=join(product,'running-p1-bootstrap.ts'),observer=join(product,'running-p1-observer.ts');writeFileSync(entry,snapshots.bootstrap);writeFileSync(observer,snapshots.orchestrator);writeFileSync(join(native,'native-product-os.py'),snapshots.canonical);
  for(const [id,file] of [['io','readonly_io.py'],['root','root_observer.py'],['native','native_observer.py']] as const)writeFileSync(join(native,'running-p1',file),snapshots[id]);
  const graph=JSON.stringify({schema:'academy.running-p1-source-graph.v1',files:Object.fromEntries(Object.entries(snapshots).map(([k,v])=>[k,digest(v)]))});writeFileSync(join(native,'running-p1/source-graph.json'),graph);
  // Trusted first reader verifies bootstrap bytes, then consumes its immutable buffer, never a path import.
  expect(digest(readFileSync(entry))).toBe(digest(snapshots.bootstrap));
  const built=await Bun.build({entrypoints:[entry],target:'bun',format:'esm',define:{'import.meta.dir':JSON.stringify(product),'import.meta.path':JSON.stringify(entry)},plugins:[{name:'fictional-trusted-first-reader',setup(build){build.onLoad({filter:/.*/},()=>({contents:snapshots.bootstrap,loader:'ts',resolveDir:product}));}}]});expect(built.success).toBe(true);
  const bootstrap=await import('data:text/javascript;base64,'+Buffer.from(await built.outputs[0]!.text()).toString('base64'));
  await run(bootstrap,{observer,helper:join(native,'running-p1/native_observer.py')},{bootstrapSha256:digest(snapshots.bootstrap),selfSha256:digest(snapshots.orchestrator),graphSha256:digest(graph)});
 }finally{rmSync(directory,{recursive:true,force:true});}
}
test('verified immutable bootstrap consumes verified virtual observer without target reads',()=>frozenBootstrapFixture(async(module,paths,pins)=>{const loaded=await module.consumeReviewedObserver(pins);expect(typeof loaded.module.runReviewedOnce).toBe('function');expect(loaded.compiledSourceSha256).toHaveLength(64);}));
for(const kind of ['observer','helper'] as const)test('first-consumption '+kind+' canary never executes',()=>frozenBootstrapFixture(async(module,paths,pins)=>{writeFileSync(paths[kind],readFileSync(paths[kind],'utf8')+(kind==='observer'?'\n(globalThis as any).__P1_FIRST_IMPORT_CANARY=true;\n':'\nraise RuntimeError("P1_HELPER_CANARY")\n'));await expect(module.consumeReviewedObserver(pins)).rejects.toThrow('bootstrap_source_image_drift');expect((globalThis as any).__P1_FIRST_IMPORT_CANARY).toBeUndefined();}));
test('late change during virtual build refuses before first observer import',()=>frozenBootstrapFixture(async(module,paths,pins)=>{const original=Bun.build;try{Object.defineProperty(Bun,'build',{value:async(...args:any[])=>{const result=await (original as any)(...args);writeFileSync(paths.observer,readFileSync(paths.observer,'utf8')+'\n(globalThis as any).__P1_FIRST_IMPORT_CANARY=true;\n');return result;}});await expect(module.consumeReviewedObserver(pins)).rejects.toThrow('bootstrap_source_image_drift');expect((globalThis as any).__P1_FIRST_IMPORT_CANARY).toBeUndefined();}finally{Object.defineProperty(Bun,'build',{value:original});}}));
