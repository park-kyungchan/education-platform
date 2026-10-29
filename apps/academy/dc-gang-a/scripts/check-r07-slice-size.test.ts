import {expect,test} from 'bun:test';
import fc from 'fast-check';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {CAP,SCOPE_PATH,BOOTSTRAP_HASH,PLAN_HASH,PLAN_SCOPES_HASH,EVAL_HASH,BASELINE_AMENDMENT_HASH,EXIT_FIELDS,REQUIRED_CHECKS,UNIT_STATUSES,UNIT_TRANSITIONS,compareUnitIdentities,parseJUnitIdentities,verifyUnitCompletion,verifyDuplicateProducer,MOVE_FAULTS,verifyPureMoves,liveCi,parseScopes,select,selectScopeText,parseNumstat,checkChanges,checkExit,predecessors,sha,type Facts,type Row} from './check-r07-slice-size';
import {inspectEachProducer,inspectEachBatch,EachObserver,EACH_ROW_KINDS,FORBIDDEN_EACH_ANCESTORS,EACH_SYNTAX_KIND as SyntaxKind} from './type-escape-ratchet';
import {createHash} from 'node:crypto';

const root=resolve(import.meta.dir,'../../../..'),scopeText=readFileSync(join(root,SCOPE_PATH),'utf8'),scopes=parseScopes(scopeText);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const foundation=scopes.rows[0];if(!foundation)throw Error('test_scope_empty');
const allowed=(row:Row)=>[...row.appPaths,...scopes.commonAppPaths,scopes.testPathPerRow.replace('<id>',row.id)].map(p=>scopes.appRoot+p).concat(row.repositoryPaths,scopes.commonRepositoryPaths);
const facts=():Facts=>{const a=archiveFixture(),pureMoveProof=verifyPureMoves(a.root,a.base,a.head,a.allowance);return {prHead:a.head,mergeSha:'b'.repeat(40),mergeTree:pureMoveProof.headTreeSha,headTree:pureMoveProof.headTreeSha,baseSha:a.base,baseTree:pureMoveProof.baseTreeSha,changedCount:pureMoveProof.rawAddedDeletedLines,changedPathsDigest:'e'.repeat(64),exitDigest:'f'.repeat(64),ancestor:true,ciPassed:true,pureMoveProof};};
function proof(row:Row,f:Facts,earlier:ReadonlyMap<string,Facts>){
 const result=()=>({status:'PASS',headSha:f.prHead,treeSha:f.headTree,exitCode:0,cwd:'/synthetic/source',command:['bun','test'],logPath:'synthetic.log',logSha256:'e'.repeat(64),counts:{pass:1,fail:0}});
 const unit=(headSha:string,treeSha:string)=>({schema:'r07-unit-measurement.v1',completed:true,suite:'apps/academy/dc-gang-a/tests/academy',status:'PASS',headSha,treeSha,exitCode:0,cwd:'/synthetic/apps/academy/dc-gang-a',command:['bun','--no-env-file','test','tests/academy','--reporter=junit','--reporter-outfile=/synthetic/unit.junit.xml'],counts:{pass:1,fail:0,skipped:0},artifacts:Object.fromEntries(['log','junit','execution','identities'].map(k=>[k,{path:k==='junit'?'/synthetic/unit.junit.xml':'/synthetic/unit.'+k,sha256:'d'.repeat(64)}]))});
 const ref=(id:string)=>{const p=earlier.get(id);if(!p)throw Error('test_prior_missing');return {row:id,headSha:p.prHead,mergeSha:p.mergeSha,exitEvidenceSha256:p.exitDigest};};
 return {...Object.fromEntries(EXIT_FIELDS.map(k=>[k,{}])),schema:'r07-slice-exit.v1',status:'EXITED',decidedBy:'owner',row:row.id,repository:'park-kyungchan/education-platform',branch:'feat/r07-'+row.id,
 planPath:'r07-merge/split-plan.v11.md',scopesPath:'r07-merge/split-scopes.v11.json',evalPath:'research/p6-adversarial-eval.v7.md',planSha256:PLAN_HASH,scopesSha256:PLAN_SCOPES_HASH,evalSha256:EVAL_HASH,
 baseSha:f.baseSha,headSha:f.prHead,mergeSha:f.mergeSha,mergeTreeSha:f.mergeTree,addedDeletedLineCount:f.changedCount,changedPathsDigest:f.changedPathsDigest,
 strictTypeGate:result(),mergedTreeUnitSuite:{...result(),amendmentSha256:BASELINE_AMENDMENT_HASH,baseMeasurement:unit(f.baseSha,f.baseTree),candidateMeasurement:unit(f.prHead,f.headTree),comparison:{baseCases:1,candidateCases:1,retainedBaseCases:1,newCases:0,newFailures:0,regressions:0,omittedCases:0,newUnpassedCases:0}},
 freshFullReview:{...result(),model:'gpt-6.1-sol',thread:'reviewer-native-thread',authorTaskId:'different-author-thread',nativeIdentityVerified:true},hostedCi:result(),
 guardMapResults:[{...result(),caseSource:'exported-contract'}],predecessorAndPositiveControls:[{positive:result(),negative:{expectedFailureObserved:true,setupFailure:false,assertionFailures:1,logSha256:'b'.repeat(64)}}],
 fullFailureCount:0,sameStageFailureCounts:{},activeHoursSinceExit:1,budget:{dominantStep:'typecheck'},holdsReadAt:'2026-10-29T00:00:00Z',guiderNotesReadAt:'2026-10-29T00:00:00Z',verifiedAt:'2026-10-29T00:00:00Z',
 ...(row.id==='1a'?{pureMoveEvidence:{...result(),...f.pureMoveProof}}:{}),dependencyExits:row.dependsOn.map(ref),earlierRowExits:[...earlier.keys()].map(ref)};
}

test('bootstrap digest and row-backed path union: every declared row/path has a legal control',()=>{
 expect(hash(scopeText)).toBe(BOOTSTRAP_HASH);
 expect(selectScopeText(null,scopeText,'feat/r07-1a')).toBe(scopeText);
 for(const row of scopes.rows){
  expect(select(scopes,'feat/r07-'+row.id)).toEqual(row);
  for(const path of allowed(row))expect(checkChanges(scopes,row,[{path,added:1,deleted:0}])).toBe(1);
  for(const suffix of ['/extra','\n',' ','.other'])expect(()=>select(scopes,'feat/r07-'+row.id+suffix)).toThrow('r07_slice_unknown');
 }
 for(const bad of ['main','feat/r07-0a','feat/r07-unknown','feat/r07-1a/../1b'])expect(()=>select(scopes,bad)).toThrow('r07_slice_unknown');
});
test('1500 inclusive, all deleted lines and generated path properties use the exported cap',()=>{
 fc.assert(fc.property(fc.integer({min:0,max:CAP+200}),fc.boolean(),(n,deletion)=>{
  const path=allowed(foundation)[0];if(!path)throw Error('test_path_missing');
  const check=()=>checkChanges(scopes,foundation,[{path,added:deletion?0:n,deleted:deletion?n:0}]);
  if(n<=CAP)expect(check()).toBe(n);else expect(check).toThrow('r07_slice_size_exceeded');
 }),{numRuns:80,seed:47});
 for(const row of scopes.rows){
  const path=allowed(row)[0];if(!path)throw Error('test_path_missing');
  expect(checkChanges(scopes,row,[{path,added:CAP,deleted:0}])).toBe(CAP);
  expect(()=>checkChanges(scopes,row,[{path,added:CAP,deleted:1}])).toThrow('r07_slice_size_exceeded');
  expect(()=>checkChanges(scopes,row,[{path:'unrelated.ts',added:0,deleted:1}])).toThrow('r07_slice_path_outside');
 }
});
test('trusted base copy defeats head-only scope widening; bootstrap is one exact projection',()=>{
 const widened=JSON.parse(scopeText);widened.rows[0].repositoryPaths.push('outside.ts');
 const text=JSON.stringify(widened);
 expect(selectScopeText(scopeText,text,'feat/r07-1a')).toBe(scopeText);
 expect(()=>selectScopeText(null,text,'feat/r07-1a')).toThrow('r07_slice_scope_untrusted');
 for(const row of scopes.rows.slice(1))expect(()=>selectScopeText(null,scopeText,'feat/r07-'+row.id)).toThrow('r07_slice_scope_untrusted');
 expect(()=>checkChanges(parseScopes(selectScopeText(scopeText,text,'feat/r07-1a')),foundation,[{path:'outside.ts',added:1,deleted:0}])).toThrow('r07_slice_path_outside');
});
test('closed metadata parser rejects every missing row field, traversal, duplicate and later dependency',()=>{
 for(const row of scopes.rows)for(const key of Object.keys(row)){
  const bad=JSON.parse(scopeText);delete bad.rows.find((r:Row)=>r.id===row.id)[key];
  expect(()=>parseScopes(JSON.stringify(bad))).toThrow('r07_slice_scope_invalid');
 }
 for(const path of ['../outside','/absolute','x/../y','x\\y','x\ny','./x']){
  const bad=JSON.parse(scopeText);bad.commonRepositoryPaths=[path];expect(()=>parseScopes(JSON.stringify(bad))).toThrow('r07_slice_scope_invalid');
 }
 const dup=JSON.parse(scopeText);dup.rows.push(dup.rows[0]);expect(()=>parseScopes(JSON.stringify(dup))).toThrow('r07_slice_scope_invalid');
 const late=JSON.parse(scopeText);late.rows[0].dependsOn=[late.rows.at(-1).id];expect(()=>parseScopes(JSON.stringify(late))).toThrow('r07_slice_scope_invalid');
 for(const value of ['a'.repeat(40)+'\n','b'.repeat(39),'--option'])expect(()=>sha(value)).toThrow('r07_slice_sha_invalid');
});
test('real git no-renames numstat counts both sides of a rename and refuses binary/unmeasurable data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'r07-numstat-'));
 const git=(args:string[])=>{const r=Bun.spawnSync(['git',...args],{cwd:dir,stdout:'pipe',stderr:'pipe'});if(r.exitCode)throw Error('synthetic_git_failed');return r.stdout.toString();};
 git(['init','-q']);git(['config','user.email','synthetic@example.invalid']);git(['config','user.name','Synthetic']);
 mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src/old.ts'),'export const value=1;\n');git(['add','.']);git(['commit','-qm','Synthetic base']);
 git(['mv','src/old.ts','src/new.ts']);
 const rows=parseNumstat(git(['diff','--cached','--no-renames','--numstat','-z']));
 expect(rows.map(r=>r.path).sort()).toEqual(['src/new.ts','src/old.ts']);
 expect(rows.reduce((n,r)=>n+r.added+r.deleted,0)).toBe(2);
 for(const raw of ['-\t-\tfile.bin\0','1\t0\tfile.ts','1\t0\tfile.ts\0'+'1\t0\tfile.ts\0'])expect(()=>parseNumstat(raw)).toThrow('r07_slice_diff_unmeasurable');
 expect(parseNumstat('')).toEqual([]);
});
test('ordered exit evidence is stronger than import readiness for every actual plan row',()=>{
 const earlier=new Map<string,Facts>();
 for(const row of scopes.rows){
  const f=facts(),p=proof(row,f,earlier);
  expect(()=>checkExit(p,row,f,earlier)).not.toThrow();
  for(const key of EXIT_FIELDS){const missing:Record<string,unknown>={...p};delete missing[key];expect(()=>checkExit(missing,row,f,earlier)).toThrow('r07_slice_exit_evidence_missing');}
  if(row.id==='1a'){expect(()=>checkExit({...p,pureMoveEvidence:null},row,f,earlier)).toThrow('r07_slice_exit_evidence_missing');expect(()=>checkExit(p,row,{...f,pureMoveProof:undefined},earlier)).toThrow('r07_archive_proof_invalid');expect(()=>checkExit({...p,pureMoveEvidence:{...p.pureMoveEvidence,pairs:[]}},row,f,earlier)).toThrow('r07_archive_proof_invalid');}
  else expect(()=>checkExit({...p,pureMoveEvidence:{}},row,f,earlier)).toThrow('r07_archive_proof_invalid');
  const peers=predecessors(scopes,row).filter(r=>!row.dependsOn.includes(r.id));
  for(const peer of peers){const bad={...p,earlierRowExits:p.earlierRowExits.filter(e=>e.row!==peer.id)};expect(()=>checkExit(bad,row,f,earlier)).toThrow('r07_slice_exit_evidence_missing');}
  expect(predecessors(scopes,row).map(r=>r.id)).toEqual([...earlier.keys()]);
  earlier.set(row.id,f);
 }
});
test('exit rejects stale live facts, Claude/self review, incomplete controls and known stop/baseline faults',()=>{
 const f=facts(),p=proof(foundation,f,new Map());
 for(const key of ['ancestor','ciPassed'] as const)expect(()=>checkExit(p,foundation,{...f,[key]:false})).toThrow('r07_slice_evidence_stale');
 expect(()=>checkExit({...p,fullFailureCount:2},foundation,f)).toThrow('r07_slice_stop_counter');
 expect(()=>checkExit({...p,sameStageFailureCounts:{typecheck:2}},foundation,f)).toThrow('r07_slice_stop_counter');
 expect(()=>checkExit({...p,headSha:'0'.repeat(40)},foundation,f)).toThrow('r07_slice_evidence_stale');
 for(const model of ['claude','gpt-6.1-sol']){
  const review={...p.freshFullReview,model,...(model==='gpt-6.1-sol'?{thread:p.freshFullReview.authorTaskId}:{})};
  expect(()=>checkExit({...p,freshFullReview:review},foundation,f)).toThrow('r07_slice_reviewer_invalid');
 }
 for(const field of ['newFailures','omittedCases','regressions','newUnpassedCases'])expect(()=>checkExit({...p,mergedTreeUnitSuite:{...p.mergedTreeUnitSuite,comparison:{...p.mergedTreeUnitSuite.comparison,[field]:1}}},foundation,f)).toThrow('r07_slice_baseline_invalid');
 expect(()=>checkExit({...p,strictTypeGate:{...p.strictTypeGate,status:'FAIL'}},foundation,f)).toThrow('r07_slice_evidence_stale');
 expect(()=>checkExit({...p,guardMapResults:[{...p.guardMapResults[0],status:'FAIL'}]},foundation,f)).toThrow('r07_slice_evidence_stale');
 expect(()=>checkExit({...p,predecessorAndPositiveControls:[{positive:p.strictTypeGate,negative:{...p.predecessorAndPositiveControls[0]?.negative,setupFailure:true}}]},foundation,f)).toThrow('r07_slice_exit_evidence_missing');
});

test('actual CI reader uses the latest attempt, never old success or a duplicate named job',async()=>{
 const head='a'.repeat(40),jobs=REQUIRED_CHECKS.map(name=>({name,head_sha:head,status:'completed',conclusion:'success'}));
 const run={id:20,run_attempt:3,head_sha:head,event:'pull_request',status:'completed',conclusion:'success'};
 const reader=(runs:unknown[],items:unknown[])=>async(repository:string,path:string):Promise<unknown>=>{
  expect(repository).toBe('park-kyungchan/education-platform');
  if(path.startsWith('/actions/workflows/source.yml/runs?'))return {workflow_runs:runs};
  expect(path).toBe('/actions/runs/20/attempts/3/jobs?per_page=100');return {jobs:items};
 };
 expect(await liveCi('park-kyungchan/education-platform',head,reader([run],jobs))).toBe(true);
 expect(await liveCi('park-kyungchan/education-platform',head,reader([{...run,id:19}, {...run,status:'in_progress',conclusion:null}],jobs))).toBe(false);
 for(const job of jobs){
  expect(await liveCi('park-kyungchan/education-platform',head,reader([run],jobs.filter(j=>j.name!==job.name)))).toBe(false);
  expect(await liveCi('park-kyungchan/education-platform',head,reader([run],jobs.map(j=>j.name===job.name?{...j,conclusion:'failure'}:j)))).toBe(false);
  expect(await liveCi('park-kyungchan/education-platform',head,reader([run],[...jobs,{...job,conclusion:'failure'}]))).toBe(false);
 }
});

const unitCase=(name:string,status:unknown='PASS')=>{const identity={file:'tests/academy/subject.test.ts',classname:'',name};return {...identity,identitySha256:hash(JSON.stringify(identity)),status};};
// Generated positive controls from base identities artifact 2c1cc1bdabb2e8f37e2af0ec07c315332624e2a0b88738cb9de61c6bfb00571a; not an admission allow-list.
const observedBaseGroups=[{"file":"tests/academy/operationalContract.test.ts","classname":"operational contract semantic and transport boundaries","name":"refuses a policy upgrade or contradictory owner/meaning at ingress","count":11},{"file":"tests/academy/learningWorkRefinements.test.ts","classname":"DOM-02 exact assessment default targets","name":"score%s never auto-assigns a clinic or closes teacher review, even with zero source wrong items","count":3},{"file":"tests/academy/retainedQueryReviewFixes.test.ts","classname":"","name":"F2 rejects malformed refusal without echoing its fields","count":3}];
for(const group of observedBaseGroups)test('actual base producer '+group.file,async()=>{
 const base=Bun.spawnSync(['git','rev-parse','origin/main'],{cwd:root,stdout:'pipe',stderr:'pipe'});expect(base.exitCode).toBe(0);const sha=base.stdout.toString().trim();
 const proof=await verifyDuplicateProducer(root,sha,sha,group,group.count);expect(proof.rows).toBe(group.count);expect(proof.closureFiles).toBeGreaterThan(0);
});
const unitArtifact=(cases:unknown[])=>({schema:'r07-unit-identities.v1',scope:'apps/academy/dc-gang-a/tests/academy',cases});
test('exported status matrix, unknown statuses, missing identities and new cases are closed',()=>{
 for(const [before,allowed]of Object.entries(UNIT_TRANSITIONS))for(const after of UNIT_STATUSES){
  const run=()=>compareUnitIdentities(unitArtifact([unitCase('A',before)]),unitArtifact([unitCase('A',after)]));
  if(allowed.some(s=>s===after))expect(run().retainedBaseCases).toBe(1);else expect(run).toThrow('r07_slice_baseline_regression');
 }
 const base=unitArtifact([unitCase('A'),unitCase('B','FAIL')]);
 expect(compareUnitIdentities(base,unitArtifact([unitCase('B','FAIL'),unitCase('A')])).retainedBaseCases).toBe(2);
 expect(()=>compareUnitIdentities(base,unitArtifact([unitCase('B','FAIL')]))).toThrow('r07_slice_baseline_omitted');
 for(const status of UNIT_STATUSES){const run=()=>compareUnitIdentities(base,unitArtifact([unitCase('A'),unitCase('B','FAIL'),unitCase('new',status)]));if(status==='PASS')expect(run().newCases).toBe(1);else expect(run).toThrow('r07_slice_baseline_new_failure');}
 fc.assert(fc.property(fc.string({minLength:1,maxLength:24}).filter(s=>!UNIT_STATUSES.some(v=>v===s)),status=>expect(()=>compareUnitIdentities(base,unitArtifact([unitCase('A',status)]))).toThrow('r07_slice_baseline_invalid')),{numRuns:30,seed:49});
 expect(()=>compareUnitIdentities(base,unitArtifact([unitCase('A','TODO')]))).toThrow('r07_slice_baseline_invalid');
 const ambiguous=unitArtifact([unitCase('group'),unitCase('group','FAIL')]);
 expect(()=>compareUnitIdentities(ambiguous,unitArtifact([unitCase('group','FAIL'),unitCase('group')]))).toThrow('r07_slice_baseline_ambiguous');
});
const registration=(rows='[1,2]')=>`test.each(${rows})('group',()=>{});`;
const program=(body:string)=>"import {test,describe} from 'bun:test';\n"+body;
test('immutable raw-source ASTs preserve hashbang and import metadata across interleaved sources',async()=>{
 const texts=["#!/usr/bin/env bun\nimport './first';", "import './second';\nexport const value=1;",program(registration()),"import type {Input} from './types';\nexport const value=2;"];
 const observed=await inspectEachBatch(texts.map((text,i)=>({text,name:i===2?'group':undefined})));
 for(const [i,imports]of [['./first'],['./second'],['bun:test'],[]].entries()){const result=observed[i];expect(result?.error).toBeUndefined();expect(result?.value?.imports).toEqual(imports);}
 expect((await inspectEachProducer(texts[0]??'')).imports).toEqual(['./first']);
 await expect(inspectEachProducer(program(registration('[external]')),'group')).rejects.toThrow('r07_duplicate_producer_invalid');
});
function producerFixture(body=registration(),hook?:string){
 const dir=mkdtempSync(join(tmpdir(),'r07-producer-git-')),app=join(dir,'apps/academy/dc-gang-a/tests/academy');mkdirSync(app,{recursive:true});mkdirSync(join(dir,'provenance'));
 writeFileSync(join(dir,'provenance/private-context-integration.json'),JSON.stringify({packages:[],additionalCustody:{groups:[]}}));
 writeFileSync(join(app,'subject.test.ts'),program(body));if(hook!==undefined)writeFileSync(join(app,'hook.ts'),hook);
 const git=(args:string[])=>{const r=Bun.spawnSync(['git',...args],{cwd:dir,stdout:'pipe',stderr:'pipe'});if(r.exitCode)throw Error('synthetic_git_failed');return r.stdout.toString().trim();};
 git(['init','-q']);git(['config','user.name','Synthetic']);git(['config','user.email','synthetic@example.invalid']);
 const commit=()=>{git(['add','.']);git(['commit','-qm','Synthetic producer']);return git(['rev-parse','HEAD']);};
 return {dir,app,git,commit,base:commit()};
}
test('real Git+AST proof admits unchanged all-PASS rows and refuses replacement, drop, mixed or imported registration changes',async()=>{
 const f=producerFixture(),first=unitCase('group'),group=unitArtifact([first,first]);
 const proof=await verifyDuplicateProducer(f.dir,f.base,f.base,first,2),binding={baseSha:f.base,headSha:f.base};
 expect(compareUnitIdentities(group,group,[proof],binding).retainedBaseCases).toBe(2);
 expect(()=>compareUnitIdentities(group,unitArtifact([first]),[proof],binding)).toThrow('r07_slice_baseline_ambiguous');
 expect(()=>compareUnitIdentities(group,unitArtifact([first,unitCase('group','FAIL')]),[proof],binding)).toThrow('r07_slice_baseline_ambiguous');
 expect(()=>compareUnitIdentities(unitArtifact([first,unitCase('group','FAIL')]),group,[proof],binding)).toThrow('r07_slice_baseline_ambiguous');
 writeFileSync(join(f.app,'subject.test.ts'),program(registration('[2,3]')));const changed=f.commit();
 await expect(verifyDuplicateProducer(f.dir,f.base,changed,first,2)).rejects.toThrow('r07_duplicate_import_changed');
 const imported=producerFixture("import './hook';\n"+registration(),'export const value=1;');
 const positive=await verifyDuplicateProducer(imported.dir,imported.base,imported.base,first,2);expect(positive.closureFiles).toBeGreaterThan(1);
 writeFileSync(join(imported.app,'hook.ts'),program("test('group',()=>{});"));const registrationChange=imported.commit();
 await expect(verifyDuplicateProducer(imported.dir,imported.base,registrationChange,first,2)).rejects.toThrow('r07_duplicate_import_changed');
});
test('AST row controls enumerate exported grammar and reject free or dynamic values',async()=>{
 const observer=new EachObserver();
 const inspect=(text:string,name:string)=>inspectEachProducer(text,name,observer);
 try{
 const positives={literal:'[1,{value:[null,true,-2]}]',closed_assignment:'[(value:any)=>value.a=1,(value:any)=>value.a=2]'};
 for(const kind of EACH_ROW_KINDS){const r=await inspect(program(registration(positives[kind])),'group');expect(r.rows).toBe(2);expect(r.rowKinds.every(k=>k===kind)).toBe(true);}
 for(const rows of ['[external,2]','[call(),2]','[...external]','[1,,2]','[`x${external}`,2]','[(v:any)=>v.a=external]','[(v:any)=>v["a"]=1]','[(v:any)=>{v.a=1;}]','[(v:any)=>v.a+=1]','[(...v:any[])=>v.a=1]'])await expect(inspect(program(registration(rows)),'group')).rejects.toThrow('r07_duplicate_producer_invalid');
 }finally{await observer.close();}
});
test('AST ancestry controls enumerate every exported forbidden parent kind',async()=>{
 const observer=new EachObserver(),inspect=(text:string,name:string)=>inspectEachProducer(text,name,observer);
 try{
 const wrappers={
  [SyntaxKind.IfStatement]:(c:string)=>`if(true){${c}}`,[SyntaxKind.ForStatement]:(c:string)=>`for(let i=0;i<1;i++){${c}}`,[SyntaxKind.ForInStatement]:(c:string)=>`for(const k in {}){${c}}`,[SyntaxKind.ForOfStatement]:(c:string)=>`for(const k of []){${c}}`,
  [SyntaxKind.WhileStatement]:(c:string)=>`while(false){${c}}`,[SyntaxKind.DoStatement]:(c:string)=>`do{${c}}while(false);`,[SyntaxKind.SwitchStatement]:(c:string)=>`switch(1){case 1:${c}break;}`,[SyntaxKind.TryStatement]:(c:string)=>`try{${c}}finally{}`,
  [SyntaxKind.ConditionalExpression]:(c:string)=>`true?${c.replace(/;$/,'')}:undefined;`,[SyntaxKind.ClassDeclaration]:(c:string)=>`class Wrapper{static{${c}}}`,[SyntaxKind.ModuleDeclaration]:(c:string)=>`namespace Wrapper{${c}}`,
 };
 for(const kind of FORBIDDEN_EACH_ANCESTORS)await expect(inspect(program(wrappers[kind](registration())),'group')).rejects.toThrow('r07_duplicate_producer_invalid');
 }finally{await observer.close();}
});
test('AST producer rejects aliases, unknown functions and a second registration with a direct describe positive',async()=>{
 const observer=new EachObserver(),inspect=(text:string,name:string)=>inspectEachProducer(text,name,observer);
 try{
 for(const body of ["const alias=test;alias.each([1,2])('group',()=>{});",`function later(){${registration()}}later();`,`describe.each([1,2])('outer',()=>{${registration()}});`,registration()+registration(),"test.each(external)('group',()=>{});",...['skip','todo','only','call','apply'].map(method=>registration()+`test.${method}('group',()=>{});`),registration()+"const extra=require('bun:test');extra.test('group',()=>{});",registration()+"import('bun:test').then(extra=>extra.test('group',()=>{}));"])await expect(inspect(program(body),'group')).rejects.toThrow('r07_duplicate_producer_invalid');
 expect((await inspect(program(`describe('outer',()=>{${registration()}});`),'group')).rows).toBe(2);
 }finally{await observer.close();}
});
test('JUnit and raw process completion refuse TODO, unknown, truncation and lost exit custody',()=>{
 const junit=(body='')=>`<?xml version="1.0"?><testsuites><testsuite><testcase name="A" classname="" file="tests/academy/subject.test.ts">${body}</testcase></testsuite></testsuites>`;
 const passed=parseJUnitIdentities(junit()),log=' 1 pass\n 0 fail\nRan 1 test across 1 file.\n';
 expect(()=>verifyUnitCompletion(log,passed.cases,0,null)).not.toThrow();
 for(const body of ['<skipped message="TODO" />','<unknown />','<failure/><skipped/>'])expect(()=>parseJUnitIdentities(junit(body))).toThrow('r07_unit_status_unknown');
 expect(()=>parseJUnitIdentities(junit().replace('</testsuites>',''))).toThrow('r07_unit_run_incomplete');
 for(const changed of [log.replace('Ran 1','Ran 2'),log.replace(' 0 fail',' 1 errors\n 0 fail'),log.replace('Ran 1 test across 1 file.','')])expect(()=>verifyUnitCompletion(changed,passed.cases,0,null)).toThrow('r07_unit_run_incomplete');
 expect(()=>verifyUnitCompletion(log,passed.cases,0,undefined)).toThrow('r07_unit_run_incomplete');
 expect(()=>verifyUnitCompletion(log,passed.cases,1,null)).toThrow('r07_unit_run_incomplete');
});
function archiveFixture(fault?:typeof MOVE_FAULTS[number],nonMoveLines=0){
 const root=mkdtempSync(join(tmpdir(),'r07-archive-git-')),from='apps/academy/dc-gang-a/tests/harness/subject.test.ts',to='apps/academy/dc-gang-a/archive/r07-u-overlay/harness/subject.test.ts',manifestPath='architecture/r07-u-archive.v1.json';
 const put=(path:string,text:string)=>{mkdirSync(resolve(root,path,'..'),{recursive:true});writeFileSync(join(root,path),text);};
 const git=(args:string[])=>{const r=Bun.spawnSync(['git',...args],{cwd:root,stdout:'pipe',stderr:'pipe'});if(r.exitCode)throw Error('archive_fixture_setup_failed');return r.stdout.toString().trimEnd();};
 git(['init','-q']);git(['config','user.name','Synthetic']);git(['config','user.email','synthetic@example.invalid']);
 const commit=()=>{git(['add','.']);git(['commit','-qm','Synthetic archive']);return git(['rev-parse','HEAD']);};
 const body='export const value=1;\n';put(from,body);if(fault==='destination_preexisting')put(to,body);if(fault==='extra')put(from.replace('subject','extra'),body);
 const base=commit(),baseBlobSha=git(['rev-parse',base+':'+from]),entry={from,to,baseBlobSha,lines:1};
 if(fault==='missing'||fault==='destination_preexisting')git(['rm',from]);else{mkdirSync(resolve(root,to,'..'),{recursive:true});git(['mv',from,to]);}
 if(fault==='content')put(to,body+'export const changed=2;\n');if(fault==='mode')chmodSync(join(root,to),0o755);if(fault==='source_retained')put(from,body);
 if(fault==='extra'){const destination=to.replace('subject','extra');git(['mv',from.replace('subject','extra'),destination]);}
 const manifest={baseSha:base,authority:{sha256:'45e1c80fd58c80fdab41e2cd6defbfa785f78e7a80c2fd40218d82e7a60dd572'},counts:{pureMoveAddedDeletedLines:2},entries:fault==='duplicate'?[entry,entry]:[entry]},manifestText=JSON.stringify(manifest)+'\n';put(manifestPath,manifestText);
 if(nonMoveLines)put('apps/academy/dc-gang-a/scripts/type-escape-ratchet.ts',Array.from({length:nonMoveLines},(_,i)=>`export const value${i}=0;`).join('\n')+'\n');
 const head=commit(),changes=parseNumstat(Bun.spawnSync(['git','diff','--no-renames','--numstat','-z',base,head],{cwd:root}).stdout.toString()),allowance={row:'1a',schema:'r07-pure-move-allowance.v1',sourceBaseSha:base,nonMoveCap:CAP,manifestPath,manifestSha256:hash(manifestText),pureMoveAddedDeletedLines:2,totalAddedDeletedCap:CAP+2};
 const row:Row={...foundation,appPaths:[...foundation.appPaths,from.slice(scopes.appRoot.length),to.slice(scopes.appRoot.length)],repositoryPaths:[...foundation.repositoryPaths,manifestPath]};
 return {root,base,head,changes,allowance,row};
}
test('actual Git move proof enumerates every exported corruption with an unchanged-blob positive',()=>{
 const f=archiveFixture(),proof=verifyPureMoves(f.root,f.base,f.head,f.allowance);
 expect(proof.nonMoveAddedDeletedLines).toBe(1);expect(proof.pairs).toHaveLength(1);expect(Object.isFrozen(proof)).toBe(true);expect(Object.isFrozen(proof.pairs[0])).toBe(true);
 expect(checkChanges(scopes,f.row,f.changes,proof)).toBe(3);
 expect(()=>checkChanges(scopes,{...f.row,id:'1b'},f.changes,proof)).toThrow('r07_archive_proof_invalid');
 expect(()=>checkChanges(scopes,f.row,f.changes,{...proof})).toThrow('r07_archive_proof_invalid');
 for(const fault of MOVE_FAULTS){const negative=archiveFixture(fault);expect(()=>verifyPureMoves(negative.root,negative.base,negative.head,negative.allowance)).toThrow('r07_archive_');}
});
test('actual move accounting keeps the1500 boundary and refuses changed diff custody',()=>{
 const f=archiveFixture(undefined,CAP-1),proof=verifyPureMoves(f.root,f.base,f.head,f.allowance);expect(proof.nonMoveAddedDeletedLines).toBe(CAP);expect(checkChanges(scopes,f.row,f.changes,proof)).toBe(CAP+2);
 expect(()=>checkChanges(scopes,f.row,f.changes.slice(1),proof)).toThrow('r07_archive_proof_invalid');
 const large=archiveFixture(undefined,CAP),bad=verifyPureMoves(large.root,large.base,large.head,large.allowance);expect(bad.nonMoveAddedDeletedLines).toBe(CAP+1);expect(()=>checkChanges(scopes,large.row,large.changes,bad)).toThrow('r07_slice_size_exceeded');
});
