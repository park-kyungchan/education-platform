import {expect,test} from 'bun:test';
import {nativeProposalTexts} from '../../src/academy/nativeCompleteness';
import {digest,known as legacyKnown} from '../../src/learning/model';
import {validateAcademyRecord,type AcademyRecord} from '../../src/academy/records';
import type {RecordVersion} from '../../src/academy/contracts/storageRecords';
import type {CatalogNode} from '../../src/academy/domain';
import type {TeacherPrerequisiteStore} from '../../src/academy/ports/teacherStore';
import {requestDigest,type NativeWriteResult,type OwnerAppendCommand,type LessonSessionRecord,type TemporalBinding,type ActivityScopeLink,type ObjectRef,type ReadAdmission,type DailyRecordDraftPayload} from '../../src/academy/contracts/prerequisiteRecords';
import {validateReceipt,computeReadHorizon} from '../../src/academy/nativePrerequisiteStore';
import {context,known,unknown,objectRef,progress,draft,assessment,instant,hash} from './nativePrerequisiteContracts.test';
import {foundation,admitted,type FictionalSql} from './nativePrerequisiteStore.test';
import {exactWorkFixture,exactAttemptFixture} from './learningWorkFixtures';
import {createNativeTypedRead,createSnapshotGrantVerifier,fullFieldMask} from '../../src/academy/nativeTypedRead';
import {ctx,nativeRef,request,testTemporal,testFunctionRequest,TEST_REGISTRY_SHA256} from './typedRead.test';
import {requireFixtureRefusal} from '../../harness/native_foundations_fixture';
import {prerequisiteRefusalStatus} from '../../src/academy/server';
import {approvalRefusalPrecedence} from '../../src/academy/contracts/prerequisiteRecords';

/** Real owner and native metadata store over the existing fictional driver.
 * The driver models a recoverable read error or an aborted transaction, never SQL effects. */
export async function r6OwnerFixture(phase:'late-binding'|'late-horizon'|'cleanup'|'cleanup-expiry',expire:boolean,change:'none'|'binding'|'policy'='none'){
 const f=await foundation(),secret='fictional-r6-owner-snapshot-secret';
 const temporal=testTemporal({classGroupRef:f.recordScope.classGroupRef,studentRef:f.recordScope.studentRef,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}});
 const service=createNativeTypedRead(f.store,ctx.ownerId,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:secret});
 const acquired=await service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'r6-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(temporal)});
 const input=request({temporalSelection:temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission});
 const state={leaseHeld:false,gateHeld:false,inOutput:false,callbackReady:false,sessionActive:true,triggered:false,aborted:false,transactions:0,commitKnown:false,ownerCalls:0,changes:0,changeError:null as string|null};
 let closedView:import('../../src/academy/ports/teacherStore').TeacherPrerequisiteReadStore|undefined;
 const refusalViews:import('../../src/academy/ports/teacherStore').TeacherPrerequisiteReadStore[]=[];
 f.sql.beforeQuery=async text=>{
  if(!state.inOutput)return;
  if(text==='SET TRANSACTION ISOLATION LEVEL READ COMMITTED'){
   state.transactions++;state.aborted=false;state.gateHeld=false;
   if(state.transactions===2&&change!=='none'){
    // The first gate has rolled back. A participating writer wins before
    // the cleanup gate is acquired; no intra-gate dependency drift is assumed.
    state.inOutput=false;
    try{
     if(change==='binding'){
      const command={...f.bind,context:context('r6-retire'),entityKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...f.bind.payload,state:'RETIRED' as const}};
      await admitted(f.store,'append:teacher',command,()=>f.store.appendTeacher(command));
     }else{
      const prior=(await f.store.temporalBindings(ctx.ownerId)).find(v=>v.payload.bindingKind==='TEACHING_ASSIGNMENT')!;
      const {bindingKey:_key,ownerId:_owner,...payload}=prior.payload;
      const command={context:context('r6-policy'),entityKey:prior.entityKey,expectedRevisionId:prior.revisionId,payload:{...payload,validTo:temporal.businessDate}};
      await admitted(f.store,'append:binding',command,()=>f.store.appendTemporalBinding(command));
     }
     state.changes++;
    }catch(error){state.changeError=error instanceof Error?error.message:String(error);throw error;}finally{state.inOutput=true;}
   }
  }
  if(text.includes('pg_advisory_xact_lock_shared')){expect(state.leaseHeld).toBe(true);state.gateHeld=true;}
  if(state.aborted)throw Error('fictional transaction remains aborted');
  if(phase==='cleanup-expiry'&&state.transactions===2&&text.includes('FROM academy.teacher_actor_index')){await Promise.resolve();if(expire)state.sessionActive=false;}
  const lateQuery=phase==='late-horizon'?text.includes('FROM academy.catalog_versions'):text.includes('FROM academy.teacher_actor_index');
  if(state.callbackReady&&!state.triggered&&lateQuery){
   expect(state.gateHeld&&state.leaseHeld).toBe(true);
   await Promise.resolve();state.triggered=true;if(expire&&phase!=='cleanup-expiry')state.sessionActive=false;
   if(phase.startsWith('cleanup'))state.aborted=true;
   throw Error('fictional awaited owner read failure');
  }
 };
 const commit=f.store.commitReadOutput.bind(f.store);
 f.store.commitReadOutput=async(admission,prepare,...selection)=>{
  state.ownerCalls++;state.inOutput=true;
  try{
   const result=await commit(admission,async view=>{
    const decision=await prepare(view);expect(decision.kind).toBe('OUTPUT_READY');
    closedView=view;state.callbackReady=true;return decision;
   },selection[0]?async(view,code)=>{refusalViews.push(view);return selection[0]!(view,code);}:undefined);
   state.commitKnown=true;return result;
  }finally{state.inOutput=false;state.gateHeld=false;}
 };
 return {...f,service,input,state,secret,refusalViews,closedView:()=>closedView};
}

/** Populate an invented preexisting retained family; every read still uses real validators/integrity. */
export function retained(sql:FictionalSql,entityId:string,payload:AcademyRecord):RecordVersion{validateAcademyRecord(payload);const body:Omit<RecordVersion,'integrityDigest'>={ownerId:context().ownerId,studentId:'student-a',entityId,sequence:1,revisionId:'synthetic-retained-'+entityId+'-r1',previousRevisionId:null,previousDigest:null,payload,contentDigest:digest(payload),sourceObservedAt:instant,recordedAt:instant,actorId:context().actorId,idempotencyKey:'synthetic-retained-'+entityId,commandDigest:digest({entityId,payload})};const v={...body,integrityDigest:digest(body)};sql.seed('record_versions',{owner_id:v.ownerId,student_id:v.studentId,entity_id:v.entityId,sequence:v.sequence,revision_id:v.revisionId,previous_revision_id:null,previous_digest:null,payload:v.payload,content_digest:v.contentDigest,integrity_digest:v.integrityDigest,source_observed_at:instant,recorded_at:instant,actor_id:v.actorId,idempotency_key:v.idempotencyKey,command_digest:v.commandDigest});sql.seed('record_heads',{owner_id:v.ownerId,student_id:v.studentId,entity_id:v.entityId,sequence:1,revision_id:v.revisionId,content_digest:v.contentDigest,last_verified_at:instant});return v;}
export async function scene(validity?:{validFrom:string;validTo:string|null}){const f=await foundation(validity,instant);const store:TeacherPrerequisiteStore=f.store;const owner=context().ownerId;
 const work=exactWorkFixture();work.sourceStudent=progress().sourceStudent;work.dueDate=legacyKnown('2026-10-25',['synthetic-native-due']);
 const ids=['book','major','middle','minor','section','page','problem-1','problem-2'];const nodes:CatalogNode[]=ids.map((id,i)=>({id,kind:({book:'book_edition',major:'major_unit',middle:'middle_unit',minor:'minor_unit',section:'learning_section',page:'printed_page','problem-1':'problem','problem-2':'problem'} as const)[id as typeof ids[number]]!,sourceKey:id==='book'?work.sourceBook:id.startsWith('problem-')?work.items[Number(id.slice(-1))-1]!.itemKey:{namespace:'synthetic_catalog',literalKey:id},label:'Invented '+id,parent:i===0?{state:'unknown',reason:'root'}:legacyKnown(i>=6?'page':ids[i-1]!,['synthetic-parent'])}));
 for(const node of nodes)f.sql.seed('catalog_versions',{owner_id:owner,node_id:node.id,sequence:1,revision_id:'fixture-catalog-'+node.id,recorded_at:instant,payload:node,content_digest:digest(node)});
 const priorLesson:OwnerAppendCommand<LessonSessionRecord>={context:context('prior-lesson'),entityKey:null,expectedRevisionId:null,payload:{kind:'lesson_session',classGroupRef:f.recordScope.classGroupRef,businessDate:'2026-10-23',occurrenceOrdinal:known(1),startsAt:known('2026-10-23T00:00:00.000Z'),endsAt:known('2026-10-23T01:00:00.000Z'),teacherRefs:known([f.ref('Teacher',f.teacher)]),participantRefs:known([f.recordScope.studentRef]),lessonState:known('HELD'),synthetic:true}};
 const previous=await admitted(store,'append:lesson',priorLesson,()=>store.appendLesson(priorLesson));const previousScope={...f.recordScope,businessDate:'2026-10-23',lessonRef:f.ref('LessonSession',previous)};
 const participation:OwnerAppendCommand<TemporalBinding>={context:context('prior-participation'),entityKey:null,expectedRevisionId:null,payload:{kind:'temporal_binding',bindingKind:'LESSON_PARTICIPATION',subjectRef:previousScope.lessonRef,targetRef:previousScope.studentRef,validFrom:'2026-01-01',validTo:null,sourceLiteral:'synthetic-native-participation',synthetic:true}};
 await admitted(store,'append:binding',participation,()=>store.appendTemporalBinding(participation));
 const registration=retained(f.sql,'registration',{kind:'source_book_registration',sourceStudent:work.sourceStudent,sourceCourse:work.sourceCourse,sourceUserCourse:work.sourceUserCourse,sourceBook:work.sourceBook,catalogNodeId:'book',sourceCourseLabel:'Invented course',sourceBookLabel:'Invented book',sourceStatus:'Invented active',sourceProgressLiteral:'Invented progress',sourceLearningRangeLiteral:'Invented range',assignmentValidity:{state:'unknown',reason:'not_qualified'},role:{state:'unknown',reason:'not_qualified'},contractRef:'synthetic',evidenceRefs:['synthetic']});work.registrationRevisionId=registration.revisionId;
 const original=retained(f.sql,'homework-origin',{...work,effectiveDate:'2026-10-23',dueDate:legacyKnown('2026-10-24',['synthetic-native-due'])});const current=retained(f.sql,'homework-current',{...work,effectiveDate:'2026-10-24',assignmentKey:{namespace:'synthetic_assignment',literalKey:'synthetic-current'}});const attempt=retained(f.sql,'attempt-current',{...exactAttemptFixture(),sourceStudent:work.sourceStudent,assignmentRevisionId:current.revisionId,occurredAt:legacyKnown(instant,['synthetic-native-occurrence'])});
 const attach=async(kind:ActivityScopeLink['activityKind'],ref:ActivityScopeLink['activityRef'],recordScope=f.recordScope)=>{const cmd:OwnerAppendCommand<ActivityScopeLink>={context:context('scope-'+ref.identity.nativeKey),entityKey:null,expectedRevisionId:null,payload:{kind:'activity_scope',activityKind:kind,activityRef:ref,recordScope,sourceLiteral:'synthetic-explicit-scope',synthetic:true}};return admitted(store,'append:scope',cmd,()=>store.appendActivityScope(cmd));};
 const originalRef=objectRef('HomeworkAssignment',original.entityId,original.revisionId),homeworkRef=objectRef('HomeworkAssignment',current.entityId,current.revisionId),attemptRef=objectRef('DailyTestAttempt',attempt.entityId,attempt.revisionId);
 await attach('HOMEWORK_ASSIGNMENT',originalRef,previousScope);await attach('HOMEWORK_ASSIGNMENT',homeworkRef);await attach('DAILY_TEST_ATTEMPT',attemptRef);
 const p={...progress(),recordScope:f.recordScope,contentScope:{...progress().contentScope,editionRef:objectRef('TextbookEdition','book','fixture-catalog-book'),unitRef:objectRef('Unit','minor','fixture-catalog-minor'),sectionRefs:known([objectRef('Section','section','fixture-catalog-section')])}};
 const pc={context:context('create-progress'),studentId:'student-a',payload:p};const progressResult=await admitted(store,'createProgress',pc,()=>store.createProgress(pc));const progressRef=f.ref('DailyProgress',progressResult);await attach('DAILY_PROGRESS',progressRef);
 const a={...assessment(),assessmentScope:f.recordScope,homeworkRef:originalRef,evidenceRefs:[originalRef.revision],assessedBy:known(f.ref('Teacher',f.teacher)),assessedAt:known(instant)};const ac={context:context('create-assessment'),studentId:'student-a',payload:a};const assessmentResult=await admitted(store,'createAssessment',ac,()=>store.createAssessment(ac));const assessmentRef=f.ref('PreviousHomeworkAssessment',assessmentResult);await attach('PREVIOUS_HOMEWORK_ASSESSMENT',assessmentRef);
 const scoreCommand={context:context('record-explicit-score'),entityKey:null,expectedRevisionId:null,payload:{kind:'native_score_evidence' as const,attemptRef,assignmentRef:homeworkRef,recordScope:f.recordScope,scale:{family:'daily_test_attempt' as const,version:'1.0.0' as const,kind:'OWNER_RECORDED_NUMERIC_SCORE' as const},score:{earned:3,maximum:7},recordedBy:f.ref('Teacher',f.teacher),measurementLiteral:'Invented explicit 3/7 measurement; item grades carry no numeric scale',synthetic:true}};
 const scoreResult=await admitted(store,'appendScoreEvidence',scoreCommand,()=>store.appendScoreEvidence(scoreCommand));
 const proposalSources={progress:[{ref:progressRef,payload:p}],homework:[{ref:homeworkRef,payload:current.payload}],attempts:[{ref:attemptRef,payload:{attempt:attempt.payload,scoreEvidence:{revision:scoreResult.revisionId,payload:scoreCommand.payload}}}],previousAssessments:[{ref:assessmentRef,payload:a}]};
 const texts=nativeProposalTexts(proposalSources),proposalEvidence=(rows:{ref:ObjectRef}[])=>rows.map(({ref})=>({sourceRef:{...context().scopeRef,objectTypeId:ref.identity.objectType,objectTypeVersion:ref.identity.objectType==='Section'?'1.1.0':'1.0.0',objectKey:ref.identity.nativeKey},sourceRevision:ref.revision,locator:'NATIVE_SOURCE_RENDERING_V1',observedAt:instant}));
 const d:DailyRecordDraftPayload={...draft(),recordScope:f.recordScope,progressRefs:known([progressRef]),homeworkRefs:known([homeworkRef]),attemptRefs:known([attemptRef]),previousAssessmentRefs:known([assessmentRef]),responsibleTeacherRef:known(f.ref('Teacher',f.teacher)),progressText:{state:'known',value:texts.progressText,evidence:proposalEvidence(proposalSources.progress)},homeworkText:{state:'known',value:texts.homeworkText,evidence:proposalEvidence([...proposalSources.homework,...proposalSources.previousAssessments])},noteText:{state:'known',value:texts.noteText,evidence:proposalEvidence(proposalSources.attempts)}};
 const read:ReadAdmission={ownerId:owner,actorId:context().actorId,requestId:'synthetic-source-read',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};
 await store.admitReadOccurrence(read);await store.readSnapshot(async view=>{expect(await view.activityScopes(owner,{})).toHaveLength(5);});await store.finalizeReadOccurrence({request:read,status:'COMPLETED',snapshotDigest:digest(d.sourceSnapshot),refusalCode:null});
 const dc={context:context('create-draft'),studentId:'student-a',payload:d};const draftResult=await admitted(store,'createDraft',dc,()=>store.createDraft(dc));const draftRef=f.ref('DailyRecordDraft',draftResult);
 return {...f,store,attach,pc,ac,dc,progressResult,assessmentResult,draftResult,draftRef,previous,previousScope,original,current,attempt,registration,scoreResult,scoreCommand,proposalSources};}

test('declared port exposes current pins and the write-side output committer outside the frozen view',async()=>{const f=await foundation();const owner=context().ownerId;expect(await f.store.readSnapshot(view=>view.currentCatalogPins(owner))).toEqual([]);expect(typeof f.store.commitReadOutput).toBe('function');const read:ReadAdmission={ownerId:owner,actorId:context().actorId,requestId:'synthetic-port-output',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};await f.store.admitReadOccurrence(read);const out=await f.store.commitReadOutput(read,async view=>{expect('commitReadOutput' in view).toBe(false);return {kind:'OUTPUT_REFUSED',code:'synthetic_denied'};});expect(out.outputAdmissionId).toBe(read.requestId);expect(out.terminalStatus).toBe('REFUSED');expect(out.value).toBeNull();});
test('SC4 score-head drift refuses at the gate; an unchanged score head completes',async()=>{
 const f=await scene();const owner=context().ownerId;const attemptRef=f.scoreCommand.payload.attemptRef;
 const horizon=await f.store.readSnapshot(view=>computeReadHorizon(view,owner,context().actorId,f.recordScope.businessDate,[attemptRef]));
 const okRead:ReadAdmission={ownerId:owner,actorId:context().actorId,requestId:'sc4-port-score-ok',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};
 await f.store.admitReadOccurrence(okRead);
 expect(await f.store.commitReadOutput(okRead,async()=>({kind:'OUTPUT_READY',value:{items:['sc4-score-page']},horizon}))).toMatchObject({value:{items:['sc4-score-page']},terminalStatus:'COMPLETED'});
 const fix={...f.scoreCommand,context:context('sc4-port-score-fix'),entityKey:f.scoreResult.identity.nativeKey,expectedRevisionId:f.scoreResult.revisionId,payload:{...f.scoreCommand.payload,score:{earned:4,maximum:7},measurementLiteral:'Invented gate-drift measurement'}};
 await admitted(f.store,'appendScoreEvidence',fix,()=>f.store.appendScoreEvidence(fix));
 const driftRead:ReadAdmission={...okRead,requestId:'sc4-port-score-drift'};
 await f.store.admitReadOccurrence(driftRead);
 expect(await f.store.commitReadOutput(driftRead,async()=>({kind:'OUTPUT_READY',value:{items:['stale-score-page']},horizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await f.store.readOccurrenceLookup(driftRead)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift',snapshotDigest:null});
});
test('a facade typed only to the declared port creates, corrects and reads all native student kinds through real history',async()=>{const f=await scene();for(const r of [f.progressResult,f.assessmentResult,f.draftResult]){validateReceipt(r.receipt);const history=await f.store.history(context().ownerId,'student-a',r.identity.nativeKey);expect(history[0]?.revisionId).toBe(r.revisionId);expect(history).toHaveLength(1);validateAcademyRecord(history[0]!.payload);}

 const duplicate={...f.dc,context:context('duplicate-current-draft')};await expect(admitted(f.store,'createDraft',duplicate,()=>f.store.createDraft(duplicate))).rejects.toThrow('duplicate_current_draft');
 const draftCorrection={context:context('correct-draft'),studentId:'student-a',entityId:f.draftResult.identity.nativeKey,expectedRevisionId:f.draftResult.revisionId,payload:{...f.dc.payload,noteText:known('Invented corrected proposal')}};const correctedDraft=await admitted(f.store,'correctPrerequisiteRecord',draftCorrection,()=>f.store.correctPrerequisiteRecord(draftCorrection));expect(correctedDraft.sequence).toBe(2);
 const assessmentCorrection={context:context('correct-assessment'),studentId:'student-a',entityId:f.assessmentResult.identity.nativeKey,expectedRevisionId:f.assessmentResult.revisionId,payload:{...f.ac.payload,note:known('Invented corrected assessment')}};const correctedAssessment=await admitted(f.store,'correctPrerequisiteRecord',assessmentCorrection,()=>f.store.correctPrerequisiteRecord(assessmentCorrection));expect(correctedAssessment.sequence).toBe(2);
 const ac2={...f.ac,context:context('distinct-assessment')};const second=await admitted(f.store,'createAssessment',ac2,()=>f.store.createAssessment(ac2));expect(second.identity.nativeKey).not.toBe(f.assessmentResult.identity.nativeKey);expect(second.revisionId).not.toBe(f.assessmentResult.revisionId);expect(second.contentDigest).toBe(f.assessmentResult.contentDigest);const replay=await f.store.createAssessment(ac2);expect(replay.identity).toEqual(second.identity);expect(replay.receipt).toEqual(second.receipt);
 const correct={context:context('correct-progress'),studentId:'student-a',entityId:f.progressResult.identity.nativeKey,expectedRevisionId:f.progressResult.revisionId,payload:{...f.pc.payload,progressState:known('COMPLETED' as const)}};const corrected=await admitted(f.store,'correctPrerequisiteRecord',correct,()=>f.store.correctPrerequisiteRecord(correct));expect(corrected.sequence).toBe(2);expect((await f.store.history(context().ownerId,'student-a',corrected.identity.nativeKey))).toHaveLength(2);
 const dup={...f.dc,context:context('duplicate-draft')};await expect(admitted(f.store,'createDraft',dup,()=>f.store.createDraft(dup))).rejects.toThrow('stale_source_revision');
});
test('native issuer -> revoke/refuse -> new issuer -> atomic consume returns full immutable receipt and exact read-only lost-ack lookup',async()=>{const f=await scene();const consumeContext=context('consume-approved');const originalClosure=await f.store.readSnapshot(view=>view.approvalClosurePreview(consumeContext,f.draftRef));expect(originalClosure.linkExpectations.length).toBeGreaterThan(3);const issue={context:context('issue-first'),draftRef:f.draftRef,closure:originalClosure,validForSeconds:900};await f.store.admitCommand({context:issue.context,requestDigest:requestDigest('issueApproval',issue)});const first=await f.store.issueApproval(issue);expect(first.payload.state).toBe('ISSUED');const revoke={context:context('revoke-first'),approvalId:first.approvalId,expectedRevisionId:first.result.revisionId};await admitted(f.store,'revokeApproval',revoke,()=>f.store.revokeApproval(revoke));const consumeRevoked={context:consumeContext,draftRef:f.draftRef,approvalProofHandle:first.proofHandle};await f.store.admitCommand({context:consumeContext,requestDigest:requestDigest('consumeApprovalAndApproveDraft',consumeRevoked)});await expect(f.store.consumeApprovalAndApproveDraft(consumeRevoked)).rejects.toThrow('approval_revoked');
 const secondContext=context('consume-second');const closure=await f.store.readSnapshot(view=>view.approvalClosurePreview(secondContext,f.draftRef));const next={...issue,context:context('issue-second'),closure};await f.store.admitCommand({context:next.context,requestDigest:requestDigest('issueApproval',next)});const approval=await f.store.issueApproval(next);const consume={context:secondContext,draftRef:f.draftRef,approvalProofHandle:approval.proofHandle};const request=await f.store.admitCommand({context:secondContext,requestDigest:requestDigest('consumeApprovalAndApproveDraft',consume)});const result=await f.store.consumeApprovalAndApproveDraft(consume);validateReceipt(result.receipt);expect(result.receipt.changed).toHaveLength(2);expect(result.receipt.approvalId).toBe(approval.approvalId);expect(result.receipt.occurrenceId).toBe(secondContext.occurrenceId);expect((await f.store.approvalCurrent(secondContext.ownerId,approval.approvalId))?.payload.state).toBe('CONSUMED');const h=await f.store.history(secondContext.ownerId,'student-a',result.identity.nativeKey);expect(h[1]?.payload.kind==='daily_record_draft'&&h[1].payload.draftState.state==='known'&&h[1].payload.draftState.value).toBe('APPROVED');const before=f.sql.state(),looked=await f.store.commandOutcomeLookup(request);expect(looked.status==='COMMITTED'&&looked.result.receipt).toEqual(result.receipt);expect(f.sql.state()).toBe(before);expect(await f.store.issueApproval(next)).toMatchObject({payload:approval.payload,result:{status:'replay'}});
});
test('link-only revision changes preserve object pins yet invalidate a real store-issued proof without moving draft/approval heads',async()=>{const f=await scene();const target=context('consume-link-change'),closure=await f.store.readSnapshot(view=>view.approvalClosurePreview(target,f.draftRef));const issue={context:context('issue-before-link-change'),draftRef:f.draftRef,closure,validForSeconds:900};await f.store.admitCommand({context:issue.context,requestDigest:requestDigest('issueApproval',issue)});const proof=await f.store.issueApproval(issue);const binding=(await f.store.temporalBindings(target.ownerId)).find(x=>x.payload.bindingKind==='TEACHING_ASSIGNMENT')!;const {bindingKey,ownerId,...payload}=binding.payload;const change:OwnerAppendCommand<TemporalBinding>={context:context('change-link-only'),entityKey:binding.entityKey,expectedRevisionId:binding.revisionId,payload:{...payload,sourceLiteral:'synthetic-corrected-link-evidence'}};await admitted(f.store,'append:binding',change,()=>f.store.appendTemporalBinding(change));const beforeDraft=await f.store.history(target.ownerId,'student-a',f.draftRef.identity.nativeKey),beforeApproval=await f.store.approvalCurrent(target.ownerId,proof.approvalId);const consume={context:target,draftRef:f.draftRef,approvalProofHandle:proof.proofHandle};await f.store.admitCommand({context:target,requestDigest:requestDigest('consumeApprovalAndApproveDraft',consume)});await expect(f.store.consumeApprovalAndApproveDraft(consume)).rejects.toThrow('approval_closure_mismatch');expect(await f.store.history(target.ownerId,'student-a',f.draftRef.identity.nativeKey)).toEqual(beforeDraft);expect(await f.store.approvalCurrent(target.ownerId,proof.approvalId)).toEqual(beforeApproval);});

test('REFUSAL-ORACLE actual cited progress correction has the exact native negative-consume refusal',async()=>{
 const f=await scene(),target=context('oracle-consume-progress-change');
 const closure=await f.store.approvalClosurePreview(target,f.draftRef);
 const issue={context:context('oracle-issue-progress-change'),draftRef:f.draftRef,closure,validForSeconds:900};
 await f.store.admitCommand({context:issue.context,requestDigest:requestDigest('issueApproval',issue)});
 const proof=await f.store.issueApproval(issue);
 const change={context:context('oracle-correct-cited-progress'),studentId:'student-a',entityId:f.progressResult.identity.nativeKey,expectedRevisionId:f.progressResult.revisionId,payload:{...f.pc.payload,note:known('Invented correction after explicit approval')}};
 await admitted(f.store,'correctPrerequisiteRecord',change,()=>f.store.correctPrerequisiteRecord(change));
 const beforeDraft=await f.store.history(target.ownerId,'student-a',f.draftRef.identity.nativeKey),beforeApproval=await f.store.approvalCurrent(target.ownerId,proof.approvalId);
 const consume={context:target,draftRef:f.draftRef,approvalProofHandle:proof.proofHandle};let code:string|null=null;
 try{await admitted(f.store,'consumeApprovalAndApproveDraft',consume,()=>f.store.consumeApprovalAndApproveDraft(consume));}catch(error){code=error instanceof Error?error.message:null;}
 // Independent normative expectation: selected prerequisite contract v5,
 // referenceRules.objectRef:304 and DailyRecordDraft invariant:631.
 expect(code).toBe('stale_source_revision');
 expect(approvalRefusalPrecedence.SOURCE_REVISION.priority).toBeLessThan(approvalRefusalPrecedence.CLOSURE_EQUALITY.priority);
 expect(code).toBe(approvalRefusalPrecedence.SOURCE_REVISION.code);
 expect(prerequisiteRefusalStatus(code!)).toBe(approvalRefusalPrecedence.SOURCE_REVISION.status);
 for(const row of Object.values(approvalRefusalPrecedence))expect(prerequisiteRefusalStatus(row.code)).toBe(row.status);
 expect(()=>requireFixtureRefusal('negative-approval-consume',prerequisiteRefusalStatus(code!),code)).not.toThrow();
 expect(await f.store.history(target.ownerId,'student-a',f.draftRef.identity.nativeKey)).toEqual(beforeDraft);
 expect(await f.store.approvalCurrent(target.ownerId,proof.approvalId)).toEqual(beforeApproval);
});

for(const selector of ['EXACT','REGISTERED'] as const)for(const missingHistory of [false,true])test('STUDENT-HISTORY full source closure '+selector+' '+(missingHistory?'denies missing original':'preserves original endpoints after a new head'),async()=>{
 const f=await scene(),owner=context().ownerId;
 expect((await f.store.current(owner,'student-a')).some(row=>row.payload.kind==='learning_work_assignment')).toBe(true);
 expect((await f.store.current(owner,'student-a')).some(row=>row.payload.kind==='learning_work_attempt')).toBe(true);
 const original=await f.store.studentRevisionCurrent(owner,'student-a');expect(original).not.toBeNull();
 const change={context:context('whole-plan-student-head'),studentId:'student-a',expectedRevisionId:original!.revisionId,payload:{...original!.payload,displayName:known('Invented current Student revision')}};
 const updated=await admitted(f.store,'append:student',change,()=>f.store.appendStudentRevision(change));
 const oldScope=structuredClone((await f.store.activityScopes(owner,{}))[0]!.payload.recordScope);
 if(missingHistory){const rows=f.sql.rows('student_record_versions'),index=rows.findIndex(row=>row.revision_id===original!.revisionId);expect(index).toBeGreaterThanOrEqual(0);rows.splice(index,1);}
 const temporal=testTemporal({studentRef:f.ref('Student',updated),classGroupRef:f.recordScope.classGroupRef,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}});
 const intent=testFunctionRequest(temporal,1,[temporal.studentRef!,temporal.classGroupRef,...(temporal.occurrence.mode==='EXACT'?[temporal.occurrence.lessonRef]:[])]);
 const service=createNativeTypedRead(f.store,owner,{processEpoch:'whole-plan-student',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'fictional-whole-plan-student-secret',now:()=>Date.parse(f.sql.now)});
 const acquired=await service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'whole-plan-student-acquire',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent:intent});
 const input=request({...(selector==='EXACT'?{selector:{kind:'EXACT_OBJECT' as const,objectRef:temporal.studentRef!}}:{}),fieldMask:fullFieldMask(['Student']),linkMask:[],pageSize:1,temporalSelection:temporal,expectedRevisions:intent.expectedRevisions,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission});
 if(missingHistory)await expect(service.typedRead(ctx,input)).rejects.toMatchObject({code:'PERMISSION_DENIED',httpStatus:403});
 else{const result=await service.typedRead(ctx,input);expect(result.items).toHaveLength(1);expect(result.items[0]).toMatchObject({kind:'OBJECT',record:{identity:{objectType:'Student'},revision:updated.revisionId}});}
 expect((await f.store.activityScopes(owner,{}))[0]!.payload.recordScope).toEqual(oldScope);
 expect(oldScope.studentRef.revision).toBe(original!.revisionId);
});


// Native-read v5: current denial wins, otherwise an old grant/reference is
// stale409. Authority must use current store evidence, not the old caller ref.
for(const selector of ['EXACT','REGISTERED'] as const)for(const authority of ['CURRENT','RETIRED_TEACHER','CLOSED_MEMBERSHIP','CLOSED_PARTICIPATION'] as const)
 test('STUDENT-HISTORY old grant current-rights precedence '+selector+' '+authority,async()=>{
  const f=await scene(),owner=context().ownerId,original=(await f.store.studentRevisionCurrent(owner,'student-a'))!;
  const temporal=testTemporal({studentRef:{identity:{scopeRef:original.scopeRef,namespace:original.namespace,objectType:'Student',nativeKey:original.entityKey},revision:original.revisionId},classGroupRef:f.recordScope.classGroupRef,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}});
  const intent=testFunctionRequest(temporal,1,[temporal.studentRef!,temporal.classGroupRef,...(temporal.occurrence.mode==='EXACT'?[temporal.occurrence.lessonRef]:[])]);
  const service=createNativeTypedRead(f.store,owner,{processEpoch:'history-old-grant',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'fictional-history-old-grant-secret',now:()=>Date.parse(f.sql.now)});
  const acquired=await service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'history-old-grant-acquire',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent:intent});
  const change={context:context('history-old-grant-new-head'),studentId:'student-a',expectedRevisionId:original.revisionId,payload:{...original.payload,displayName:known('Invented new Student head')}};
  const updated=await admitted(f.store,'append:student',change,()=>f.store.appendStudentRevision(change));
  if(authority==='RETIRED_TEACHER'){
   const current=(await f.store.teacherBindingByActor(owner,ctx.actorId))!;
   const change={...f.bind,context:context('history-old-grant-retire-teacher'),entityKey:current.entityKey,expectedRevisionId:current.revisionId,payload:{...f.bind.payload,state:'RETIRED' as const}};
   await admitted(f.store,'append:teacher',change,()=>f.store.appendTeacher(change));
  }else if(authority!=='CURRENT'){
   const kind=authority==='CLOSED_MEMBERSHIP'?'CLASS_MEMBERSHIP':'LESSON_PARTICIPATION';
   const current=(await f.store.temporalBindings(owner)).find(v=>v.payload.bindingKind===kind)!;
   const {ownerId:_owner,bindingKey:_key,...payload}=current.payload;
   const change={context:context('history-old-grant-close-'+kind),entityKey:current.entityKey,expectedRevisionId:current.revisionId,payload:{...payload,...(kind==='CLASS_MEMBERSHIP'?{subjectRef:f.ref('Student',updated)}:{targetRef:f.ref('Student',updated)}),validFrom:'2026-01-01',validTo:f.recordScope.businessDate}};
   await admitted(f.store,'append:binding',change,()=>f.store.appendTemporalBinding(change));
  }
  const input=request({...(selector==='EXACT'?{selector:{kind:'EXACT_OBJECT' as const,objectRef:temporal.studentRef!}}:{}),fieldMask:fullFieldMask(['Student']),linkMask:[],pageSize:1,temporalSelection:temporal,expectedRevisions:intent.expectedRevisions,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission});
  const output=await service.typedReadBuffered(ctx,input,()=>true),body=JSON.parse(new TextDecoder().decode(output.body!));
  expect(output.status).toBe(authority==='CURRENT'?409:403);
  expect(authority==='CURRENT'?['REVISION_STALE','OBJECTSET_CURSOR_STALE']:['PERMISSION_DENIED']).toContain(body.error.code);
  for(const field of ['items','nextCursor','gaps'])expect(Object.hasOwn(body,field)).toBe(false);
 });

test('AUTH-T4 a real owner refuses a fresh grant after dated teaching closes',async()=>{
 const f=await scene(),temporal=testTemporal({classGroupRef:f.recordScope.classGroupRef,studentRef:f.recordScope.studentRef,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}});
 const service=createNativeTypedRead(f.store,ctx.ownerId,{processEpoch:'auth-real',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'invented-auth-real-secret',now:()=>Date.parse(instant)});
 const input={schema:'native-read-acquire.v2' as const,consumerProfile:'CURRENT_1_1' as const,requestId:'auth-real-before',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE' as const,time:{mode:'CURRENT' as const},functionIntent:testFunctionRequest(temporal)};
 const grant=await service.acquireSnapshot(ctx,input);
 const edge=(await f.store.temporalBindings(ctx.ownerId)).find(v=>v.payload.bindingKind==='TEACHING_ASSIGNMENT')!;
 const {ownerId:_owner,bindingKey:_key,...payload}=edge.payload;
 const close={context:context('auth-real-close'),entityKey:edge.entityKey,expectedRevisionId:edge.revisionId,payload:{...payload,validTo:f.recordScope.businessDate}};
 await admitted(f.store,'append:binding',close,()=>f.store.appendTemporalBinding(close));
 await expect(service.acquireSnapshot(ctx,{...input,requestId:'auth-real-after'})).rejects.toMatchObject({code:'PERMISSION_DENIED',httpStatus:403});
 const out=await service.typedReadBuffered(ctx,request({requestId:'auth-real-existing-grant',temporalSelection:temporal,snapshot:grant.snapshot,asOf:grant.snapshot.asOf,snapshotAdmission:grant.snapshotAdmission,selector:{kind:'EXACT_OBJECT',objectRef:f.draftRef}}),()=>true);
 expect(out.status).toBe(403);expect(new TextDecoder().decode(out.body!)).not.toContain('Synthetic note');
 expect(f.sql.rows('read_occurrences').find(row=>row.request_id==='auth-real-existing-grant')?.status).toBe('REFUSED');
});

test('DRAFT-REV same teacher revision refresh preserves draft identity and current validation',async()=>{
 const f=await foundation();
 const payload={...draft(),recordScope:f.recordScope,responsibleTeacherRef:known(f.ref('Teacher',f.teacher)),progressRefs:unknown<ObjectRef[]>(),homeworkRefs:unknown<ObjectRef[]>(),attemptRefs:unknown<ObjectRef[]>(),previousAssessmentRefs:unknown<ObjectRef[]>()};
 const create={context:context('draft-rev-create'),studentId:'student-a',payload};
 const saved=await admitted(f.store,'createDraft',create,()=>f.store.createDraft(create));
 const update={...f.bind,context:context('draft-rev-teacher'),entityKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...f.bind.payload,displayName:known('Invented corrected teacher label')}};
 const teacher=await admitted(f.store,'append:teacher',update,()=>f.store.appendTeacher(update));
 const correction={context:context('draft-rev-correct'),studentId:'student-a',entityId:saved.identity.nativeKey,expectedRevisionId:saved.revisionId,payload:{...payload,responsibleTeacherRef:known(f.ref('Teacher',teacher))}};
 const corrected=await admitted(f.store,'correctPrerequisiteRecord',correction,()=>f.store.correctPrerequisiteRecord(correction));
 expect(corrected.identity.nativeKey).toBe(saved.identity.nativeKey);expect(corrected.revisionId).not.toBe(saved.revisionId);
 const old={...correction,context:context('draft-rev-old'),expectedRevisionId:corrected.revisionId,payload};
 await expect(admitted(f.store,'correctPrerequisiteRecord',old,()=>f.store.correctPrerequisiteRecord(old))).rejects.toThrow('teacher_attribution_conflict');
 expect(await f.store.history(ctx.ownerId,'student-a',saved.identity.nativeKey)).toHaveLength(2);
});


test('REALM-ACQUIRE the actual owner refuses caller outer scope while native class refs remain genuine',async()=>{
 const f=await scene(),scope=structuredClone(nativeRef());scope.basis.scope.scopeKey='invented-unowned-scope';
 const temporal=testTemporal({classGroupRef:f.recordScope.classGroupRef,studentRef:f.recordScope.studentRef,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}});
 const service=createNativeTypedRead(f.store,ctx.ownerId,{processEpoch:'realm-input',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'invented-realm-secret',now:()=>Date.parse(instant)});
 const good={schema:'native-read-acquire.v2' as const,consumerProfile:'CURRENT_1_1' as const,requestId:'realm-good',scopeRef:nativeRef(),consistency:'SNAPSHOT' as const,time:{mode:'CURRENT' as const},functionIntent:testFunctionRequest(temporal)};
 expect((await service.acquireSnapshot(ctx,good)).snapshotAdmission.grantId).toBeTruthy();
 await expect(service.acquireSnapshot(ctx,{...good,requestId:'realm-bad',scopeRef:scope,functionIntent:{...good.functionIntent,scopeRef:scope}})).rejects.toMatchObject({code:'PERMISSION_DENIED',httpStatus:403});
});
for(const mismatch of ['project','owner'] as const)test('DRAFT-TEACHER-SCOPE rejects a same-key/revision Teacher from another '+mismatch,async()=>{
 const f=await foundation(),ref=structuredClone(f.ref('Teacher',f.teacher));
 if(mismatch==='project')ref.identity.scopeRef.basis.scope.projectKey='invented-other-project';
 else{ref.identity.scopeRef.basis.scope.ownerNamespace='invented-other-owner';ref.identity.scopeRef.basis.source.ownerNamespace='invented-other-owner';}
 const payload={...draft(),recordScope:f.recordScope,responsibleTeacherRef:known(ref),progressRefs:unknown<ObjectRef[]>(),homeworkRefs:unknown<ObjectRef[]>(),attemptRefs:unknown<ObjectRef[]>(),previousAssessmentRefs:unknown<ObjectRef[]>()};
 const c={context:context('draft-teacher-'+mismatch),studentId:'student-a',payload},before=f.sql.rows('record_versions').length;
 await expect(admitted(f.store,'createDraft',c,()=>f.store.createDraft(c))).rejects.toThrow('scope_conflict');expect(f.sql.rows('record_versions')).toHaveLength(before);
});
test('RETARGET-SUCCESSOR actual owner accepts attachment-governed scope with score and complete draft',async()=>{
 const f=await scene(),owner=context().ownerId;
 expect((await f.store.approvalClosurePreview(context('retarget-before'),f.draftRef)).targets).toHaveLength(1);
 const lessonRow=(await f.store.lessons(owner)).find(v=>v.entityKey===f.recordScope.lessonRef.identity.nativeKey)!;
 const {ownerId:_owner,lessonKey:_key,...prior}=lessonRow.payload;
 const lc={context:context('retarget-new-lesson'),entityKey:null,expectedRevisionId:null,payload:{...prior,occurrenceOrdinal:known(2),startsAt:known('2026-10-24T01:00:00.000Z'),endsAt:known('2026-10-24T02:00:00.000Z')}};
 const lesson=await admitted(f.store,'append:lesson',lc,()=>f.store.appendLesson(lc));
 const scope={...f.recordScope,lessonRef:f.ref('LessonSession',lesson)};
 const pc={context:context('retarget-participation'),entityKey:null,expectedRevisionId:null,payload:{kind:'temporal_binding' as const,bindingKind:'LESSON_PARTICIPATION' as const,subjectRef:scope.lessonRef,targetRef:scope.studentRef,validFrom:'2026-01-01',validTo:null,sourceLiteral:'Invented explicit retarget participation',synthetic:true}};
 await admitted(f.store,'append:binding',pc,()=>f.store.appendTemporalBinding(pc));
 const links=(await f.store.activityScopes(owner,{})).filter(v=>v.payload.recordScope.lessonRef.identity.nativeKey===f.recordScope.lessonRef.identity.nativeKey);
 expect(links).toHaveLength(4);
 for(const link of links){
  const {ownerId:_owner,scopeKey:_key,...payload}=link.payload;
  const fix={context:context('retarget-'+link.entityKey),entityKey:link.entityKey,expectedRevisionId:link.revisionId,payload:{...payload,recordScope:scope}};
  await admitted(f.store,'append:scope',fix,()=>f.store.appendActivityScope(fix));
 }
 const score={...f.scoreCommand,context:context('retarget-score'),entityKey:f.scoreResult.identity.nativeKey,expectedRevisionId:f.scoreResult.revisionId,payload:{...f.scoreCommand.payload,recordScope:scope}};
 const scoreResult=await admitted(f.store,'appendScoreEvidence',score,()=>f.store.appendScoreEvidence(score));
 const sources={...f.proposalSources,attempts:f.proposalSources.attempts.map(row=>({...row,payload:{...row.payload,scoreEvidence:{revision:scoreResult.revisionId,payload:score.payload}}}))};
 const texts=nativeProposalTexts(sources);
 const create={...f.dc,context:context('retarget-draft'),payload:{...f.dc.payload,recordScope:scope,progressText:{...f.dc.payload.progressText,value:texts.progressText},homeworkText:{...f.dc.payload.homeworkText,value:texts.homeworkText},noteText:{...f.dc.payload.noteText,value:texts.noteText}}};
 const saved=await admitted(f.store,'createDraft',create,()=>f.store.createDraft(create));
 const ref=f.ref('DailyRecordDraft',saved);
 const oldFix={context:context('retarget-old-lesson-metadata'),entityKey:lessonRow.entityKey,expectedRevisionId:lessonRow.revisionId,payload:{...prior,occurrenceOrdinal:known(3)}};
 await admitted(f.store,'append:lesson',oldFix,()=>f.store.appendLesson(oldFix));
 const temporal=testTemporal({classGroupRef:scope.classGroupRef,studentRef:scope.studentRef,occurrence:{mode:'EXACT',lessonRef:scope.lessonRef}});
 const reader=createNativeTypedRead(f.store,owner,{processEpoch:'retarget-current',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'invented-retarget-read-secret',now:()=>Date.parse(instant)});
 const acquired=await reader.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'retarget-current-acquire',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(temporal)});
 const page=await reader.typedRead(ctx,request({temporalSelection:temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission,selector:{kind:'EXACT_OBJECT',objectRef:f.ref('DailyProgress',f.progressResult)},fieldMask:fullFieldMask(['DailyProgress']),linkMask:[]}));
 expect(page.items.filter(item=>item.kind==='OBJECT')).toHaveLength(1);
 const closure=await f.store.approvalClosurePreview(context('retarget-after'),ref);
 expect(closure.targets).toHaveLength(1);expect(closure.targets[0]!.expected.value).toBe(ref.revision);
 const progress=(await f.store.history(owner,'student-a',f.progressResult.identity.nativeKey))[0]!;
 expect(progress.payload.kind).toBe('daily_progress');
 if(progress.payload.kind==='daily_progress')expect(progress.payload.recordScope.lessonRef).toEqual(f.recordScope.lessonRef);
 expect(closure.dependencies.some(v=>v.ref.objectKey===scope.lessonRef.identity.nativeKey)).toBe(true);
 const cited=(await f.store.lessons(owner)).find(row=>row.entityKey===f.previous.identity.nativeKey)!;
 const {ownerId:_citedOwner,lessonKey:_citedKey,...citedPayload}=cited.payload;
 const citedFix={context:context('retarget-cited-lesson-metadata'),entityKey:cited.entityKey,expectedRevisionId:cited.revisionId,payload:{...citedPayload,occurrenceOrdinal:known(4)}};
 await admitted(f.store,'append:lesson',citedFix,()=>f.store.appendLesson(citedFix));
 await expect(f.store.approvalClosurePreview(context('retarget-cited-after'),ref)).rejects.toThrow('stale_source_revision');
});


test('REALM-ALIAS acquisition seals the validated intent before awaiting the native owner',async()=>{
 const f=await scene(),temporal=testTemporal({classGroupRef:f.recordScope.classGroupRef,studentRef:f.recordScope.studentRef,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}}),secret='invented-realm-alias-secret';
 const service=createNativeTypedRead(f.store,ctx.ownerId,{processEpoch:'realm-alias',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:secret,now:()=>Date.parse(instant)});
 const input={schema:'native-read-acquire.v2' as const,consumerProfile:'CURRENT_1_1' as const,requestId:'realm-alias-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT' as const,time:{mode:'CURRENT' as const},functionIntent:testFunctionRequest(temporal)},read=f.store.readSnapshot.bind(f.store);
 f.store.readSnapshot=async callback=>{input.scopeRef.basis.scope.scopeKey='invented-late-scope';input.functionIntent.scopeRef.basis.scope.scopeKey='invented-late-scope';return read(callback);};
 const acquired=await service.acquireSnapshot(ctx,input);
 const original=request({scopeRef:nativeRef(),temporalSelection:temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission});
 expect(createSnapshotGrantVerifier(secret,{ownerId:ctx.ownerId,processEpoch:'realm-alias',registrySha256:TEST_REGISTRY_SHA256})(acquired.snapshotAdmission,original,ctx)).toBe(true);
});
