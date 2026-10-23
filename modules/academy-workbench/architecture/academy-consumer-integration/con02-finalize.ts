/** Canonical local source/readiness records only. Heavy checks and SDK retries are paused by CON-COORD-003. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {strict as assert} from 'node:assert';
const root=resolve(import.meta.dir,'../..'),arc=import.meta.dir;
const work=resolve(root,'work/academy-workbench/academy-consumer-integration-20261021');
const commonRoot='/home/palantirkc/projects/agent-platform';
const commonPin='712f90deac0676e662dc5d75d88d89f7b6773bfe';
const {assertRecord,taskVerificationTarget}=await import(resolve(commonRoot,'packages/work-continuity/src/git-work/index.ts'));
const {validateArtifact}=await import(resolve(commonRoot,'packages/ontology/src/index.ts'));
const load=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const fresh=async(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const identity={schema:'common.git-work.v1',domainId:'academy-operations',projectId:'academy-workbench',workId:'academy-consumer-integration-20261021'};
const input=(id:string,content:unknown)=>({...identity,kind:'input',id,inputKind:'source-owner-record',origin:{ownerId:'accountable-consumer-subLead',locator:`native-thread:${process.env.CODEX_THREAD_ID}:${id}`,kind:'source-owner-capture'},content});
const checksPath=resolve(arc,'observations/CON-02-CHECKS-R1.json');
const checksBytes=await readFile(checksPath),checks=JSON.parse(checksBytes.toString('utf8'));
assert.equal(checks.observations[0].exitCode,0);
assert.equal(checks.observations[1].exitCode,1);
assert.ok(checks.observations[1].stderr.includes('7 pass')&&checks.observations[1].stderr.includes('3 fail')&&checks.observations[1].stderr.includes('115 expect() calls'));
assert.ok(checks.baselineHashes.length===23&&checks.baselineHashes.every((item:{match:boolean})=>item.match));
const taskPath=resolve(work,'tasks/academy-workbench%3Atask%3Aacademy-consumer-integration-20261021-con-02.json');
const task=await load(taskPath),target=taskVerificationTarget(task);
const admission=await load(resolve(work,'inputs/CON-02-ADMISSION-R1.json'));
const rootHold=input('CON-02-ROOT-SDK-HOLD-R1',{
  coordinationId:'CON-COORD-003',meaning:'Root directs writer to stop heavy checks and identical SDK startup retries; retain immutable R1 and await one same-source SDK execution through Root authorized tool path after writer idle.',
  status:['ROOT_SDK_CHECK_NEEDED','READY_FOR_ROOT_SOURCE_CHECKPOINT'],
  originalCheckSha256:sha(checksBytes),cause:'unknown; no source-defect inference',sourceOnly:true,
  missingSdkScopePassed:false,priorInputsRewritten:false,rootReceipt:'not yet received',
});
assertRecord(rootHold);await fresh(resolve(work,'inputs/CON-02-ROOT-SDK-HOLD-R1.json'),rootHold);
const sourceFiles=[];
for(const file of admission.content.canonicalSourceBinding.files){
  const bytes=await readFile(resolve(admission.content.canonicalSourceBinding.repositoryRoot,file.path));
  assert.equal(sha(bytes),file.sha256);
  sourceFiles.push({path:file.path,sha256:file.sha256,byteLength:bytes.length});
}
const productionPaths=['teacher-source-binding.ts','teacher-retained.ts','teacher-report.ts','teacher-query-tools.ts','teacher-server.ts'].map(name=>'tools/academy-mcp/src/'+name);
const testPaths=['teacher-fixture.ts','teacher-report.test.ts','teacher-tools-mcp.test.ts','teacher-transport-fixture.ts'].map(name=>'tools/academy-mcp/tests/'+name);
const knownGaps=[
  'Required new production SDK transport scope is FAILED/NOT VERIFIED: 3 startup CONNECTION_CLOSED failures with empty captured child stderr. Root same-source receipt pending; do not infer a source defect or rewrite the original failure.',
  'Canonical source loader is an explicit qualified local checkout composition, not published packaging or installed native capability. Caller must supply the source-owned authenticated read-only fetchPage; no credentials are selected or configured here.',
  'Class-preparation report covers observed dated class rows and their preparation. Detailed attempts/item judgments require a separate student selector; current schedule/roster completeness remains unknown.',
  'Student report presents canonical preparation, exact assignments, attempts, item judgments, source results and teacher notes. It does not reconstruct day attendance from unrelated evidence or claim exhaustive source/review history. Full retained fragments remain available separately.',
  'Source scores, default100 eligibility and explicit assignments remain separate. Current obligation lists are not pending counts. Physical print/distribution and other absent stages remain unknown.',
  'Report rendering displays canonical current judgments and prior refs; it neither creates nor reconciles teacher decisions independently. Real Oct19 applicable facts stay in private source/conversation custody.',
  'Original daily report is still outstanding; older reports are not presented as current. Internal lesson report is not an approved parent projection, save or send.',
  'Post-commit canonical snapshot/transition and shared package/CI/manifests remain Root-owned. CON-03 holds on VER-02 receiver qualification and Root admission.',
  'Native/WSL/VPS production integration, real source authentication/adoption, teacher acceptance, shared audit delivery and formal Work completion remain unverified/pending.',
];
const sourceEvidence={schema:'academy.consumer-con02-source-evidence.v1',createdAt:new Date().toISOString(),sourceHead:'7a1fd6127efcd3329709f4d22f75b6fc929d3342',nativeThreadId:process.env.CODEX_THREAD_ID,
  admission:'CON-02-ADMISSION-R1',baselineAdoption:'CON-BASELINES-ADOPTION-R1',canonicalSource:{...admission.content.canonicalSourceBinding,files:sourceFiles},
  ownership:'Education owns canonical contract/reader/wire validation and domain projections; Workbench owns explicit source binding, consumer request schemas, page binding and presentation only.',
  composition:{entrypoint:'tools/academy-mcp/src/teacher-server.ts',exports:['createTeacherServer','startTeacherStdio'],configuration:['explicit sourceRoot','source-owned authenticatedFetchPage callback'],nativeRegistration:false,defaultPrivateLoader:false,
    sourceReadback:'Exact Git HEAD/tree and three file hashes before import and before/after each consumer operation; finite local readback, not an atomic filesystem lock.',
    canonicalRead:'Original validateRetainedQueryReply and readRetainedDocument dynamically imported from the pinned closure; no copied wire validator or second domain reducer.',
    tools:['academy_teacher_query','academy_teacher_report']},
  budgets:{canonicalJsonPage:{defaultBytes:65536,maxBytes:131072,owner:'QRY'},fullMcpResult:{maxBytes:524288,method:'shared toolResultBytes measures text + structuredContent + escaping + framing',owner:'Workbench'},report:{defaultBytes:65536,maxBytes:524288,limit:250,scope:'each actual CallToolResult; explicit bound cursor and single-line/fixed-metadata refusal'},distinct:true},
  tests:{typecheck:'passed',reportTests:{passed:7,scope:'exact source root, canonical100/explicit assignment, teacher-final vs low score, distinct attempts, cancellation/replacement, scoped corrections/unknown edition, class occurrences, report continuation/oversize/caller change'},
    sdkTests:{failed:3,stage:'child startup',code:'CONNECTION_CLOSED',capturedChildStderr:'empty',assertionsTotal:115,coverage:'required transport cases authored; runtime scope not passed',rootCheck:'needed'},
    immutableReceipt:{path:relative(root,checksPath),sha256:sha(checksBytes)},baseline23Unchanged:true,heavyChecksPaused:true},
  priorHistory:'CON01 original7pass2CONNECTION_CLOSED and Root independent9pass0fail135assertions remain separate immutable evidence; exact divergence cause unknown.',
  productionPaths,testPaths,knownGaps,sourceEffects:false,commonConsumerPinChanged:false,realPrivateOriginalsRead:false};
await fresh(resolve(arc,'con02-source-evidence.json'),sourceEvidence);
const observationId='academy-workbench:evidence:con-02-result-observation-r1',verificationEvidenceId='academy-workbench:evidence:con-02-verification-r1';
const entry={schema:'academy.consumer-con02-entrypoint.v1',taskId:task.id,state:['ROOT_SDK_CHECK_NEEDED','READY_FOR_ROOT_SOURCE_CHECKPOINT'],sourceEvidence:'con02-source-evidence.json',
  productionEntrypoint:'tools/academy-mcp/src/teacher-server.ts',checks:'observations/CON-02-CHECKS-R1.json',resultInput:'CON-02-RESULT-R1',verificationInput:'CON-02-VERIFICATION-R1',resultEvidenceId:observationId,verificationEvidenceId,
  taskVerificationTarget:target,localRecordCheck:'observations/CON-02-LOCAL-RECORD-CHECK-R1.json',
  canonicalCheckpoint:{auditorRoot:commonRoot,pin:commonPin,committedSnapshotAndTransition:'pending Root exact source commit'},
  requiredSdkScope:'failed/not verified; Root receipt pending',next:'Writer idle; WAIT for Root exact same-source SDK receipt/checkpoint. No SDK retry or CON-03 admission inferred.',
  sharedAuditDelivery:false,nativeActivation:false,teacherAcceptance:false,formalWorkComplete:false};
await fresh(resolve(arc,'con02-entrypoint.json'),entry);
const artifactPaths=[...productionPaths,...testPaths,'architecture/academy-consumer-integration/con02-check.ts','architecture/academy-consumer-integration/con02-finalize.ts',
  'architecture/academy-consumer-integration/con02-source-evidence.json','architecture/academy-consumer-integration/con02-entrypoint.json',relative(root,checksPath),
  relative(root,resolve(work,'inputs/CON-02-EXECUTION-R1.json')),relative(root,resolve(work,'inputs/CON-02-ROOT-SDK-HOLD-R1.json'))];
const artifacts=[];
for(const path of artifactPaths){
  const bytes=await readFile(resolve(root,path)),text=bytes.toString('utf8');
  assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-proj-[A-Za-z0-9]{16}|AKIA[A-Z0-9]{16}/.test(text));
  assert.ok(!/https?:\/\/[^\s"<>]+/.test(text));
  if(path.endsWith('.json'))JSON.parse(text);
  artifacts.push({path,sha256:sha(bytes),byteLength:bytes.length});
}
const result=input('CON-02-RESULT-R1',{schema:'academy.consumer-con02-result.v1',taskId:task.id,taskVerificationTarget:target,nativeThreadId:process.env.CODEX_THREAD_ID,
  runId:'academy-workbench:run:academy-consumer-integration-20261021-con-02-r1',registration:'local source record; not native/global Run registration or authenticated authorship',
  sourceHead:sourceEvidence.sourceHead,disposition:['ROOT_SDK_CHECK_NEEDED','READY_FOR_ROOT_SOURCE_CHECKPOINT'],
  outcome:'A3/A4 owner-local teacher registration, exact canonical source composition and bounded Korean report authored. Required production SDK scope failed at child startup and awaits Root receipt; no complete integration/acceptance claim.',
  artifacts,productionPaths,testPaths,sourceEvidence:'architecture/academy-consumer-integration/con02-source-evidence.json',entrypoint:'architecture/academy-consumer-integration/con02-entrypoint.json',
  checks:sourceEvidence.tests,knownGaps,observationEvidenceId:observationId,verificationEvidenceId,
  next:'Writer idle; WAIT for Root same-source SDK observation, exact commit/canonical checkpoint and further instruction. CON-03 remains held.',
  sharedAuditDelivery:false,nativeAdoption:false,teacherAcceptance:false,formalAcceptance:false,operationalEffects:false});
assertRecord(result);const resultPath=resolve(work,'inputs/CON-02-RESULT-R1.json');await fresh(resultPath,result);
const resultHash=sha(await readFile(resultPath));
const verification={schemaVersion:'1.0.0',kind:'verification',id:'academy-workbench:verification:con-02-r1',domainId:identity.domainId,projectId:identity.projectId,createdAt:new Date().toISOString(),
  payload:{targetRefs:[target],criteria:[
    {id:'source-composition-and-typecheck',status:'pass',message:'Exact caller-configured canonical source loader and owner-local registration/presentation compile; 23 adopted baseline blobs unchanged.',evidenceRefs:[observationId]},
    {id:'report-adversarial-tests',status:'pass',message:'Seven source-only canonical/synthetic report tests pass, including uncertainty, scoped completion, distinct attempts, cancellations/replacements, page bounds and continuation.',evidenceRefs:[observationId]},
    {id:'production-sdk-transport',status:'fail',message:'Three required SDK tests fail at child startup CONNECTION_CLOSED with empty captured stderr. Exact cause unknown; Root same-source receipt required. This criterion is not passed by report tests or historical Root CON01 success.',evidenceRefs:[observationId]},
    {id:'readiness-and-preservation',status:'pass',message:'Immutable failure retained, heavy checks paused per CON-COORD-003, source-only Task has no native execution field; all operational/downstream holds retained.',evidenceRefs:[observationId]},
  ],inputHashes:[{path:relative(root,resultPath),sha256:resultHash}],runtime:{name:'Bun bounded source-only checks and external canonical local record APIs',version:Bun.version}}};
assert.equal(validateArtifact(verification).valid,true);
const verificationInput=input('CON-02-VERIFICATION-R1',{verification});assertRecord(verificationInput);
const verificationPath=resolve(work,'inputs/CON-02-VERIFICATION-R1.json');await fresh(verificationPath,verificationInput);
const verificationHash=sha(await readFile(verificationPath));
for(const record of [
  {...identity,kind:'evidence',id:observationId,evidenceKind:'observation',source:{kind:'snapshot',path:relative(root,resultPath),sha256:resultHash,fragment:'#/content'}},
  {...identity,kind:'evidence',id:verificationEvidenceId,evidenceKind:'verification',source:{kind:'snapshot',path:relative(root,verificationPath),sha256:verificationHash,fragment:'#/content/verification'}},
]){assertRecord(record);await fresh(resolve(work,`evidence/${encodeURIComponent(record.id)}.json`),record);}
task.state={...task.state,execution:'complete',verification:'failed',localAudit:'result-durable'};
task.verificationEvidenceIds=[verificationEvidenceId];
task.nextAction='ROOT_SDK_CHECK_NEEDED; READY_FOR_ROOT_SOURCE_CHECKPOINT. WAIT writer idle for Root exact same-source SDK receipt; missing transport scope not passed. No heavy retry, source activation or CON-03 admission. Shared/formal acceptance remains pending.';
assertRecord(task);assert.equal(task.executionEvidenceId,undefined);assert.equal(taskVerificationTarget(task),target);
for(const artifact of artifacts)assert.equal(sha(await readFile(resolve(root,artifact.path))),artifact.sha256);
assert.equal(sha(await readFile(checksPath)),sha(checksBytes));
await writeFile(taskPath,JSON.stringify(task,null,2)+'\n');
await fresh(resolve(arc,'observations/CON-02-LOCAL-RECORD-CHECK-R1.json'),{schema:'academy.consumer-con02-local-record-check.v1',createdAt:new Date().toISOString(),nativeThreadId:process.env.CODEX_THREAD_ID,
  commonPin,apis:['assertRecord','taskVerificationTarget','validateArtifact'],target,resultInputId:result.id,resultInputSha256:resultHash,verificationInputId:verificationInput.id,verificationInputSha256:verificationHash,
  observationEvidenceId:observationId,verificationEvidenceId,artifactCount:artifacts.length,allArtifactHashesMatch:true,exactResultHashBound:true,
  recordsValid:true,verificationArtifactSchemaValid:true,verificationDisposition:'failed: required SDK criterion not passed',taskState:task.state,
  originalCheckUnchanged:true,sourceOnlyTaskHasNoNativeExecutionField:true,heavyChecksPaused:true,writerIdle:true,
  committedSnapshot:'pending Root exact commit',committedTransition:'pending Root exact commit',nativeAdoption:false,formalAcceptance:false});
console.log(JSON.stringify({state:entry.state,target,resultInputId:result.id,resultHash,verificationInputId:verificationInput.id,verificationHash,artifactCount:artifacts.length,taskVerification:'failed',writerIdle:true}));
