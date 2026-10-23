import {test, expect, afterAll} from 'bun:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {loadSourceAuditor} from './source-auditor.ts';
const {openGitWork,validateGitWorkRecords,taskVerificationTarget}=await loadSourceAuditor();
import {qualifyExternalWork, type ExternalQualification} from './qualify-external-work.ts';

const root = mkdtempSync(join(tmpdir(),'academy-external-qualification-'));
afterAll(()=>rmSync(root,{recursive:true,force:true}));
const git = (...args: string[]) => {
  const r = Bun.spawnSync(['git','-C',root,...args],{stdout:'pipe',stderr:'pipe'});
  if (r.exitCode) throw Error(r.stderr.toString());
  return r.stdout.toString().trim();
};
git('init','-q'); git('config','user.name','Synthetic Source Test'); git('config','user.email','synthetic@example.invalid');
const project = 'qualification-fixture', repositoryId = 'synthetic/qualification-fixture', domain = 'academy-operations';
const hash = (p: string) => createHash('sha256').update(readFileSync(join(root,p))).digest('hex');
const write = (p: string, value: unknown) => {mkdirSync(join(root,p,'..'),{recursive:true}); writeFileSync(join(root,p),JSON.stringify(value,null,2)+'\n');};
const complete = {execution:'complete',verification:'passed',localAudit:'result-durable',sharedAudit:'unsynchronized',formalCompletion:'pending'};
const planned = {execution:'planned',verification:'pending',localAudit:'intent-durable',sharedAudit:'pending',formalCompletion:'pending'};
function work(workId: string) {
  const common = {schema:'common.git-work.v1',domainId:domain,projectId:project,workId};
  const path = `work/${project}/${workId}`;
  const logical = (id: string) => ({domainId:domain,projectId:project,workId,issueId:'fixture-issue',specId:'fixture-spec',specRevision:1,planId:'fixture-plan',planRevision:1,taskId:id});
  write(`${path}/work.json`,{...common,kind:'work',id:workId,repositoryId,issueId:'fixture-issue',purpose:{objective:'Synthetic source qualification fixture',successCriteria:['Use actual canonical APIs'],inScope:['Synthetic Git records'],outOfScope:['Native effects']},spec:{id:'fixture-spec',revision:1},plan:{id:'fixture-plan',revision:1},governingDecisionIds:[],historicalFenceIds:[]});
  write(`${path}/specs/fixture-spec@1.json`,{...common,kind:'spec',id:'fixture-spec',revision:1,outcome:'Qualified source result',criteria:['Exact source and receiving qualification']});
  write(`${path}/plans/fixture-plan@1.json`,{...common,kind:'plan',id:'fixture-plan',revision:1,specId:'fixture-spec',specRevision:1,objective:'Use source-owned qualification'});
  const input = (id: string, content: unknown, inputDomain=domain) => {
    const p=`${path}/inputs/${id}.json`;
    write(p,{...common,domainId:inputDomain,kind:'input',id,inputKind:'source-owner-record',origin:{ownerId:'synthetic-fixture',locator:id,kind:'source-owner-capture'},content});
    return {kind:'snapshot' as const,path:p,sha256:hash(p),fragment:'#/content'};
  };
  const task = (id: string, state=planned, dependsOn: any[]=[]) => ({...common,kind:'task' as const,id,logical:logical(id),title:'Synthetic source task',state,executionClass:'source-only' as const,dependsOn,decisionIds:[],effectIds:[],verificationEvidenceIds:[] as string[]});
  const saveTask = (t: ReturnType<typeof task>) => write(`${path}/tasks/${encodeURIComponent(t.id)}.json`,t);
  const observation = (id: string, source: unknown) => write(`${path}/evidence/${encodeURIComponent(id)}.json`,{...common,kind:'evidence',id,evidenceKind:'observation',source});
  const verify = (t: ReturnType<typeof task>, pin: {path:string;sha256:string}) => {
    const observationId=`${project}:evidence:${workId}-observation`, verificationId=`${project}:evidence:${workId}-verification`;
    const result=input('verification-result',{schemaVersion:'1.0.0',kind:'verification',id:`${project}:verification:${workId}`,projectId:project,domainId:domain,createdAt:'2026-10-21T00:00:00Z',payload:{targetRefs:[taskVerificationTarget(t as any)],criteria:[{id:'source-qualification',status:'pass',message:'Synthetic source only',evidenceRefs:[observationId]}],inputHashes:[{path:pin.path,sha256:pin.sha256}],runtime:{name:'Bun',version:'1.4.3'}}});
    write(`${path}/evidence/${encodeURIComponent(observationId)}.json`,{...common,kind:'evidence',id:observationId,evidenceKind:'observation',source:{kind:'snapshot',path:pin.path,sha256:pin.sha256,fragment:'#/content'}});
    write(`${path}/evidence/${encodeURIComponent(verificationId)}.json`,{...common,kind:'evidence',id:verificationId,evidenceKind:'verification',source:result});
    t.verificationEvidenceIds=[verificationId];saveTask(t);
    return {observationId,verificationId,result};
  };
  return {logical,input,task,saveTask,verify,observation};
}
const producer = work('synthetic-producer');
const producerInput = producer.input('source-result',{recordCount:3,coverage:'synthetic-only'});
const pt = producer.task('producer-source-task',complete);
const pe = producer.verify(pt,producerInput);
const unrelated = producer.input('unrelated-result',{recordCount:99,coverage:'another-unverified-source'});
producer.observation('unrelated-observation',unrelated);
git('add','.');git('commit','-qm','Synthetic producer result');
const producerCommit=git('rev-parse','HEAD'), producerTree=git('rev-parse','HEAD^{tree}');
const selection = (workId: string,commit: string) => ({repositoryRoot:root,repositoryId,projectId:project,workId,commit});
const pr=await openGitWork(selection('synthetic-producer',producerCommit));
const prResult=await pr.readSource(producerInput),prVerification=await pr.readSource(pe.result);
const consumer=work('synthetic-consumer'), ct=consumer.task('consumer-use-result');
const qt=consumer.task('consumer-qualify-producer',complete);
ct.dependsOn=[{taskId:qt.id,milestone:'execution-and-verification'}];
const receipt=consumer.input('receiving-qualification',{
  schema:'academy.external-source-qualification/1',disposition:'qualified-source-only',
  producer:{logical:pt.logical,repositoryId,commit:producerCommit,tree:producerTree,resultEvidenceId:pe.observationId,verificationEvidenceId:pe.verificationId,resultSha256:prResult.sha256,verificationSha256:prVerification.sha256},
  consumer:{logical:ct.logical,qualificationTaskId:qt.id},
  limitation:'Synthetic source-owner qualification, not native receiver authentication or shared delivery.',
});
consumer.verify(qt,receipt);consumer.saveTask(ct);
git('add','.');git('commit','-qm','Synthetic receiving qualification');
const consumerCommit=git('rev-parse','HEAD');
const pending=work('synthetic-pending-producer');pending.saveTask(pending.task('pending-task'));
git('add','.');git('commit','-qm','Synthetic pending prerequisite');
const pendingCommit=git('rev-parse','HEAD'),pendingTree=git('rev-parse','HEAD^{tree}');
const badDomain=work('synthetic-wrong-domain-consumer'),bdNext=badDomain.task('bad-domain-next'),bdGate=badDomain.task('bad-domain-gate',complete);
bdNext.dependsOn=[{taskId:bdGate.id,milestone:'execution-and-verification'}];
const badDomainReceipt=badDomain.input('receiving-qualification',{
  schema:'academy.external-source-qualification/1',disposition:'qualified-source-only',
  producer:{logical:pt.logical,repositoryId,commit:producerCommit,tree:producerTree,resultEvidenceId:pe.observationId,verificationEvidenceId:pe.verificationId,resultSha256:prResult.sha256,verificationSha256:prVerification.sha256},
  consumer:{logical:bdNext.logical,qualificationTaskId:bdGate.id},
},'wrong-domain');
badDomain.verify(bdGate,badDomainReceipt);badDomain.saveTask(bdNext);
git('add','.');git('commit','-qm','Synthetic wrong-domain receiving qualification');
const badDomainCommit=git('rev-parse','HEAD');
const nativeConsumer=work('synthetic-native-consumer'),ncNext=nativeConsumer.task('native-next'),ncGate=nativeConsumer.task('native-gate',complete);
ncNext.dependsOn=[{taskId:ncGate.id,milestone:'execution-and-verification'}];
const nativeReceipt=nativeConsumer.input('receiving-qualification',{
  schema:'academy.external-source-qualification/1',disposition:'qualified-source-only',
  producer:{logical:pt.logical,repositoryId,commit:producerCommit,tree:producerTree,resultEvidenceId:pe.observationId,verificationEvidenceId:pe.verificationId,resultSha256:prResult.sha256,verificationSha256:prVerification.sha256},
  consumer:{logical:ncNext.logical,qualificationTaskId:ncGate.id},
});
nativeConsumer.verify(ncGate,nativeReceipt);nativeConsumer.saveTask({...ncNext,executionClass:'native-effect'} as any);
git('add','.');git('commit','-qm','Synthetic native receiving Task');
const nativeCommit=git('rev-parse','HEAD');
const orphanConsumer=work('synthetic-unregistered-consumer'),ocNext=orphanConsumer.task('orphan-next'),ocGate=orphanConsumer.task('orphan-gate',complete);
ocNext.dependsOn=[{taskId:ocGate.id,milestone:'execution-and-verification'}];
const orphanReceipt=orphanConsumer.input('receiving-qualification',{
  schema:'academy.external-source-qualification/1',disposition:'qualified-source-only',
  producer:{logical:pt.logical,repositoryId,commit:producerCommit,tree:producerTree,resultEvidenceId:pe.observationId,verificationEvidenceId:pe.verificationId,resultSha256:prResult.sha256,verificationSha256:prVerification.sha256},
  consumer:{logical:ocNext.logical,qualificationTaskId:ocGate.id},
});
mkdirSync(join(root,'unregistered'),{recursive:true});
renameSync(join(root,orphanReceipt.path),join(root,'unregistered/receiving-qualification.json'));
orphanReceipt.path='unregistered/receiving-qualification.json';
orphanConsumer.verify(ocGate,orphanReceipt);orphanConsumer.saveTask(ocNext);
git('add','.');git('commit','-qm','Synthetic unregistered receiving envelope');
const orphanCommit=git('rev-parse','HEAD');
const binding:ExternalQualification={
  producer:{selection:selection('synthetic-producer',producerCommit),tree:producerTree,logical:pt.logical,resultEvidenceId:pe.observationId,verificationEvidenceId:pe.verificationId,milestone:'execution-and-verification'},
  consumer:{selection:selection('synthetic-consumer',consumerCommit),logical:ct.logical,qualificationTaskId:qt.id},receiverSource:receipt,
};
const api={openGitWork,validateGitWorkRecords,taskVerificationTarget,readTree:async(s:any)=>git('rev-parse',s.commit+'^{tree}')};
test('canonical source-only cross-Work result uses a separate local receiving qualification',async()=>{
  expect((await validateGitWorkRecords(await openGitWork(binding.producer.selection))).valid).toBe(true);
  expect((await validateGitWorkRecords(await openGitWork(binding.consumer.selection))).valid).toBe(true);
  const result=await qualifyExternalWork(binding,api);
  expect(result.qualified).toBe(true);expect(result.nativeReceiverAuthenticated).toBe(false);
  expect(result.producer.workId).not.toBe(result.consumer.workId);
  expect(result.qualificationTaskId).toBe(qt.id);
});
test('wrong producer Work holds the consumer',async()=>{
  const b=structuredClone(binding);b.producer.logical.workId='another-work';
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('producer_work_mismatch');
});
test('unapproved successor commit holds despite unchanged result bytes',async()=>{
  const b=structuredClone(binding);b.producer.selection.commit=consumerCommit;b.producer.tree=git('rev-parse',consumerCommit+'^{tree}');
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('receiving_producer_binding_mismatch');
});
test('missing producer Verification holds the consumer',async()=>{
  const b=structuredClone(binding);b.producer.verificationEvidenceId='missing-verification';
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('producer_verification_not_bound');
});
test('pending producer milestone holds the consumer',async()=>{
  const b=structuredClone(binding);b.producer.selection=selection('synthetic-pending-producer',pendingCommit);b.producer.tree=pendingTree;b.producer.logical=pending.logical('pending-task');
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('producer_milestone_pending');
});
test('absent receiving source qualification holds the consumer',async()=>{
  const b=structuredClone(binding);b.receiverSource={kind:'snapshot',path:'work/qualification-fixture/synthetic-consumer/inputs/missing.json'};
  await expect(qualifyExternalWork(b,api)).rejects.toThrow();
});
test('wrong exact producer tree holds the consumer',async()=>{
  const b=structuredClone(binding);b.producer.tree='0'.repeat(40);
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('producer_source_pin_mismatch');
});
test('an unrelated observation cannot borrow a completed sibling source verification',async()=>{
  const b=structuredClone(binding);b.producer.resultEvidenceId='unrelated-observation';
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('producer_result_not_bound_to_verification');
});
test('wrong receiving Input domain holds and is not promoted into valid Work evidence',async()=>{
  const b=structuredClone(binding);b.consumer={selection:selection('synthetic-wrong-domain-consumer',badDomainCommit),logical:bdNext.logical,qualificationTaskId:bdGate.id};b.receiverSource=badDomainReceipt;
  expect((await validateGitWorkRecords(await openGitWork(b.consumer.selection))).valid).toBe(false);
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('receiving_qualification_source_scope_mismatch');
});
test('source-only qualification does not admit a native-effect consumer Task',async()=>{
  const b=structuredClone(binding);b.consumer={selection:selection('synthetic-native-consumer',nativeCommit),logical:ncNext.logical,qualificationTaskId:ncGate.id};b.receiverSource=nativeReceipt;
  await expect(qualifyExternalWork(b,api)).rejects.toThrow('consumer_local_gate_not_bound');
});
test('an unregistered Input-shaped envelope cannot stand in for the receiving Work Input',async()=>{
  const b=structuredClone(binding);b.consumer={selection:selection('synthetic-unregistered-consumer',orphanCommit),logical:ocNext.logical,qualificationTaskId:ocGate.id};b.receiverSource=orphanReceipt;
  expect((await validateGitWorkRecords(await openGitWork(b.consumer.selection))).valid).toBe(true);
  await expect(qualifyExternalWork(b,api)).rejects.toThrow();
});
