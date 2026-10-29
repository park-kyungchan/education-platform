/** R07 PR admission. Scope rows and exit fields are generated from checked plan v11. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdtempSync} from 'node:fs';
import {posix,resolve} from 'node:path';

export const CAP=1500;
export const SCOPE_PATH='architecture/r07-split-scopes.v11.json';
export const BOOTSTRAP_HASH='2f4e9201131b6eafadd75bb61af9d65a73e21ca56afe7e86fd5df2299112f781';
export const PLAN_HASH='147c02d53bbb6e013bc189d5da5afc0fa7f8ebea8853032c5c6a348e8d472c73';
export const PLAN_SCOPES_HASH='8d8723209a8487beef3c5f768a8706b9b52f8a4f62d7513190e4aa6fb283dd71';
export const EVAL_HASH='115c4dfb3f1b2747055762ad797bb2843bfb92744d2d61e5969ba2d5a5c960cc';
export const BASELINE_AMENDMENT_HASH='df2d456adfdbef0035e38d7ea9bf236ae1921c91ee10f250a9da48ff24a50f31';
// Generated from split-scopes.v11.json/exitEvidenceSchema.required; not a sampled evidence list.
export const EXIT_FIELDS=["status","decidedBy","planPath","planSha256","scopesPath","scopesSha256","evalPath","evalSha256","row","repository","branch","baseSha","headSha","changedPathsDigest","addedDeletedLineCount","dependencyExits","earlierRowExits","strictTypeGate","guardMapResults","predecessorAndPositiveControls","mergedTreeUnitSuite","freshFullReview","hostedCi","holdsReadAt","guiderNotesReadAt","fullFailureCount","sameStageFailureCounts","activeHoursSinceExit","budget","mergeSha","mergeTreeSha","verifiedAt"] as const;
export const REQUIRED_CHECKS=['Canonical source checks','Exact head native independent review','R07 slice scope and size','Source and native review gate'] as const;
export interface Row{id:string;appPaths:string[];repositoryPaths:string[];dependsOn:string[];native:boolean;pureMoveAllowance?:Record<string,unknown>}
export interface Scopes{schema:string;mergeRule:string;appRoot:string;commonAppPaths:string[];commonRepositoryPaths:string[];testPathPerRow:string;rows:Row[]}
export interface Change{path:string;added:number;deleted:number}
export const MOVE_FAULTS=['missing','extra','content','mode','duplicate','source_retained','destination_preexisting'] as const;
export interface PureMoveProof{row:'1a';baseSha:string;headSha:string;baseTreeSha:string;headTreeSha:string;manifestPath:string;manifestSha256:string;changesSha256:string;exactSet:'PASS';pureMoveLines:number;nonMoveLines:number;pureMoveAddedDeletedLines:number;rawAddedDeletedLines:number;nonMoveAddedDeletedLines:number;pairs:readonly {from:string;to:string;blobSha:string;mode:string}[]}
const issuedMoves=new WeakSet<object>();
export interface Facts{prHead:string;mergeSha:string;mergeTree:string;headTree:string;baseSha:string;baseTree:string;changedCount:number;changedPathsDigest:string;exitDigest:string;ancestor:boolean;ciPassed:boolean;pureMoveProof?:PureMoveProof}
const source=import.meta.path;
export function fail(code:string,path=source):never{throw Error(code+'@'+path+':1');}
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const object=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))return fail('r07_slice_scope_invalid');
 return v as Record<string,unknown>;
};
const text=(v:unknown):string=>typeof v==='string'?v:fail('r07_slice_scope_invalid');
const strings=(v:unknown):string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string')?v:fail('r07_slice_scope_invalid');
export const sha=(v:unknown):string=>typeof v==='string'&&v.length===40&&/^[a-f0-9]{40}$/.test(v)?v:fail('r07_slice_sha_invalid');
export function safePath(p:string):string{
 if(!p||/[\\\x00-\x1f\x7f]/.test(p)||p.startsWith('/')||posix.normalize(p)!==p||p.split('/').some(x=>x==='.'||x==='..'))return fail('r07_slice_scope_invalid');
 return p;
}
const unique=(xs:string[])=>new Set(xs).size===xs.length;
const hash64=(v:unknown):v is string=>typeof v==='string'&&v.length===64&&/^[a-f0-9]{64}$/.test(v);
export const UNIT_STATUSES=['PASS','FAIL','SKIPPED'] as const;
export type UnitStatus=typeof UNIT_STATUSES[number];
// One contract for the comparator and generated CI status-pair controls.
export const UNIT_TRANSITIONS={PASS:['PASS'],FAIL:['FAIL','PASS'],SKIPPED:['SKIPPED','PASS']} as const satisfies Record<UnitStatus,readonly UnitStatus[]>;
export interface UnitIdentity{file:string;classname:string;name:string;identitySha256:string;status:UnitStatus}
const unitStatus=(v:unknown):v is UnitStatus=>UNIT_STATUSES.some(s=>s===v);
const producerBrand=Symbol('verified_duplicate_producer'),issuedProofs=new WeakSet<object>();
const gitBlobs=new Map<string,string|null>();
export interface ProducerProof{key:string;baseSha:string;headSha:string;blobSha:string;rows:number;closureSha256:string;closureFiles:number;[producerBrand]:true}
export function parseUnitIdentities(raw:unknown):UnitIdentity[]{
 const o=object(raw);
 if(o.schema!=='r07-unit-identities.v1'||o.scope!=='apps/academy/dc-gang-a/tests/academy'||!Array.isArray(o.cases)||!o.cases.length)return fail('r07_slice_baseline_invalid');
 const cases=o.cases.map((v):UnitIdentity=>{
  const c=object(v),file=safePath(text(c.file)),classname=text(c.classname),name=text(c.name),status=c.status;
  if(!name||Object.hasOwn(c,'occurrence')||!unitStatus(status))return fail('r07_slice_baseline_invalid');
  const identitySha256=hash(JSON.stringify({file,classname,name}));
  if(c.identitySha256!==identitySha256)return fail('r07_slice_baseline_invalid');
  return {file,classname,name,identitySha256,status};
 });
 return cases;
}
const groupCases=(cases:UnitIdentity[])=>{const m=new Map<string,UnitIdentity[]>();for(const c of cases)m.set(c.identitySha256,[...(m.get(c.identitySha256)??[]),c]);return m;};
export function parseJUnitIdentities(xml:string){
 if(!/^\s*(?:<\?xml[^>]*>\s*)?<testsuites\b/.test(xml)||!xml.trimEnd().endsWith('</testsuites>'))return fail('r07_unit_run_incomplete');
 const decode=(v:string)=>{
  if(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(v))return fail('r07_unit_status_unknown');
  return v.replace(/&([^;]+);/g,(_all:string,s:string)=>{const basic:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.hasOwn(basic,s))return basic[s]??'';const n=s.startsWith('#x')?parseInt(s.slice(2),16):Number(s.slice(1));if(!Number.isInteger(n)||n<1||n>0x10ffff||(n>=0xd800&&n<=0xdfff))return fail('r07_unit_status_unknown');return String.fromCodePoint(n);});
 };
 const cases=[...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map(match=>{
  const attributes=match[1]??'',body=match[2]??'';
  const attr=(name:string)=>{const values=[...attributes.matchAll(new RegExp('(?:^|\\s)'+name+'="([^"]*)"','g'))];if(values.length!==1)return fail('r07_unit_status_unknown');return decode(values[0]?.[1]??'');};
  if(/\sstatus=/.test(attributes)||/<skipped\b[^>]*(?:message|type)="[^"]*(?:TODO|todo)/.test(body))return fail('r07_unit_status_unknown');
  const failed=/<(?:failure|error)\b/.test(body),skipped=/<skipped\b/.test(body);
  if((failed&&skipped)||(body.trim()&&!failed&&!skipped))return fail('r07_unit_status_unknown');
  const identity={file:safePath(attr('file')),classname:attr('classname'),name:attr('name')};
  const status:UnitStatus=failed?'FAIL':skipped?'SKIPPED':'PASS';
  return {...identity,identitySha256:hash(JSON.stringify(identity)),status};
 });
 if(!cases.length)return fail('r07_unit_run_incomplete');
 return {schema:'r07-unit-identities.v1',scope:'apps/academy/dc-gang-a/tests/academy',cases};
}
export function verifyUnitCompletion(log:string,cases:UnitIdentity[],exitCode:number,signal:unknown):void{
 const footer=log.replace(/\x1b\[[0-9;]*m/g,'').split('\n').slice(-10).join('\n');
 const count=(status:string)=>Number(new RegExp('(?:^|\\n)\\s*(\\d+) '+status+'\\s*(?:\\n|$)').exec(footer)?.[1]??'0');
 const failed=cases.filter(c=>c.status==='FAIL').length;
 if(Number(/Ran (\d+) tests? across/.exec(footer)?.[1]??'-1')!==cases.length||count('pass')!==cases.filter(c=>c.status==='PASS').length||count('fail')!==failed||count('skip')!==cases.filter(c=>c.status==='SKIPPED').length||count('todo')||count('errors?')||signal!==null||exitCode!==(failed?1:0))return fail('r07_unit_run_incomplete');
}
export function measureUnit(root:string,prefix:string){
 root=resolve(root);prefix=resolve(prefix);
 const artifacts=Object.fromEntries(['log','junit.xml','execution.json','identities.json','result.json'].map(s=>[s,prefix+'.'+s]));
 if(Object.values(artifacts).some(existsSync))return fail('r07_unit_target_exists');
 const sourceStatusBefore=git(root,['status','--porcelain=v1','--untracked-files=all','-z'])??'';
 if(sourceStatusBefore)return fail('r07_unit_source_dirty');
 const headSha=sha((git(root,['rev-parse','HEAD'])??'').trim()),treeSha=sha((git(root,['rev-parse','HEAD^{tree}'])??'').trim()),cwd=resolve(root,'apps/academy/dc-gang-a');
 const logPath=prefix+'.log',junitPath=prefix+'.junit.xml',executionPath=prefix+'.execution.json',identityPath=prefix+'.identities.json',resultPath=prefix+'.result.json';
 const command=[process.execPath,'--no-env-file','test','tests/academy','--reporter=junit','--reporter-outfile='+junitPath],startedAt=new Date().toISOString();
 const r=Bun.spawnSync(command,{cwd,stdout:'pipe',stderr:'pipe'}),rawLog=Buffer.concat([r.stdout,r.stderr]),sourceStatusAfter=git(root,['status','--porcelain=v1','--untracked-files=all','-z'])?'DIRTY':'';
 writeFileSync(logPath,rawLog,{flag:'wx'});
 const execution={schema:'r07-unit-execution.v1',headSha,treeSha,command,cwd,bunVersion:Bun.version,exitCode:r.exitCode,signalCode:r.signalCode??null,sourceStatusBefore:'',sourceStatusAfter,startedAt,finishedAt:new Date().toISOString(),logSha256:hash(rawLog),junitSha256:existsSync(junitPath)?hash(readFileSync(junitPath)):null,observerSha256:hash(readFileSync(import.meta.path))};
 writeFileSync(executionPath,JSON.stringify(execution,null,2)+'\n',{flag:'wx'});
 if(sourceStatusAfter||!existsSync(junitPath))return fail('r07_unit_run_incomplete');
 const xml=readFileSync(junitPath,'utf8'),identities=parseJUnitIdentities(xml),cases=parseUnitIdentities(identities);verifyUnitCompletion(new TextDecoder('utf-8',{fatal:true}).decode(rawLog),cases,r.exitCode,execution.signalCode);
 writeFileSync(identityPath,JSON.stringify(identities,null,2)+'\n',{flag:'wx'});
 const pin=(path:string)=>({path,sha256:hash(readFileSync(path))}),counts={pass:cases.filter(c=>c.status==='PASS').length,fail:cases.filter(c=>c.status==='FAIL').length,skipped:cases.filter(c=>c.status==='SKIPPED').length};
 const result={schema:'r07-unit-measurement.v1',completed:true,suite:'apps/academy/dc-gang-a/tests/academy',status:r.exitCode===0?'PASS':'FAIL',headSha,treeSha,command,cwd,exitCode:r.exitCode,startedAt,finishedAt:execution.finishedAt,counts,artifacts:{execution:pin(executionPath),log:pin(logPath),junit:pin(junitPath),identities:pin(identityPath)}};
 writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return {measurementPath:resultPath,counts,unitExitCode:r.exitCode};
}
export function compareUnitIdentities(base:unknown,candidate:unknown,proofs:readonly ProducerProof[]=[],binding?:{baseSha:string;headSha:string}){
 const before=parseUnitIdentities(base),after=parseUnitIdentities(candidate),prior=groupCases(before),current=groupCases(after);
 for(const [key,bs]of prior){
  const cs=current.get(key);if(!cs)return fail('r07_slice_baseline_omitted');
  if(bs.length>1||cs.length>1){const proof=proofs.find(p=>p.key===key);if(!proof||!issuedProofs.has(proof)||!binding||proof.baseSha!==binding.baseSha||proof.headSha!==binding.headSha||proof.rows!==bs.length||bs.length!==cs.length||[...bs,...cs].some(c=>c.status!=='PASS'))return fail('r07_slice_baseline_ambiguous');}
  else {const b=bs[0],c=cs[0];if(!b||!c||!UNIT_TRANSITIONS[b.status].some(s=>s===c.status))return fail('r07_slice_baseline_regression');}
 }
 for(const [key,cs]of current)if(!prior.has(key)&&(cs.length>1||cs.some(c=>c.status!=='PASS')))return fail('r07_slice_baseline_new_failure');
 return {baseCases:before.length,candidateCases:after.length,retainedBaseCases:before.length,newCases:after.length-before.length,newFailures:0,regressions:0,omittedCases:0,newUnpassedCases:0};
}
export async function verifyDuplicateProducer(root:string,baseSha:string,headSha:string,c:Pick<UnitIdentity,'file'|'classname'|'name'>,count:number):Promise<ProducerProof>{
 sha(baseSha);sha(headSha);safePath(c.file);
 if(!c.file.startsWith('tests/academy/')||!c.file.endsWith('.test.ts'))return fail('r07_slice_baseline_ambiguous');
 const app='apps/academy/dc-gang-a/',entry=app+c.file,closure=new Map<string,string>();
 const metadata=object(JSON.parse(git(root,['show',baseSha+':provenance/private-context-integration.json'])??''));
 const custody=object(metadata.additionalCustody);
 if(!Array.isArray(metadata.packages)||!Array.isArray(custody.groups))return fail('r07_slice_scope_invalid');
 const protectedRoots=[...metadata.packages.map(p=>text(object(p).proposedDestinationRoot)),...custody.groups.map(p=>text(object(p).destinationRoot))];
 const admitted=(path:string)=>{safePath(path);if(path.startsWith('.private/')||protectedRoots.some(p=>path===p||path.startsWith(p+'/')))return fail('r07_slice_scope_invalid');return path;};
 const blob=(rev:string,path:string)=>{admitted(path);const key=JSON.stringify([resolve(root),rev,path]);if(gitBlobs.has(key))return gitBlobs.get(key)??null;const entry=git(root,['ls-tree','-z',rev,'--',path])??'',match=/^100(?:644|755) blob ([a-f0-9]{40})\t/.exec(entry),value=match&&entry.slice(match[0].length)===path+'\0'?sha(match[1]):null;gitBlobs.set(key,value);return value;};
 const pin=(path:string)=>{const a=blob(baseSha,path),b=blob(headSha,path);if(!a||a!==b)return fail('r07_duplicate_import_changed',path);closure.set(path,a);return a;};
 const json=(rev:string,path:string)=>object(Bun.JSONC.parse(git(root,['show',rev+':'+admitted(path)])??''));
 const dependency=(from:string,specifier:string)=>{
  const packageName=specifier.startsWith('@')?specifier.split('/').slice(0,2).join('/'):specifier.split('/')[0]??'';
  let dir=posix.dirname(from);
  while(!blob(baseSha,(dir==='.'?'':dir+'/')+'package.json')){if(dir==='.')return fail('r07_duplicate_import_unknown');dir=posix.dirname(dir);}
  const prefix=dir==='.'?'':dir+'/',path=prefix+'package.json',a=json(baseSha,path),b=json(headSha,path);
  const version=(m:Record<string,unknown>)=>object(m.dependencies??{})[packageName]??object(m.devDependencies??{})[packageName];
  const before=version(a);if(typeof before!=='string'||before!==version(b)||['type','imports','exports','main','module','browser'].some(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])))return fail('r07_duplicate_import_changed',path);
  if(before.startsWith('file:')){pin(posix.normalize(prefix+before.slice(5)));return;}
  const lock=prefix+'bun.lock',oldPackages=object(json(baseSha,lock).packages),newPackages=object(json(headSha,lock).packages);
  if(!Object.hasOwn(oldPackages,packageName)||Object.entries(oldPackages).some(([k,v])=>JSON.stringify(v)!==JSON.stringify(newPackages[k])))return fail('r07_duplicate_import_changed',lock);
  closure.set(path,hash(JSON.stringify({packageName,version:before})));closure.set(lock,hash(JSON.stringify(oldPackages)));
 };
 const queue=[entry];let declaration:{rows:number;rowKinds:readonly string[]}|undefined;
 const {inspectEachBatch}=await import('./type-escape-ratchet');
 while(queue.length){
  const path=queue.pop();if(!path||closure.has(path))continue;
  pin(path);if(path.endsWith('.json'))continue;
  if(!/\.(?:ts|tsx|js|mjs)$/.test(path))return fail('r07_duplicate_import_unknown',path);
  const text=git(root,['show',baseSha+':'+path])??'',result=(await inspectEachBatch([{text,name:path===entry?c.name:undefined,tsx:path.endsWith('.tsx')}]))[0];
  if(!result||result.error)return fail('r07_duplicate_producer_invalid',path);
  if(path===entry)declaration=result.value;
  const imports=result.value.imports;
  for(const specifier of imports){
   if(specifier==='bun:test'){if(path!==entry)return fail('r07_duplicate_import_unknown',path);continue;}
   if(['node:module','node:vm'].includes(specifier))return fail('r07_duplicate_import_unknown',path);
   if(specifier.startsWith('node:')||specifier==='bun')continue;
   if(!specifier.startsWith('.')){dependency(path,specifier);continue;}
   const stem=posix.normalize(posix.join(posix.dirname(path),specifier));admitted(stem);
   const candidates=[stem,...['.ts','.tsx','.js','.mjs','.json','/index.ts','/index.tsx','/index.js'].map(s=>stem+s),...(stem.endsWith('.js')?[stem.slice(0,-3)+'.ts']:[])];
   const selected=candidates.find(p=>blob(baseSha,p)!==null);if(!selected)return fail('r07_duplicate_import_unknown',path);queue.push(selected);
  }
 }
 if(!declaration||declaration.rows!==count)return fail('r07_slice_baseline_ambiguous');
 const blobSha=closure.get(entry);if(!blobSha)return fail('r07_slice_baseline_ambiguous');
 const proof:ProducerProof={key:hash(JSON.stringify({file:c.file,classname:c.classname,name:c.name})),baseSha,headSha,blobSha,rows:count,closureSha256:hash(JSON.stringify([...closure].sort(([a],[b])=>a.localeCompare(b)))),closureFiles:closure.size,[producerBrand]:true};
 Object.freeze(proof);issuedProofs.add(proof);return proof;
}
function measurement(raw:unknown,head:string,tree:string):Record<string,unknown>{
 const m=object(raw),counts=object(m.counts),artifacts=object(m.artifacts);
 const pass=counts.pass,failed=counts.fail,skipped=counts.skipped;
 if(m.schema!=='r07-unit-measurement.v1'||m.completed!==true||m.suite!=='apps/academy/dc-gang-a/tests/academy'||m.headSha!==head||m.treeSha!==tree||![pass,failed,skipped].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)||typeof m.cwd!=='string'||!m.cwd.endsWith('/apps/academy/dc-gang-a'))return fail('r07_slice_baseline_invalid');
 const argv=m.command,junit=object(artifacts.junit);
 if(!Array.isArray(argv)||argv.length!==6||argv.some(a=>typeof a!=='string')||!argv[0]||JSON.stringify(argv.slice(1,5))!==JSON.stringify(['--no-env-file','test','tests/academy','--reporter=junit'])||argv[5]!=='--reporter-outfile='+text(junit.path)||m.exitCode!==(Number(failed)>0?1:0)||m.status!==(Number(failed)>0?'FAIL':'PASS'))return fail('r07_slice_baseline_invalid');
 for(const key of ['execution','log','junit','identities']){const pin=object(artifacts[key]);if(typeof pin.path!=='string'||!pin.path||!hash64(pin.sha256))return fail('r07_slice_baseline_invalid');}
 return m;
}
export async function compareMeasurements(root:string,basePath:string,candidatePath:string){
 const read=(path:string)=>{
  if(!path.endsWith('.result.json'))return fail('r07_slice_baseline_invalid');
  const m=object(JSON.parse(readFileSync(path,'utf8'))),head=sha(m.headSha),tree=sha(m.treeSha);measurement(m,head,tree);
  const artifacts=object(m.artifacts),prefix=path.slice(0,-'.result.json'.length);
  const bytes=(key:string,suffix:string)=>{const pin=object(artifacts[key]);if(pin.path!==prefix+suffix)return fail('r07_slice_evidence_stale');const value=readFileSync(text(pin.path));if(hash(value)!==pin.sha256)return fail('r07_slice_evidence_stale');return new TextDecoder('utf-8',{fatal:true}).decode(value);};
  const log=bytes('log','.log'),xml=bytes('junit','.junit.xml'),execution=object(JSON.parse(bytes('execution','.execution.json'))),identityText=bytes('identities','.identities.json'),identities=JSON.parse(identityText),cases=parseUnitIdentities(identities),observed=parseUnitIdentities(parseJUnitIdentities(xml));
  if(execution.schema!=='r07-unit-execution.v1'||execution.bunVersion!=='1.4.3'||execution.headSha!==head||execution.treeSha!==tree||execution.cwd!==m.cwd||JSON.stringify(execution.command)!==JSON.stringify(m.command)||execution.exitCode!==m.exitCode||execution.logSha256!==object(artifacts.log).sha256||execution.junitSha256!==object(artifacts.junit).sha256)return fail('r07_slice_evidence_stale');
  const normalized=(cs:UnitIdentity[])=>JSON.stringify(cs.map(c=>JSON.stringify(c)).sort());
  const counts=object(m.counts);
  if(normalized(cases)!==normalized(observed)||['PASS','FAIL','SKIPPED'].some((status,i)=>counts[['pass','fail','skipped'][i]??'']!==cases.filter(c=>c.status===status).length)||execution.sourceStatusBefore!==''||execution.sourceStatusAfter!=='')return fail('r07_unit_run_incomplete');
  verifyUnitCompletion(log,cases,Number(m.exitCode),execution.signalCode);
  if((git(root,['rev-parse',head+'^{tree}'])??'').trim()!==tree)return fail('r07_slice_evidence_stale');
  return {measurement:m,identities,cases,head,tree};
 };
 const base=read(resolve(basePath)),candidate=read(resolve(candidatePath));
 if((git(root,['rev-parse','origin/main'])??'').trim()!==base.head||(git(root,['rev-parse','HEAD'])??'').trim()!==candidate.head||git(root,['merge-base','--is-ancestor',base.head,candidate.head],true)===null)return fail('r07_slice_evidence_stale');
 const proofs:ProducerProof[]=[],groups=groupCases(base.cases),after=groupCases(candidate.cases);
 for(const [key,bs]of groups)if(bs.length>1||(after.get(key)?.length??0)>1){const first=bs[0];if(!first)return fail('r07_slice_baseline_invalid');proofs.push(await verifyDuplicateProducer(root,base.head,candidate.head,first,bs.length));}
 const comparison=compareUnitIdentities(base.identities,candidate.identities,proofs,{baseSha:base.head,headSha:candidate.head});
 return {baseMeasurement:base.measurement,candidateMeasurement:candidate.measurement,comparison,producerProofs:proofs,amendmentSha256:BASELINE_AMENDMENT_HASH};
}
function keys(o:Record<string,unknown>,allowed:readonly string[]):void{
 if(Object.keys(o).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(o,k)))fail('r07_slice_scope_invalid');
}
export function parseScopes(input:string):Scopes{
 const o=object(JSON.parse(input));
 keys(o,['schema','mergeRule','appRoot','commonAppPaths','commonRepositoryPaths','testPathPerRow','rows']);
 if(o.schema!=='r07-ci-scope-projection.v1'||o.mergeRule!=='all-earlier-rows-merged'||o.appRoot!=='apps/academy/dc-gang-a/'||o.testPathPerRow!=='tests/academy/r07-<id>.test.ts'||!Array.isArray(o.rows))return fail('r07_slice_scope_invalid');
 const rows=o.rows.map((v):Row=>{
  const r=object(v);keys(r,['id','appPaths','repositoryPaths','dependsOn','native',...(r.id==='1a'?['pureMoveAllowance']:[])]);
  const id=text(r.id),appPaths=strings(r.appPaths).map(safePath),repositoryPaths=strings(r.repositoryPaths).map(safePath),dependsOn=strings(r.dependsOn);
  if(/^[1-9][0-9]*[a-z][0-9]*$/.exec(id)?.[0]!==id||typeof r.native!=='boolean'||!unique(appPaths)||!unique(repositoryPaths)||!unique(dependsOn))return fail('r07_slice_scope_invalid');
  return {id,appPaths,repositoryPaths,dependsOn,native:r.native,...(id==='1a'?{pureMoveAllowance:object(r.pureMoveAllowance)}:{})};
 });
 if(!rows.length||!unique(rows.map(r=>r.id)))return fail('r07_slice_scope_invalid');
 for(const [i,r]of rows.entries())if(r.dependsOn.some(d=>!rows.slice(0,i).some(p=>p.id===d)))fail('r07_slice_scope_invalid');
 const commonAppPaths=strings(o.commonAppPaths).map(safePath),commonRepositoryPaths=strings(o.commonRepositoryPaths).map(safePath);
 if(!unique(commonAppPaths)||!unique(commonRepositoryPaths))return fail('r07_slice_scope_invalid');
 return {schema:text(o.schema),mergeRule:text(o.mergeRule),appRoot:text(o.appRoot),commonAppPaths,commonRepositoryPaths,testPathPerRow:text(o.testPathPerRow),rows};
}
export function select(scopes:Scopes,ref:string):Row{
 const match=/^feat\/r07-([1-9][0-9]*[a-z][0-9]*)$/.exec(ref),row=match?.[0]===ref?scopes.rows.find(r=>r.id===match?.[1]):undefined;
 return row??fail('r07_slice_unknown');
}
export function selectScopeText(baseText:string|null,headText:string,ref:string):string{
 if(baseText!==null)return baseText;
 if(ref!=='feat/r07-1a'||hash(headText)!==BOOTSTRAP_HASH)return fail('r07_slice_scope_untrusted');
 return headText;
}
export function parseNumstat(input:string):Change[]{
 if(input&&!input.endsWith('\0'))return fail('r07_slice_diff_unmeasurable');
 const entries=input.split('\0').filter(Boolean),seen=new Set<string>();
 return entries.map(line=>{
  const m=/^(\d+)\t(\d+)\t([\s\S]+)$/.exec(line);
  if(!m)return fail('r07_slice_diff_unmeasurable');
  const path=safePath(m[3]??''),added=Number(m[1]),deleted=Number(m[2]);
  if(seen.has(path)||!Number.isSafeInteger(added)||!Number.isSafeInteger(deleted))return fail('r07_slice_diff_unmeasurable');
  seen.add(path);return {path,added,deleted};
 });
}
/** Only this live Git read can issue the capability that subtracts a move from the counter. */
export function verifyPureMoves(root:string,base:string,head:string,rawAllowance:unknown):PureMoveProof{
 sha(base);sha(head);const a=object(rawAllowance);
 const changes=parseNumstat(git(root,['diff','--no-renames','--numstat','-z',base,head])??'');
 if(a.row!=='1a'||a.schema!=='r07-pure-move-allowance.v1'||a.sourceBaseSha!==base||a.nonMoveCap!==CAP||a.manifestPath!=='architecture/r07-u-archive.v1.json')return fail('r07_archive_allowance_invalid');
 const manifestText=git(root,['show',head+':'+a.manifestPath])??fail('r07_archive_manifest_missing');
 if(hash(manifestText)!==a.manifestSha256)return fail('r07_archive_manifest_stale');
 const manifest=object(JSON.parse(manifestText)),authority=object(manifest.authority);
 if(manifest.baseSha!==base||authority.sha256!=='45e1c80fd58c80fdab41e2cd6defbfa785f78e7a80c2fd40218d82e7a60dd572'||!Array.isArray(manifest.entries)||!manifest.entries.length)return fail('r07_archive_manifest_invalid');
 const tree=(rev:string)=>new Map((git(root,['ls-tree','-r','-z',rev])??'').split('\0').filter(Boolean).map(entry=>{const at=entry.indexOf('\t');return [entry.slice(at+1),entry.slice(0,at)];}));
 const before=tree(base),after=tree(head),expected=new Set<string>(),actual=new Map(changes.map(c=>[c.path,c]));
 if(actual.size!==changes.length)return fail('r07_archive_set_invalid');
 const pairs:{from:string;to:string;blobSha:string;mode:string}[]=[];let moved=0;
 for(const raw of manifest.entries){
  const e=object(raw),from=safePath(text(e.from)),to=safePath(text(e.to)),lines=e.lines;
  if(!from.startsWith('apps/academy/dc-gang-a/tests/')||from.startsWith('apps/academy/dc-gang-a/tests/academy/')||!to.startsWith('apps/academy/dc-gang-a/archive/r07-u-overlay/')||to.includes('tests')||expected.has(from)||expected.has(to)||typeof lines!=='number'||!Number.isSafeInteger(lines)||lines<1)return fail('r07_archive_set_invalid');
  const image=before.get(from);
  if(!image||!/^100(?:644|755) blob [a-f0-9]{40}$/.test(image)||image!==after.get(to)||image.split(' ')[2]!==sha(e.baseBlobSha)||after.has(from)||before.has(to))return fail('r07_archive_pair_invalid');
  const parts=image.split(' ');
  const old=actual.get(from),next=actual.get(to);
  if(!old||!next||old.added!==0||old.deleted!==lines||next.added!==lines||next.deleted!==0)return fail('r07_archive_count_invalid');
  expected.add(from);expected.add(to);moved+=2*lines;pairs.push(Object.freeze({from,to,blobSha:parts[2]??'',mode:parts[0]??''}));
 }
 const deleted=changes.filter(c=>before.has(c.path)&&!after.has(c.path)),added=changes.filter(c=>!before.has(c.path)&&after.has(c.path));
 const observed=new Set([...deleted.filter(d=>added.some(n=>before.get(d.path)===after.get(n.path))).map(c=>c.path),...added.filter(n=>deleted.some(d=>before.get(d.path)===after.get(n.path))).map(c=>c.path)]);
 if(observed.size!==expected.size||[...observed].some(path=>!expected.has(path)))return fail('r07_archive_set_invalid');
 const raw=changes.reduce((n,c)=>n+c.added+c.deleted,0),nonMove=raw-moved;
 if(!Number.isSafeInteger(raw)||nonMove<0||moved!==a.pureMoveAddedDeletedLines||a.totalAddedDeletedCap!==moved+CAP||object(manifest.counts).pureMoveAddedDeletedLines!==moved)return fail('r07_archive_count_invalid');
 const proof:PureMoveProof=Object.freeze({row:'1a',baseSha:base,headSha:head,baseTreeSha:sha((git(root,['rev-parse',base+'^{tree}'])??'').trim()),headTreeSha:sha((git(root,['rev-parse',head+'^{tree}'])??'').trim()),manifestPath:text(a.manifestPath),manifestSha256:hash(manifestText),changesSha256:hash(JSON.stringify(changes)),exactSet:'PASS',pureMoveLines:moved,nonMoveLines:nonMove,pureMoveAddedDeletedLines:moved,rawAddedDeletedLines:raw,nonMoveAddedDeletedLines:nonMove,pairs:Object.freeze(pairs)});issuedMoves.add(proof);return proof;
}
export function checkChanges(scopes:Scopes,row:Row,changes:Change[],pure?:PureMoveProof):number{
 if(pure&&(!issuedMoves.has(pure)||row.id!=='1a'||pure.changesSha256!==hash(JSON.stringify(changes))))return fail('r07_archive_proof_invalid');
 const app=[...row.appPaths,...scopes.commonAppPaths,scopes.testPathPerRow.replace('<id>',row.id)];
 const allowed=new Set([...app.map(p=>scopes.appRoot+p),...row.repositoryPaths,...scopes.commonRepositoryPaths]);
 let total=0;
 for(const c of changes){
  safePath(c.path);
  if(!Number.isSafeInteger(c.added)||!Number.isSafeInteger(c.deleted)||c.added<0||c.deleted<0)return fail('r07_slice_diff_unmeasurable');
  if(!allowed.has(c.path))return fail('r07_slice_path_outside');
  total+=c.added+c.deleted;
  if(!Number.isSafeInteger(total)||total-(pure?.pureMoveAddedDeletedLines??0)>CAP)return fail('r07_slice_size_exceeded');
 }
 return total;
}
export const predecessors=(scopes:Scopes,row:Row)=>scopes.rows.slice(0,scopes.rows.findIndex(r=>r.id===row.id));
function result(raw:unknown,head:string,tree:string):Record<string,unknown>{
 const r=object(raw);
 if(r.status!=='PASS'||r.headSha!==head||r.treeSha!==tree||r.exitCode!==0||typeof r.cwd!=='string'||!r.cwd||!Array.isArray(r.command)||r.command.length===0||!r.command.every(x=>typeof x==='string')||typeof r.logPath!=='string'||!r.logPath||typeof r.logSha256!=='string'||!/^[a-f0-9]{64}$/.test(r.logSha256))return fail('r07_slice_evidence_stale');
 object(r.counts);return r;
}
export function checkExit(raw:unknown,row:Row,f:Facts,earlier:ReadonlyMap<string,Facts>=new Map()):void{
 const p=object(raw);
 if(EXIT_FIELDS.some(k=>!Object.hasOwn(p,k)||p[k]===null||p[k]===undefined))return fail('r07_slice_exit_evidence_missing');
 if(p.schema!=='r07-slice-exit.v1'||p.status!=='EXITED'||p.row!==row.id||p.decidedBy!=='owner'||p.repository!=='park-kyungchan/education-platform'||p.branch!=='feat/r07-'+row.id)return fail('r07_slice_exit_evidence_missing');
 if(!hash64(EVAL_HASH)||p.planSha256!==PLAN_HASH||p.scopesSha256!==PLAN_SCOPES_HASH||p.evalSha256!==EVAL_HASH||p.planPath!=='r07-merge/split-plan.v11.md'||p.scopesPath!=='r07-merge/split-scopes.v11.json'||p.evalPath!=='research/p6-adversarial-eval.v7.md'||p.baseSha!==f.baseSha||p.headSha!==f.prHead||p.mergeSha!==f.mergeSha||p.mergeTreeSha!==f.mergeTree||f.headTree!==f.mergeTree||p.changedPathsDigest!==f.changedPathsDigest||!f.ancestor||!f.ciPassed)return fail('r07_slice_evidence_stale');
 sha(p.baseSha);sha(p.headSha);sha(p.mergeSha);sha(p.mergeTreeSha);
 const count=p.addedDeletedLineCount;
 const pure=f.pureMoveProof;
 if(row.id!=='1a'&&Object.hasOwn(p,'pureMoveEvidence'))return fail('r07_archive_proof_invalid');
 if(row.id==='1a'){
  if(!p.pureMoveEvidence)return fail('r07_slice_exit_evidence_missing');
  if(!pure||!issuedMoves.has(pure)||pure.baseSha!==f.baseSha||pure.headSha!==f.prHead||pure.baseTreeSha!==f.baseTree||pure.headTreeSha!==f.headTree||pure.rawAddedDeletedLines!==f.changedCount)return fail('r07_archive_proof_invalid');
  const recorded=object(p.pureMoveEvidence);result(recorded,f.prHead,f.headTree);
  if(Object.entries(pure).some(([key,value])=>JSON.stringify(recorded[key])!==JSON.stringify(value)))return fail('r07_archive_proof_invalid');
 }
 if(typeof count!=='number'||!Number.isSafeInteger(count)||count<0||count-(row.id==='1a'?(pure?.pureMoveAddedDeletedLines??0):0)>CAP||count!==f.changedCount)return fail('r07_slice_size_exceeded');
 for(const [key,ids]of [['dependencyExits',row.dependsOn],['earlierRowExits',[...earlier.keys()]]] as const){
  const value=p[key];if(!Array.isArray(value))return fail('r07_slice_exit_evidence_missing');
  const entries=value.map(object),actual=entries.map(e=>text(e.row));
  if(!unique(actual)||actual.length!==ids.length||ids.some(id=>!actual.includes(id)))return fail('r07_slice_exit_evidence_missing');
  for(const e of entries){const prior=earlier.get(text(e.row));if(!prior||e.headSha!==prior.prHead||e.mergeSha!==prior.mergeSha||e.exitEvidenceSha256!==prior.exitDigest)return fail('r07_slice_evidence_stale');}
 }
 if(typeof p.fullFailureCount!=='number'||p.fullFailureCount<0||p.fullFailureCount>=2)return fail('r07_slice_stop_counter');
 const stage=object(p.sameStageFailureCounts);
 if(Object.values(stage).some(v=>typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>=2))return fail('r07_slice_stop_counter');
 for(const k of ['strictTypeGate','mergedTreeUnitSuite','freshFullReview','hostedCi'])result(p[k],f.prHead,f.headTree);
 const review=object(p.freshFullReview);
 if(!['gpt-6.1-sol','gpt-6.1-terra'].includes(text(review.model))||typeof review.thread!=='string'||!review.thread||typeof review.authorTaskId!=='string'||review.thread===review.authorTaskId||review.nativeIdentityVerified!==true)return fail('r07_slice_reviewer_invalid');
 const suite=object(p.mergedTreeUnitSuite);
 if(suite.amendmentSha256!==BASELINE_AMENDMENT_HASH)return fail('r07_slice_baseline_invalid');
 const baseUnit=measurement(suite.baseMeasurement,f.baseSha,f.baseTree),candidateUnit=measurement(suite.candidateMeasurement,f.prHead,f.headTree),comparison=object(suite.comparison);
 const baseCounts=object(baseUnit.counts),candidateCounts=object(candidateUnit.counts),total=(c:Record<string,unknown>)=>Number(c.pass)+Number(c.fail)+Number(c.skipped);
 if(comparison.baseCases!==total(baseCounts)||comparison.candidateCases!==total(candidateCounts)||comparison.retainedBaseCases!==total(baseCounts)||comparison.newCases!==total(candidateCounts)-total(baseCounts)||['newFailures','regressions','omittedCases','newUnpassedCases'].some(k=>comparison[k]!==0))return fail('r07_slice_baseline_invalid');
 if(!Array.isArray(p.guardMapResults)||p.guardMapResults.length===0||!Array.isArray(p.predecessorAndPositiveControls)||p.predecessorAndPositiveControls.length===0)return fail('r07_slice_exit_evidence_missing');
 for(const guard of p.guardMapResults){const g=result(guard,f.prHead,f.headTree);if(typeof g.caseSource!=='string'||!g.caseSource)return fail('r07_slice_exit_evidence_missing');}
 for(const control of p.predecessorAndPositiveControls){const c=object(control),negative=object(c.negative);result(c.positive,f.prHead,f.headTree);if(negative.expectedFailureObserved!==true||negative.setupFailure!==false||typeof negative.assertionFailures!=='number'||negative.assertionFailures<1||typeof negative.logSha256!=='string'||!/^[a-f0-9]{64}$/.test(negative.logSha256))return fail('r07_slice_exit_evidence_missing');}
 if(typeof p.activeHoursSinceExit!=='number'||!Number.isFinite(p.activeHoursSinceExit)||p.activeHoursSinceExit<0)return fail('r07_slice_exit_evidence_missing');
 const budget=object(p.budget);if(typeof budget.dominantStep!=='string'||!budget.dominantStep)return fail('r07_slice_exit_evidence_missing');
 for(const key of ['verifiedAt','holdsReadAt','guiderNotesReadAt'])if(typeof p[key]!=='string'||!Number.isFinite(Date.parse(p[key])))return fail('r07_slice_evidence_stale');
}
function git(root:string,args:string[],allowFailure=false):string|null{
 const r=Bun.spawnSync(['git',...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
 if(r.exitCode!==0){if(allowFailure)return null;return fail('r07_slice_git_failed');}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(r.stdout);}catch{return fail('r07_slice_diff_unmeasurable');}
}
async function api(repository:string,path:string):Promise<unknown>{
 const token=process.env.GITHUB_TOKEN;if(!token)return fail('r07_slice_api_token_missing');
 const response=await fetch('https://api.github.com/repos/'+repository+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 if(!response.ok)return fail('r07_slice_api_failed');
 return response.json();
}
export async function liveCi(repository:string,head:string,read:(repository:string,path:string)=>Promise<unknown>=api):Promise<boolean>{
 const response=object(await read(repository,'/actions/workflows/source.yml/runs?head_sha='+head+'&event=pull_request&per_page=100'));
 if(!Array.isArray(response.workflow_runs))return fail('r07_slice_api_failed');
 const runs=response.workflow_runs.map(object).filter(r=>r.head_sha===head&&r.event==='pull_request').sort((a,b)=>Number(b.id)-Number(a.id));
 const latest=runs[0];if(!latest||latest.status!=='completed'||latest.conclusion!=='success'||!Number.isSafeInteger(latest.id)||!Number.isSafeInteger(latest.run_attempt))return false;
 const responseJobs=object(await read(repository,'/actions/runs/'+String(latest.id)+'/attempts/'+String(latest.run_attempt)+'/jobs?per_page=100'));
 if(!Array.isArray(responseJobs.jobs))return fail('r07_slice_api_failed');
 const jobs=responseJobs.jobs.map(object);
 return REQUIRED_CHECKS.every(name=>{const matches=jobs.filter(j=>j.name===name);return matches.length===1&&matches.every(j=>j.head_sha===head&&j.status==='completed'&&j.conclusion==='success');});
}
async function mergedExit(root:string,repository:string,base:string,row:Row,earlier:ReadonlyMap<string,Facts>):Promise<Facts>{
 const owner=repository.split('/')[0]??fail('r07_slice_repository_invalid');
 const response=await api(repository,'/pulls?state=closed&base=main&head='+encodeURIComponent(owner+':feat/r07-'+row.id)+'&per_page=100');
 if(!Array.isArray(response))return fail('r07_slice_api_failed');
 const prs=response.map(object).filter(p=>p.merged_at!==null&&p.merged_at!==undefined&&object(p.head).ref==='feat/r07-'+row.id&&object(p.base).ref==='main');
 if(prs.length!==1)return fail('r07_slice_order_unmerged');
 const pr=prs[0]??fail('r07_slice_order_unmerged'),head=object(pr.head);
 if(object(head.repo).full_name!==repository||object(object(pr.base).repo).full_name!==repository)return fail('r07_slice_repository_invalid');
 const prHead=sha(head.sha),mergeSha=sha(pr.merge_commit_sha);
 const body=text(pr.body),block=/<!-- r07-slice-exit.v1 -->\s*```json\n([\s\S]*?)\n```\s*<!-- \/r07-slice-exit.v1 -->/.exec(body);
 if(!block?.[1])return fail('r07_slice_exit_evidence_missing');
 const ciPassed=await liveCi(repository,prHead);
 const baseSha=(git(root,['rev-parse',mergeSha+'^1'])??'').trim();
 if((git(root,['rev-parse',mergeSha+'^2'])??'').trim()!==prHead)return fail('r07_slice_evidence_stale');
 const changes=parseNumstat(git(root,['diff','--no-renames','--numstat','-z',baseSha,prHead])??'');
 const facts:Facts={prHead,mergeSha,baseSha,baseTree:(git(root,['rev-parse',baseSha+'^{tree}'])??'').trim(),changedCount:changes.reduce((n,c)=>n+c.added+c.deleted,0),changedPathsDigest:hash(JSON.stringify(changes.map(c=>c.path).sort())),exitDigest:hash(block[1]),mergeTree:(git(root,['rev-parse',mergeSha+'^{tree}'])??'').trim(),headTree:(git(root,['rev-parse',prHead+'^{tree}'])??'').trim(),ancestor:git(root,['merge-base','--is-ancestor',mergeSha,base],true)!==null,ciPassed};
 if(row.id==='1a')facts.pureMoveProof=verifyPureMoves(root,baseSha,prHead,row.pureMoveAllowance);
 checkExit(JSON.parse(block[1]),row,facts,earlier);return facts;
}
export function executingUnitRuntime(root:string):string{
 const workflow=object(Bun.YAML.parse(readFileSync(resolve(root,'.github/workflows/source.yml'),'utf8'))),steps=object(object(workflow.jobs).source).steps;
 if(!Array.isArray(steps))return fail('r07_unit_runtime_unknown');
 const shared=steps.map(object).filter(s=>typeof s.uses==='string'&&s.uses.startsWith('park-kyungchan/agent-platform/.github/actions/bun-source@'));
 if(shared.length!==1)return fail('r07_unit_runtime_unknown');
 const version=text(object(shared[0]?.with)['bun-version']),pkg=object(JSON.parse(readFileSync(resolve(root,'apps/academy/dc-gang-a/package.json'),'utf8')));
 if(!pkg.engines||object(pkg.engines).bun!==version||version!==Bun.version)return fail('r07_unit_engine_mismatch');return version;
}
async function ciUnit(root:string):Promise<void>{
 executingUnitRuntime(root);const dir=mkdtempSync(resolve(text(process.env.RUNNER_TEMP),'r07-unit-')),cwd=resolve(root,'apps/academy/dc-gang-a'),script=resolve(cwd,'scripts/check-r07-slice-size.ts');
 const head=sha(process.env.R07_HEAD_SHA);if((git(root,['rev-parse','HEAD'])??'').trim()!==head||git(root,['status','--porcelain=v1','--untracked-files=all','-z']))return fail('r07_unit_source_dirty');
 const run=(name:string,command:string[],at:string)=>{
  const r=Bun.spawnSync(command,{cwd:at,stdout:'pipe',stderr:'pipe'}),log=Buffer.concat([r.stdout,r.stderr]),logPath=resolve(dir,name+'.log');writeFileSync(logPath,log,{flag:'wx'});
  const footer=log.toString().replace(/\x1b\[[0-9;]*m/g,'').split('\n').slice(-10).join('\n'),n=(s:string)=>Number(new RegExp('(?:^|\\n)\\s*(\\d+) '+s+'\\b').exec(footer)?.[1]??'0');
  const counts=name==='broad-U'?{pass:n('pass'),fail:n('fail'),skipped:n('skip'),todo:n('todo'),errors:n('errors?'),total:Number(/Ran (\d+) tests? across/.exec(footer)?.[1]??'-1'),files:Number(/tests? across (\d+) files?/.exec(footer)?.[1]??'-1')}:{bytes:log.length};
  const out={status:r.exitCode===0?'PASS':'FAIL',command,cwd:at,headSha:(git(at,['rev-parse','HEAD'])??'').trim(),treeSha:(git(at,['rev-parse','HEAD^{tree}'])??'').trim(),exitCode:r.exitCode,signalCode:r.signalCode??null,logPath,logSha256:hash(log),counts};writeFileSync(resolve(dir,name+'.execution.json'),JSON.stringify(out,null,2)+'\n',{flag:'wx'});
  if(name==='broad-U'&&typeof counts.total==='number'&&(counts.total<1||counts.total!==Number(counts.pass)+Number(counts.fail)+Number(counts.skipped)+Number(counts.todo)))return fail('r07_unit_run_incomplete',logPath);
  if(r.exitCode!==0||r.signalCode!==null&&r.signalCode!==undefined)return fail('r07_unit_command_failed',logPath);return log.toString();
 };
 const log=run('broad-U',[process.execPath,'--no-env-file','test','tests'],cwd),footer=log.replace(/\x1b\[[0-9;]*m/g,'').split('\n').slice(-10).join('\n');
 if(!/Ran \d+ tests? across \d+ files?/.test(footer)||!/\n\s*0 fail\s*\n/.test(footer)||/\n\s*[1-9]\d* errors?\b/.test(footer))return fail('r07_unit_run_incomplete');
 if(git(root,['status','--porcelain=v1','--untracked-files=all','-z']))return fail('r07_unit_source_dirty');
 if((process.env.R07_PR_REF??'').startsWith('feat/r07-')){
  const base=sha(process.env.R07_BASE_SHA),baseRoot=resolve(dir,'base');if((git(root,['rev-parse','origin/main'])??'').trim()!==base||git(root,['merge-base','--is-ancestor',base,head],true)===null)return fail('r07_slice_evidence_stale');
  git(root,['worktree','add','--detach',baseRoot,base]);run('base-setup',[process.execPath,'run','setup'],baseRoot);
  measureUnit(baseRoot,resolve(dir,'base-unit'));measureUnit(root,resolve(dir,'candidate-unit'));
  run('comparison-C',[process.execPath,'--no-env-file',script,'compare-unit-baseline',resolve(dir,'base-unit.result.json'),resolve(dir,'candidate-unit.result.json')],cwd);
 }
 console.log('PASS U_absolute C_separate artifacts='+dir);
}
export async function main():Promise<void>{
 if(process.argv[2]==='ci-unit'){await ciUnit(resolve(process.cwd()));return;}
 if(process.argv[2]==='measure-unit'){
  if(process.argv.length!==5)return fail('r07_slice_baseline_invalid');console.log(JSON.stringify({status:'COMPLETE',...measureUnit(text(process.argv[3]),text(process.argv[4]))}));return;
 }
 if(process.argv[2]==='compare-unit-baseline'){
  if(process.argv.length!==5)return fail('r07_slice_baseline_invalid');
  const result=await compareMeasurements(resolve(process.cwd(),'../../..'),text(process.argv[3]),text(process.argv[4]));console.log(JSON.stringify({status:'PASS',...result}));return;
 }
 const ref=process.env.R07_PR_REF??'';
 if(!ref.startsWith('feat/r07-')){console.log('PASS non_r07_event');return;}
 const root=resolve(process.cwd()),base=sha(process.env.R07_BASE_SHA),head=sha(process.env.R07_HEAD_SHA);
 const repository=process.env.R07_REPOSITORY;
 if(repository!=='park-kyungchan/education-platform'||process.env.R07_HEAD_REPOSITORY!==repository)return fail('r07_slice_repository_invalid');
 if(git(root,['merge-base','--is-ancestor',base,head],true)===null)return fail('r07_slice_base_not_integrated');
 const baseText=git(root,['show',base+':'+SCOPE_PATH],true);
 const headText=git(root,['show',head+':'+SCOPE_PATH])??fail('r07_slice_scope_invalid');
 const scopes=parseScopes(selectScopeText(baseText,headText,ref)),row=select(scopes,ref);
 const changes=parseNumstat(git(root,['diff','--no-renames','--numstat','-z',base,head])??'');
 const pure=row.id==='1a'?verifyPureMoves(root,base,head,row.pureMoveAllowance):undefined;
 const count=checkChanges(scopes,row,changes,pure);
 const earlier=new Map<string,Facts>();
 for(const prior of predecessors(scopes,row))earlier.set(prior.id,await mergedExit(root,repository,base,prior,earlier));
 if(pure)console.log(JSON.stringify({status:'PASS',pureMoveEvidence:pure}));
 console.log('PASS row='+row.id+' lines='+count+' earlier='+predecessors(scopes,row).length);
}
if(import.meta.main)main().catch(error=>{console.error(error instanceof Error&&/^r07_[a-z_]+@/.test(error.message)?error.message:'r07_slice_invalid@'+source+':1');process.exitCode=1;});
