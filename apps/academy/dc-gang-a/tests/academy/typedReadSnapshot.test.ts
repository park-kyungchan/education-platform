import {describe,expect,test} from 'bun:test';
import {canonicalJson,digest} from '../../src/learning/model';
import {createNativeTypedRead,fullFieldMask,TypedReadRefusal,type TypedReadErrorCode} from '../../src/academy/nativeTypedRead';
import {ctx,fixture,FakePrerequisiteStore,fictionalGrantVerifier,mapFixtureViews,nativeRef,objectRef,request,registeredRequest,testFunctionRequest,testTemporal,TEST_REGISTRY_SHA256,version,knownK} from './typedRead.test';
import {exactWorkFixture} from './learningWorkFixtures';
import {computeReadHorizon} from '../../src/academy/nativePrerequisiteStore';
import type {ReadHorizonPlan,TeacherPrerequisiteReadStore} from '../../src/academy/ports/teacherStore';
import {r6OwnerFixture,scene,retained} from './nativePrerequisitePort.test';
import {admitted} from './nativePrerequisiteStore.test';
import {context,known} from './nativePrerequisiteContracts.test';

// A trusted cursor capability changes custody, never Function selection,
// dependency revision meaning, source unknowns or occurrence participation.
for(const scenario of ['dependency-pin','facet-gap','payload-participation'] as const)test('CURSOR-SEMANTICS '+scenario+' equals the general selected Function',async()=>{
 const run=async(cursorOwner:boolean)=>{
  const store=new FakePrerequisiteStore();
  if(scenario==='payload-participation')store.temporals=store.temporals.filter(v=>v.payload.bindingKind!=='LESSON_PARTICIPATION');
  mapFixtureViews(store,view=>({...view,
   ownerRevision:async(owner,family,key,revision)=>{const v=family==='student'?await view.studentRevisionCurrent(owner,key):null;return v?.revisionId===revision?v:null;},
   current:async(owner,id)=>{
    const rows=await view.current(owner,id);
    if(scenario==='dependency-pin')return rows.filter(v=>v.payload.kind==='daily_progress');
    if(scenario==='payload-participation')return [];
    const base=rows[0]!;
    return [{...base,entityId:'synthetic-facet-only',revisionId:'synthetic-facet-r1',payload:{kind:'teacher_lesson_carryover',sourceStudent:{namespace:'academy_student',literalKey:'synthetic-student-a'},sourceCourse:null,sourceBook:null,sourceMinorUnit:null,activity:'daily_test',status:'reminder',originDate:null,targetDate:'2026-10-24',occurrence:{date:'2026-10-24',groupId:'1',courseKey:'2',recordKey:'3',membershipKey:'4'},text:'Invented reminder',directiveRef:'invented directive',evidenceRefs:['invented evidence']}}] as typeof rows;
   },
  }));
  const service=createNativeTypedRead(store.asStore(),ctx.ownerId,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantVerifier:fictionalGrantVerifier,now:()=>Date.parse('2026-10-24T00:00:00.000Z'),...(cursorOwner?{cursorOwner:{seal:()=>{throw Error('one exact object needs no cursor');},open:()=>{throw Error('no continuation');},assertCurrent:()=>{}}}:{})});
  const input=request({requestId:'cursor-semantics-'+scenario,selector:{kind:'EXACT_OBJECT',objectRef:objectRef('Student','student-a','rev-student')},fieldMask:fullFieldMask(['Student']),linkMask:[],expectedRevisions:scenario==='dependency-pin'?[objectRef('DailyProgress','progress-a','rev-progress')]:[]});
  try{return await service.typedRead(ctx,input);}catch(error){if(error instanceof TypedReadRefusal)return {kind:'ERROR',code:error.code,httpStatus:error.httpStatus};throw error;}
 };
 const general=await run(false);
 expect(general.kind).toBe('OK');
 if(general.kind!=='OK')throw Error('general control must exercise the selected Function');
 if(scenario!=='dependency-pin')expect(general.enumeration).toBe(scenario==='facet-gap'?'UNKNOWN':'COMPLETE');
 if(scenario==='facet-gap')expect(general.gaps.filter(g=>g.sourceUnknown?.kind==='FACET_ONLY_CARRYOVER')).toHaveLength(1);
 const optimized=await run(true);
 const shape=(v:typeof general|typeof optimized)=>({kind:v.kind,...(v.kind==='OK'?{enumeration:v.enumeration,gapCount:v.gaps.length}:{code:v.code,httpStatus:v.httpStatus})});
 expect(shape(optimized)).toEqual(shape(general));
 expect(digest(optimized)).toBe(digest(general));
});

async function fourGapScene(){
 const f=await scene(),temporal=testTemporal({classGroupRef:f.recordScope.classGroupRef,studentRef:f.recordScope.studentRef,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}});
 const service=createNativeTypedRead(f.store,ctx.ownerId,{processEpoch:'c1-synthetic-profile',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'c1-invented-source-test-secret',now:()=>Date.parse('2026-10-24T00:02:00.000Z')});
 const acquire=()=>service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'c1-acquire',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(temporal)});
 const input=(a:Awaited<ReturnType<typeof acquire>>,selector:import('../../src/academy/nativeTypedRead').TypedReadSelector,linkMask:import('../../src/academy/nativeTypedRead').TypedLinkType[]=[])=>request({temporalSelection:temporal,snapshot:a.snapshot,asOf:a.snapshot.asOf,snapshotAdmission:a.snapshotAdmission,selector,linkMask});
 return {...f,service,acquire,input,temporal};
}
test('C1 existing ListClassDailyStatus remains usable with genuinely scoped work, without sourceClosure carriers',async()=>{
 const f=await fourGapScene(),temporal=testTemporal({functionName:'ListClassDailyStatus',classGroupRef:f.recordScope.classGroupRef,studentRef:null,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef}});
 const acquired=await f.service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'c1-list-acquire',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(temporal)});
 const req=registeredRequest('ClassGroup',{temporalSelection:temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission,linkMask:[]});
 const page=await f.service.typedRead(ctx,req);expect(page.items).toHaveLength(1);expect(page.items[0]).toMatchObject({kind:'OBJECT',record:{identity:{objectType:'ClassGroup',nativeKey:f.group.identity.nativeKey}}});expect(page.gaps.some(gap=>gap.sourceUnknown)).toBe(false);
});
test('C1 positive reused homework and distinct genuine raw-rating attempts project scoped objects while both scores remain unknown',async()=>{
 const f=await fourGapScene();if(f.attempt.payload.kind!=='learning_work_attempt')throw Error('fixture kind');
 const ratings=[];
 for(const [index,lexeme] of ['-1','10'].entries()){
  const row=retained(f.sql,'c1-rating-'+index,{...f.attempt.payload,attemptKey:{namespace:'fictional_c1_attempt',literalKey:'independent-'+index},rawDailyRating:{schemaVersion:'1.0.0',family:'daily_rating_code',lexeme:lexeme as '-1'|'10'}});
  const ref=objectRef('DailyTestAttempt',row.entityId,row.revisionId);await f.attach('DAILY_TEST_ATTEMPT',ref);ratings.push(ref);
 }
 const acquired=await f.acquire();
 const homework=await f.service.typedRead(ctx,f.input(acquired,{kind:'EXACT_OBJECT',objectRef:objectRef('HomeworkAssignment',f.current.entityId,f.current.revisionId)},['activityForStudent','activityInClass','activityInLesson']));
 expect(homework.items.filter(item=>item.kind==='OBJECT')).toHaveLength(1);expect(homework.items.filter(item=>item.kind==='LINK')).toHaveLength(3);
 for(const ref of ratings){
  const page=await f.service.typedRead(ctx,f.input(acquired,{kind:'EXACT_OBJECT',objectRef:ref},['activityForStudent','activityInClass','activityInLesson']));
  const object=page.items.find(item=>item.kind==='OBJECT');expect(object?.kind).toBe('OBJECT');if(object?.kind!=='OBJECT')throw Error('genuine attempt missing');
  expect(object.record.identity.nativeKey).toBe(ref.identity.nativeKey);expect(object.record.recordScope).toEqual(f.recordScope);
  expect(object.record.score).toMatchObject({state:'unknown',reason:'UNVERIFIED',requiredEvidence:['SOURCE_FIELD','OWNER_INTERFACE_RATIFICATION']});
  expect('value' in (object.record.score as object)).toBe(false);expect(object.record.gradingState).toMatchObject({state:'unknown'});
  expect(page.items.filter(item=>item.kind==='LINK')).toHaveLength(3);
  expect(JSON.stringify(page)).not.toContain('rawDailyRating');
 }
});
test('C1 facet-only equal payloads remain two envelope-correlated unknowns and source membership insertion stales the acquired horizon',async()=>{
 const f=await fourGapScene();
 if(f.current.payload.kind!=='learning_work_assignment')throw Error('fixture source');
 const payload={kind:'teacher_lesson_carryover' as const,sourceStudent:f.current.payload.sourceStudent,sourceCourse:null,sourceBook:null,sourceMinorUnit:null,activity:'daily_test' as const,status:'reminder' as const,originDate:null,targetDate:'2026-10-24',occurrence:{date:'2026-10-24',groupId:'1',courseKey:'2',recordKey:'3',membershipKey:'4'},text:'Invented reminder',directiveRef:'invented directive',evidenceRefs:['invented evidence']};
 const first=retained(f.sql,'c1-facet-one',payload),before=await f.acquire();
 const second=retained(f.sql,'c1-facet-two',payload);
 const selector={kind:'EXACT_OBJECT' as const,objectRef:f.recordScope.studentRef};
 await refusal(f.service.typedRead(ctx,f.input(before,selector)),'OBJECTSET_CURSOR_STALE',409);
 const page=await f.service.typedRead(ctx,f.input(await f.acquire(),selector));
 const carriers=page.gaps.filter(gap=>gap.sourceUnknown?.kind==='FACET_ONLY_CARRYOVER');
 expect(carriers).toHaveLength(2);expect(new Set(carriers.map(g=>g.sourceUnknown!.source.entityId))).toEqual(new Set([first.entityId,second.entityId]));
 for(const gap of carriers){expect(gap.subject).toBeNull();expect(gap.path).toBe('sourceClosure');expect(gap.sourceUnknown!.recordScope).toMatchObject({state:'unknown',reason:'UNVERIFIED'});expect(gap.evidence).toEqual(gap.sourceUnknown!.recordScope.evidence);expect(gap.requiredEvidence).toEqual(gap.sourceUnknown!.recordScope.requiredEvidence);}
 expect(page.items.some(item=>item.kind==='OBJECT'&&[first.entityId,second.entityId].includes(item.record.identity.nativeKey))).toBe(false);
 expect(JSON.stringify(page)).not.toContain('Invented reminder');expect(JSON.stringify(page)).not.toContain('membershipKey');
});
test('C1 terminal scope loss stales old grants and a fresh read retains a two-evidence unknown without objects or active links',async()=>{
 const f=await fourGapScene(),acquired=await f.acquire(),owner=context().ownerId;
 const active=(await f.store.activityScopes(owner,{})).find(row=>row.payload.activityRef.identity.nativeKey===f.current.entityId)!;
 const command={context:context('c1-detach-read'),entityKey:active.entityKey,expectedRevisionId:active.revisionId,payload:{...active.payload,state:'DETACHED' as const}};
 const terminal=await admitted(f.store,'append:scope',command,()=>f.store.appendActivityScope(command));
 const selector={kind:'EXACT_OBJECT' as const,objectRef:objectRef('HomeworkAssignment',f.current.entityId,f.current.revisionId)};
 await refusal(f.service.typedRead(ctx,f.input(acquired,selector)),'OBJECTSET_CURSOR_STALE',409);
 const result=await f.service.typedRead(ctx,f.input(await f.acquire(),selector,['activityForStudent','activityInClass','activityInLesson']));
 expect(result.items).toEqual([]);expect(result.enumeration).toBe('UNKNOWN');
 const gap=result.gaps.find(gap=>gap.sourceUnknown?.kind==='DETACHED_ACTIVITY');expect(gap).toBeDefined();expect(gap!.subject).toEqual(selector.objectRef);expect(gap!.path).toBe('HomeworkAssignment.recordScope');
 expect(gap!.evidence.map(e=>e.sourceRevision)).toEqual([f.current.revisionId,terminal.revisionId]);
 expect((await f.store.ownerHistory(owner,'scope',active.entityKey))).toHaveLength(2);
});

export async function r7RevisionFixture(control:'revision'|'expired'|'retired'|'unchanged'|'policy'){
  const f=await r6OwnerFixture('cleanup',control==='expired',control==='policy'?'policy':'none');
  const before=f.sql.beforeQuery,correction={count:0,revision:null as string|null};
  f.sql.beforeQuery=async(text,values)=>{
    await before?.(text,values);
    if(text!=='SET TRANSACTION ISOLATION LEVEL READ COMMITTED'||!f.state.inOutput||f.state.transactions!==2||control==='unchanged'||control==='policy')return;
    // The successful callback's transaction has rolled back. Use the real
    // participating append before cleanup acquires its new shared gate.
    expect(f.state.callbackReady&&f.state.triggered).toBe(true);
    expect(f.state.gateHeld).toBe(false);expect(f.state.leaseHeld).toBe(true);
    expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)?.status).toBe('PENDING');
    await expect(f.closedView()!.teachers(ctx.ownerId)).rejects.toThrow('read_snapshot_closed');
    f.state.inOutput=false;
    try{
      const command={context:context('r7-class-correction'),entityKey:f.group.identity.nativeKey,expectedRevisionId:f.group.revisionId,
        payload:{kind:'class_group' as const,displayName:known('Invented Class Corrected'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}};
      const result=await admitted(f.store,'append:class',command,()=>f.store.appendClassGroup(command));
      correction.count++;correction.revision=result.revisionId;
      expect(result.revisionId).not.toBe(f.input.temporalSelection.classGroupRef.revision);
      expect((await f.store.classGroups(ctx.ownerId)).find(v=>v.entityKey===command.entityKey)?.revisionId).toBe(result.revisionId);
      if(control==='retired'){
        const retire={...f.bind,context:context('r7-retire-after-correction'),entityKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...f.bind.payload,state:'RETIRED' as const}};
        await admitted(f.store,'append:teacher',retire,()=>f.store.appendTeacher(retire));
        f.state.changes++;
      }
    }finally{f.state.inOutput=true;}
  };
  return {...f,correction};
}

describe('ORDINARY-R7-F1 fresh cleanup revision selection',()=>{
  for(const control of ['revision','expired','retired','unchanged','policy'] as const)test(control+' real owner bytes and audit',async()=>{
    const f=await r7RevisionFixture(control),encode=TextEncoder.prototype.encode,encoded:Uint8Array<ArrayBuffer>[]=[];
    f.state.leaseHeld=true;
    TextEncoder.prototype.encode=function(input?:string){
      const bytes=encode.call(this,input);
      if(f.state.triggered&&input?.startsWith('{"kind":"ERROR"')){
        expect(f.state.leaseHeld&&f.state.gateHeld).toBe(true);expect(f.state.commitKnown).toBe(false);
        expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)?.status).toBe('PENDING');encoded.push(bytes);
      }
      return bytes;
    };
    let result;
    try{result=await f.service.typedReadBuffered(ctx,f.input,()=>f.state.sessionActive);}finally{TextEncoder.prototype.encode=encode;f.state.leaseHeld=false;}
    const code=control==='expired'||control==='retired'||control==='policy'?'PERMISSION_DENIED':control==='unchanged'?'CONTRACT_UNVERIFIABLE':'REVISION_STALE';
    expect(f.state.callbackReady&&f.state.triggered&&f.state.commitKnown).toBe(true);expect(f.state.transactions).toBe(2);expect(f.state.ownerCalls).toBe(1);
    expect(f.correction.count).toBe(control==='unchanged'||control==='policy'?0:1);
    expect((await f.store.teacherBindingByActor(ctx.ownerId,ctx.actorId))?.payload.state).toBe(control==='retired'?'RETIRED':'ACTIVE');
    expect(f.state.sessionActive).toBe(control!=='expired');expect(result.status).toBe(control==='expired'?401:control==='retired'||control==='policy'?403:409);
    expect(encoded.length).toBeGreaterThan(0);expect(result.body).toBe(encoded.at(-1)!);
    const body=JSON.parse(new TextDecoder().decode(result.body!));expect(body.error.code).toBe(code);expect(body.items).toBeUndefined();expect(body.nextCursor).toBeUndefined();
    expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)).toMatchObject({status:'REFUSED',refusal_code:code,snapshot_digest:null});
    expect(f.sql.queries.filter(q=>q.text.startsWith('UPDATE academy.read_occurrences'))).toHaveLength(1);
    expect(f.refusalViews.at(-1)).not.toBe(f.closedView());
    for(const view of f.refusalViews)await expect(view.teachers(ctx.ownerId)).rejects.toThrow('read_snapshot_closed');
  });
  test('revision cleanup lost COMMIT acknowledgement discards without replay',async()=>{
    const f=await r7RevisionFixture('revision');let lost=0;f.state.leaseHeld=true;
    f.sql.afterCommit=()=>{if(f.state.inOutput&&f.sql.rows('read_occurrences').some(r=>r.request_id===f.input.requestId&&r.status==='REFUSED')){lost++;throw Error('fictional lost COMMIT acknowledgement');}};
    try{await refusal(f.service.typedReadBuffered(ctx,f.input,()=>true),'READ_UNRESOLVED',503);}finally{f.state.leaseHeld=false;f.sql.afterCommit=undefined;}
    expect(lost).toBe(1);expect(f.correction.count).toBe(1);expect(f.state.ownerCalls).toBe(1);expect(f.state.transactions).toBe(2);expect(f.state.commitKnown).toBe(true);
    expect(f.sql.queries.filter(q=>q.text.startsWith('UPDATE academy.read_occurrences'))).toHaveLength(1);
    expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)).toMatchObject({status:'REFUSED',refusal_code:'REVISION_STALE',snapshot_digest:null});
  });
});

describe('ORDINARY-R6-F1 real owner final refusal selection',()=>{
  for(const phase of ['late-binding','late-horizon','cleanup','cleanup-expiry'] as const){
    for(const expire of [false,true])test(phase+' '+(expire?'expired':'active'),async()=>{
      const f=await r6OwnerFixture(phase,expire),encode=TextEncoder.prototype.encode,encoded:Uint8Array<ArrayBuffer>[]=[];
      f.state.leaseHeld=true;
      TextEncoder.prototype.encode=function(input?:string){
        const bytes=encode.call(this,input);
        if(f.state.triggered&&input?.startsWith('{"kind":"ERROR"')){
          expect(f.state.leaseHeld&&f.state.gateHeld).toBe(true);expect(f.state.commitKnown).toBe(false);
          expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)?.status).toBe('PENDING');encoded.push(bytes);
        }
        return bytes;
      };
      let result;
      try{result=await f.service.typedReadBuffered(ctx,f.input,()=>f.state.sessionActive);}finally{TextEncoder.prototype.encode=encode;f.state.leaseHeld=false;}
      const code=expire?'PERMISSION_DENIED':'CONTRACT_UNVERIFIABLE';
      expect(f.state.triggered&&f.state.commitKnown).toBe(true);expect(f.state.ownerCalls).toBe(1);
      expect(f.state.transactions).toBe(phase.startsWith('cleanup')?2:1);
      expect(result.status).toBe(expire?401:409);expect(encoded.length).toBeGreaterThan(0);expect(result.body).toBe(encoded.at(-1)!);
      const body=JSON.parse(new TextDecoder().decode(result.body!));expect(body.error.code).toBe(code);expect(body.items).toBeUndefined();expect(body.nextCursor).toBeUndefined();
      expect(await f.store.readOccurrenceLookup(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)!.request as import('../../src/academy/contracts/prerequisiteRecords').ReadAdmission)).toMatchObject({status:'REFUSED',refusalCode:code,snapshotDigest:null});
      await expect(f.closedView()!.teachers(ctx.ownerId)).rejects.toThrow('read_snapshot_closed');
      expect(f.refusalViews.length).toBeGreaterThan(0);
      if(phase.startsWith('cleanup'))expect(f.refusalViews.at(-1)).not.toBe(f.closedView());
      for(const view of f.refusalViews)await expect(view.teachers(ctx.ownerId)).rejects.toThrow('read_snapshot_closed');
    });
  }
  for(const change of ['binding','policy'] as const)test('cleanup refreshes current '+change+' refusal',async()=>{
    const f=await r6OwnerFixture('cleanup',false,change);f.state.leaseHeld=true;
    let result;try{result=await f.service.typedReadBuffered(ctx,f.input,()=>f.state.sessionActive);}catch(error){expect(f.state.changeError).toBe(null);throw error;}finally{f.state.leaseHeld=false;}
    // Both binding retirement and closing TEACHING_ASSIGNMENT revoke actual current authority.
    const code='PERMISSION_DENIED';
    expect(f.state.changes).toBe(1);expect(f.state.transactions).toBe(2);expect(result.status).toBe(403);
    expect(JSON.parse(new TextDecoder().decode(result.body!)).error.code).toBe(code);
    expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)).toMatchObject({status:'REFUSED',refusal_code:code,snapshot_digest:null});
  });
  for(const phase of ['late-binding','cleanup'] as const)test(phase+' expiry while encoding the new owner refusal selects401 before audit',async()=>{
    const f=await r6OwnerFixture(phase,false),encode=TextEncoder.prototype.encode;let advanced=false;
    f.state.leaseHeld=true;
    TextEncoder.prototype.encode=function(input?:string){const bytes=encode.call(this,input);if(f.state.triggered&&input?.startsWith('{"kind":"ERROR"')&&!advanced){advanced=true;f.state.sessionActive=false;}return bytes;};
    let result;try{result=await f.service.typedReadBuffered(ctx,f.input,()=>f.state.sessionActive);}finally{TextEncoder.prototype.encode=encode;f.state.leaseHeld=false;}
    expect(advanced).toBe(true);expect(result.status).toBe(401);expect(JSON.parse(new TextDecoder().decode(result.body!)).error.code).toBe('PERMISSION_DENIED');
    expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)).toMatchObject({status:'REFUSED',refusal_code:'PERMISSION_DENIED'});
  });
  for(const phase of ['late-binding','cleanup'] as const)test(phase+' lost refusal COMMIT acknowledgement discards without second finalize',async()=>{
    const f=await r6OwnerFixture(phase,false);let lost=0;f.state.leaseHeld=true;
    f.sql.afterCommit=()=>{if(f.state.inOutput&&f.sql.rows('read_occurrences').some(r=>r.request_id===f.input.requestId&&r.status==='REFUSED')){lost++;throw Error('fictional lost COMMIT acknowledgement');}};
    try{await refusal(f.service.typedReadBuffered(ctx,f.input,()=>true),'READ_UNRESOLVED',503);}finally{f.state.leaseHeld=false;f.sql.afterCommit=undefined;}
    expect(lost).toBe(1);expect(f.state.ownerCalls).toBe(1);expect(f.state.transactions).toBe(phase==='cleanup'?2:1);
    expect(f.sql.queries.filter(q=>q.text.startsWith('UPDATE academy.read_occurrences'))).toHaveLength(1);
    expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)).toMatchObject({status:'REFUSED',refusal_code:'CONTRACT_UNVERIFIABLE'});
  });
});

/* IG-3 source evidence only: fail-closed snapshot/cursor behavior over
 * the in-process fake store. Owner-qualified snapshot and opaque cursor
 * capabilities are absent from the frozen ports (P4S-DEP-READ-FENCE /
 * P4S-DEP-CURSOR, requested only), so continuation is refused instead of
 * echoing caller tokens or issuing a public-digest cursor. No listen/DB. */
const OWNER='synthetic-owner';

function ordinaryRoster(enumerate=false){
  const {store}=fixture(),temporal=testTemporal({functionName:'ListClassDailyStatus',studentRef:null,occurrence:enumerate?{mode:'ENUMERATE_SEPARATELY'}:testTemporal().occurrence});
  const peer=objectRef('Student','student-b','rev-student-b');
  const state={participates:false,member:true,head:'peer-work-r1',peerReads:0};
  mapFixtureViews(store,view=>({...view,
    lessons:async owner=>(await view.lessons(owner)).map(v=>({...v,revisionId:state.participates?'rev-lesson-peer':'rev-lesson',payload:{...v.payload,participantRefs:knownK(state.participates?[testTemporal().studentRef!,peer]:[testTemporal().studentRef!])}})),
    students:async owner=>{const rows=await view.students(owner);return [...rows,{...rows[0]!,id:'student-b'}];},
    studentRevisionCurrent:async(owner,id)=>id==='student-b'?version(id,peer.revision,{kind:'student_record',displayName:knownK('Invented peer'),enrollmentState:knownK('ACTIVE' as const)}):view.studentRevisionCurrent(owner,id),
    temporalBindings:async owner=>{
      const rows=await view.temporalBindings(owner),sample=rows.find(v=>v.payload.bindingKind==='CLASS_MEMBERSHIP')!;
      const membership={...sample,entityKey:'peer-membership',revisionId:'peer-membership-r1',payload:{...sample.payload,subjectRef:peer}};
      return [...rows,...(state.member?[membership]:[])];
    },
    current:async(owner,id)=>{
      if(id!=='student-b')return view.current(owner,id);
      state.peerReads++;
      const rows=await view.current(owner,'student-a');
      return [{...rows[0]!,studentId:id,entityId:'peer-work',revisionId:state.head,payload:{...exactWorkFixture(),sourceStudent:{namespace:'academy_student',literalKey:'synthetic-student-b'}}}];
    },
  }));
  const service=createNativeTypedRead(store.asStore(),OWNER,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'fictional-or2-secret'});
  const plan:ReadHorizonPlan={classGroupRef:temporal.classGroupRef,studentRef:null,occurrence:temporal.occurrence,draftRef:null,expectedRevisions:[]};
  const horizon=()=>store.readSnapshot(view=>computeReadHorizon(view,OWNER,ctx.actorId,temporal.businessDate,[],plan));
  const acquire=()=>service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'or2-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(temporal)});
  return {store,service,state,temporal,horizon,acquire};
}

test('OR2-01 List ignores a dated nonparticipant member source edit through acquisition and output',async()=>{
  const f=ordinaryRoster(),before=await f.horizon(),acquired=await f.acquire();
  f.state.head='peer-work-r2';
  expect(await f.horizon()).toEqual(before);
  expect(before.temporalEdges.some(e=>e.entityKey==='peer-membership')).toBe(true);
  expect(before.students).toEqual(['student-a']);
  const result=await f.service.typedRead(ctx,registeredRequest('ClassGroup',{temporalSelection:f.temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission}));
  expect(result.items.flatMap(i=>i.kind==='OBJECT'?[i.record.identity.nativeKey]:[])).toEqual(['class-a']);
  expect(result.gaps.some(g=>g.subject?.identity.nativeKey==='student-b')).toBe(false);
  expect(f.state.peerReads).toBe(0);
  expect(f.store.finalizations.at(-1)?.status).toBe('COMPLETED');
});

test('OR2-01 List retains membership and participation change witnesses and then reads the genuine participant source',async()=>{
  const f=ordinaryRoster(true),before=await f.horizon(),acquired=await f.acquire();
  expect(before.students).not.toContain('student-b');
  f.state.participates=true;
  const participating=await f.horizon();
  expect(participating.students).toEqual(['student-a','student-b']);
  expect(participating.recordHeads).toContainEqual({studentId:'student-b',entityId:'peer-work',revisionId:'peer-work-r1'});
  expect(participating).not.toEqual(before);
  await refusal(f.service.typedRead(ctx,registeredRequest('ClassGroup',{temporalSelection:f.temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission})),'OBJECTSET_CURSOR_STALE',409);
  f.state.head='peer-work-r2';
  expect((await f.horizon()).recordHeads).toContainEqual({studentId:'student-b',entityId:'peer-work',revisionId:'peer-work-r2'});
  f.state.member=false;
  const withoutMembership=await f.horizon();
  expect(withoutMembership.students).toEqual(['student-a']);
  expect(withoutMembership).not.toEqual(participating);
});

test('OR2-01 enumerated lessons expand each student source only for that student participation tuple',async()=>{
  const {store}=fixture(),peer=objectRef('Student','student-b','rev-student-b'),secondLesson=objectRef('LessonSession','lesson-b','rev-lesson-b');
  const temporal=testTemporal({functionName:'ListClassDailyStatus',studentRef:null,occurrence:{mode:'ENUMERATE_SEPARATELY'}});
  mapFixtureViews(store,view=>({...view,
    lessons:async owner=>{
      const first=(await view.lessons(owner))[0]!;
      return [{...first,payload:{...first.payload,participantRefs:knownK([testTemporal().studentRef!,peer])}},
        {...first,entityKey:'lesson-b',revisionId:'rev-lesson-b',payload:{...first.payload,lessonKey:'lesson-b',occurrenceOrdinal:knownK(2)}}];
    },
    students:async owner=>{const rows=await view.students(owner);return [...rows,{...rows[0]!,id:'student-b'}];},
    studentRevisionCurrent:async(owner,id)=>id==='student-b'?version(id,peer.revision,{kind:'student_record',displayName:knownK('Invented peer'),enrollmentState:knownK('ACTIVE' as const)}):view.studentRevisionCurrent(owner,id),
    temporalBindings:async owner=>{const rows=await view.temporalBindings(owner),member=rows.find(v=>v.payload.bindingKind==='CLASS_MEMBERSHIP')!;return [...rows,{...member,entityKey:'peer-membership',revisionId:'peer-member-r1',payload:{...member.payload,subjectRef:peer}}];},
    current:async(owner,id)=>{
      const rows=await view.current(owner,id==='student-b'?'student-a':id);
      if(id!=='student-b')return rows;
      const progress=rows.find(r=>r.payload.kind==='daily_progress')!;
      if(progress.payload.kind!=='daily_progress')throw Error('fictional progress missing');
      const payload=progress.payload;
      return [testTemporal().occurrence, {mode:'EXACT' as const,lessonRef:secondLesson}].map((occurrence,index)=>{
        if(occurrence.mode!=='EXACT')throw Error('fictional occurrence must be exact');
        return {...progress,studentId:id,entityId:'peer-progress-'+index,revisionId:'peer-progress-r'+index,payload:{...payload,recordScope:{...payload.recordScope,studentRef:peer,lessonRef:occurrence.lessonRef}}};
      });
    },
  }));
  const plan:ReadHorizonPlan={classGroupRef:temporal.classGroupRef,studentRef:null,occurrence:temporal.occurrence,draftRef:null,expectedRevisions:[]};
  const horizon=await store.readSnapshot(view=>computeReadHorizon(view,OWNER,ctx.actorId,temporal.businessDate,[],plan));
  expect(horizon.students).toEqual(['student-a','student-b']);
  expect(horizon.recordHeads.filter(r=>r.studentId==='student-b')).toEqual([{studentId:'student-b',entityId:'peer-progress-0',revisionId:'peer-progress-r0'}]);
});

async function refusal(promise:Promise<unknown>,code:TypedReadErrorCode,status:number){
  try{await promise;}catch(error){expect(error).toBeInstanceOf(TypedReadRefusal);expect((error as TypedReadRefusal).code).toBe(code);expect((error as TypedReadRefusal).httpStatus).toBe(status);return;}
  throw Error('expected refusal '+code);
}

test('single-transaction first page is complete in one reply with no cursor; metadata stays outside the reply',async()=>{
  const f=fixture(),req=request({pageSize:100});
  const page=await f.service.typedRead(ctx,req);
  expect(page.nextCursor).toBeNull();
  expect(page.items.length).toBeGreaterThan(0);
  expect(f.store.admissions.size).toBe(1);
  // COMPLETED is recorded exactly once, only through commitReadOutput.
  expect(f.store.commitCalls).toBe(1);
  expect(f.store.directFinalizeCalls).toBe(0);
  expect(f.store.finalizations).toHaveLength(1);
  expect(f.store.finalizations[0]).toMatchObject({status:'COMPLETED',refusalCode:null});
  expect(f.store.finalizations[0]!.snapshotDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(f.store.snapshotCalls).toBe(1);
  const wire=JSON.stringify(page);
  expect(wire).not.toContain('read_occurrences');expect(wire).not.toContain('admission');
  for(const item of page.items)if(item.kind==='OBJECT')expect(Object.keys(item.record)).not.toContain('requestId');
});

describe('OR1-04 selected-plan dependency witnesses',()=>{
  const temporal=testTemporal();
  const plan:ReadHorizonPlan={classGroupRef:temporal.classGroupRef,studentRef:temporal.studentRef,occurrence:temporal.occurrence,draftRef:null,expectedRevisions:[]};
  const horizon=(view:TeacherPrerequisiteReadStore)=>computeReadHorizon(view,OWNER,ctx.actorId,temporal.businessDate,[],plan);
  test('unrelated class/student/legacy/catalog heads do not change an acquired read or its dependency witness',async()=>{
    const {store}=fixture();let unrelated=false;
    mapFixtureViews(store,view=>({...view,
      classGroups:async owner=>{const rows=await view.classGroups(owner);return unrelated?[...rows,{...rows[0]!,entityKey:'other-class',revisionId:'other-class-r2'}]:rows;},
      students:async owner=>{const rows=await view.students(owner);return unrelated?[...rows,{...rows[0]!,id:'legacy-other-student'}]:rows;},
      studentRevisionCurrent:async(owner,id)=>id==='legacy-other-student'?null:view.studentRevisionCurrent(owner,id),
      current:async(owner,id)=>{if(id==='legacy-other-student')throw Error('unrelated legacy partition must not be read');return view.current(owner,id);},
      currentCatalogPins:async owner=>{const pins=await view.currentCatalogPins(owner);return unrelated?[...pins,{...pins[0]!,node:{...pins[0]!.node,id:'other-book',label:'Other book'},revisionId:'other-book-r2'}]:pins;},
    }));
    const before=await store.readSnapshot(horizon);
    const service=createNativeTypedRead(store.asStore(),OWNER,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'fictional-own-secret'});
    const acquired=await service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'ordinary-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(temporal)});
    unrelated=true;
    expect(await store.readSnapshot(horizon)).toEqual(before);
    const result=await service.typedRead(ctx,request({snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission}));
    expect(result.items.flatMap(i=>i.kind==='OBJECT'?[i.record.identity.nativeKey]:[])).toEqual(['student-a']);
    expect(store.finalizations.at(-1)?.status).toBe('COMPLETED');
  });
  test('relevant membership deletion, record insertion, catalog-parent and previously absent score heads change the witness',async()=>{
    const {store}=fixture();
    const before=await store.readSnapshot(horizon);
    expect(before.scoreHeads.some(h=>h.attemptRef.identity.nativeKey==='attempt-a'&&h.revisionIds.length===0)).toBe(true);
    const original=store.readSnapshot.bind(store);
    const membership=await original(view=>horizon({...view,temporalBindings:async owner=>(await view.temporalBindings(owner)).filter(v=>v.payload.bindingKind!=='CLASS_MEMBERSHIP')}));
    expect(membership.temporalEdges).not.toEqual(before.temporalEdges);
    const inserted=await original(view=>horizon({...view,current:async(owner,id)=>{const rows=await view.current(owner,id);return [...rows,{...rows[0]!,entityId:'new-relevant-progress',revisionId:'new-relevant-r1'}];}}));
    expect(inserted.recordHeads).toContainEqual({studentId:'student-a',entityId:'new-relevant-progress',revisionId:'new-relevant-r1'});
    const parent=await original(view=>horizon({...view,currentCatalogPins:async owner=>(await view.currentCatalogPins(owner)).map(p=>p.node.id==='minor'?{...p,revisionId:'new-minor-r2',node:{...p.node,parent:{state:'known',value:'major',evidenceRefs:['fictional-parent']}}}:p)}));
    expect(parent.catalogEdges).not.toEqual(before.catalogEdges);
    if(temporal.studentRef===null||temporal.occurrence.mode!=='EXACT')throw Error('fictional exact scope required');
    const recordScope={studentRef:temporal.studentRef,classGroupRef:temporal.classGroupRef,businessDate:temporal.businessDate,lessonRef:temporal.occurrence.lessonRef};
    const score=await original(view=>horizon({...view,scoreEvidenceForAttempt:async()=>[version('ordinary-score','ordinary-score-r1',{kind:'native_score_evidence',attemptRef:objectRef('DailyTestAttempt','attempt-a','rev-attempt'),assignmentRef:objectRef('HomeworkAssignment','homework-a','rev-homework'),recordScope,scale:{family:'daily_test_attempt',version:'1.0.0',kind:'OWNER_RECORDED_NUMERIC_SCORE'},score:{earned:1,maximum:2},recordedBy:objectRef('Teacher','teacher-a','rev-teacher'),measurementLiteral:'Fictional scored result',synthetic:true})]}));
    expect(score.scoreHeads.find(h=>h.attemptRef.identity.nativeKey==='attempt-a')?.revisionIds).toEqual(['ordinary-score-r1']);
  });
  test('relevant set/parent/score changes between preparation and final gate discard the prepared page',async()=>{
    for(const change of ['membership','record','catalog','score'] as const){
      const {store,service}=fixture();let final=false;
      mapFixtureViews(store,view=>({...view,
        temporalBindings:async owner=>{const rows=await view.temporalBindings(owner);return final&&change==='membership'?rows.filter(r=>r.payload.bindingKind!=='CLASS_MEMBERSHIP'):rows;},
        current:async(owner,id)=>{const rows=await view.current(owner,id);return final&&change==='record'?[...rows,{...rows[0]!,entityId:'inserted-progress',revisionId:'inserted-progress-r1'}]:rows;},
        currentCatalogPins:async owner=>(await view.currentCatalogPins(owner)).map(p=>final&&change==='catalog'&&p.node.id==='minor'?{...p,revisionId:'minor-after-preparation'}:p),
        scoreEvidenceForAttempt:async(owner,ref)=>{
          if(!final||change!=='score')return view.scoreEvidenceForAttempt(owner,ref);
          if(temporal.studentRef===null||temporal.occurrence.mode!=='EXACT')throw Error('fictional exact scope required');
          return [version('final-score','final-score-r1',{kind:'native_score_evidence',attemptRef:ref,assignmentRef:objectRef('HomeworkAssignment','homework-a','rev-homework'),recordScope:{studentRef:temporal.studentRef,classGroupRef:temporal.classGroupRef,businessDate:temporal.businessDate,lessonRef:temporal.occurrence.lessonRef},scale:{family:'daily_test_attempt',version:'1.0.0',kind:'OWNER_RECORDED_NUMERIC_SCORE'},score:{earned:1,maximum:2},recordedBy:objectRef('Teacher','teacher-a','rev-teacher'),measurementLiteral:'Fictional final score',synthetic:true})];
        },
      }));
      const commit=store.commitReadOutput.bind(store);
      store.commitReadOutput=async(admission,prepare)=>{final=true;return commit(admission,prepare);};
      await refusal(service.typedRead(ctx,request()),'OBJECTSET_CURSOR_STALE',409);
      expect(store.finalizations.at(-1)?.status).toBe('REFUSED');
      expect(store.finalizations.some(r=>r.status==='COMPLETED')).toBe(false);
    }
  });
});

test('refusals finalize the read occurrence as REFUSED outside the business snapshot',async()=>{
  const {store,service}=fixture();
  await refusal(service.typedRead(ctx,request({expectedRevisions:[{identity:{scopeRef:request().scopeRef,namespace:'synthetic-native',objectType:'Teacher',nativeKey:'teacher-a'},revision:'rev-stale'}],snapshot:{registryVersion:'1.1.0',readRevision:'read-r1',asOf:'2026-10-24T00:00:00.000Z',policyRevision:'policy-r1',consistency:'FAIL_ON_CHANGE'}})),'REVISION_STALE',409);
  expect(store.finalizations.at(-1)).toMatchObject({status:'REFUSED',refusalCode:'REVISION_STALE',snapshotDigest:null});
  expect(store.commitCalls).toBe(1);
  expect(store.directFinalizeCalls).toBe(0);
});

describe('ORDINARY-R4-F1 current refusal precedence after failed preparation',()=>{
  for(const preparation of ['revision-stale','data-error'] as const){
    for(const finalState of ['active','retired','scope-denied'] as const){
      test(preparation+' then '+finalState+' selects the final current rights before the data error',async()=>{
        const {store,service}=fixture();let inFinalGate=false,preparatoryError:string|null=null;
        mapFixtureViews(store,view=>({...view,studentRevisionCurrent:async(owner,id)=>{
          const current=await view.studentRevisionCurrent(owner,id);
          return current&&inFinalGate&&finalState==='scope-denied'?{...current,namespace:'synthetic-other-scope'}:current;
        }}));
        const read=store.readSnapshot.bind(store),commit=store.commitReadOutput.bind(store);
        store.readSnapshot=async callback=>{
          try{
            if(preparation==='data-error')return await read(async()=>{throw Error('fictional preparatory data unavailable');});
            return await read(callback);
          }catch(error){preparatoryError=error instanceof TypedReadRefusal?error.code:(error as Error).message;throw error;}
        };
        store.commitReadOutput=async(admission,prepare)=>{
          expect(preparatoryError).toBe(preparation==='revision-stale'?'REVISION_STALE':'fictional preparatory data unavailable');
          inFinalGate=true;
          if(finalState==='retired')store.binding=version('teacher-a','rev-teacher-retired',{...store.binding!.payload,state:'RETIRED',assignmentState:knownK('INACTIVE' as const)});
          return commit(admission,prepare);
        };
        const req=request({expectedRevisions:preparation==='revision-stale'?[objectRef('Teacher','teacher-a','rev-stale')]:[]});
        const code=finalState!=='active'?'PERMISSION_DENIED':preparation==='revision-stale'?'REVISION_STALE':'CONTRACT_UNVERIFIABLE';
        await refusal(service.typedRead(ctx,req),code,finalState==='active'?409:403);
        expect(store.finalizations).toHaveLength(1);
        expect(store.finalizations[0]).toMatchObject({status:'REFUSED',refusalCode:code,snapshotDigest:null});
        expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);
        if(finalState==='scope-denied')expect(store.binding!.payload.state).toBe('ACTIVE');
      });
    }
  }
  test('current session denial precedes a preparatory REVISION_STALE in buffered output',async()=>{
    const {store,service}=fixture();
    const result=await service.typedReadBuffered(ctx,request({expectedRevisions:[objectRef('Teacher','teacher-a','rev-stale')]}),()=>false);
    expect(result.status).toBe(401);
    const body=JSON.parse(new TextDecoder().decode(result.body!));
    expect(body.error.code).toBe('PERMISSION_DENIED');expect(body.items).toBeUndefined();
    expect(store.finalizations.map(x=>[x.status,x.refusalCode])).toEqual([['REFUSED','PERMISSION_DENIED']]);
    expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);
  });
});

describe('ORDINARY-R5-F1 current session during final refusal selection and encoding',()=>{
  for(const preparation of ['revision-stale','data-error'] as const){
    for(const phase of ['binding','page','error-encode'] as const){
      for(const expire of [false,true])test(preparation+' '+phase+' '+(expire?'expires before refusal audit':'active control'),async()=>{
        const {store,service}=fixture();
        let leaseHeld=false,gateHeld=false,active=true,triggered=false,entryValid=false,preparatoryCode:string|null=null;
        const encoded:Uint8Array<ArrayBuffer>[]=[];
        const advance=()=>{if(gateHeld&&!triggered){triggered=true;if(expire)active=false;}};
        mapFixtureViews(store,view=>({...view,
          teacherBindingByActor:async(owner,actor)=>{const row=await view.teacherBindingByActor(owner,actor);if(phase==='binding')advance();return row;},
          studentRevisionCurrent:async(owner,id)=>{const row=await view.studentRevisionCurrent(owner,id);if(phase==='page')advance();return row;},
        }));
        const read=store.readSnapshot.bind(store),commit=store.commitReadOutput.bind(store);
        store.readSnapshot=async callback=>{
          try{return await read(preparation==='data-error'?async()=>{throw Error('fictional preparatory data unavailable');}:callback);}
          catch(error){preparatoryCode=error instanceof TypedReadRefusal?error.code:'CONTRACT_UNVERIFIABLE';throw error;}
        };
        store.commitReadOutput=async(admission,prepare)=>{
          expect(leaseHeld).toBe(true);expect(active).toBe(true);entryValid=true;
          expect(preparatoryCode).toBe(preparation==='revision-stale'?'REVISION_STALE':'CONTRACT_UNVERIFIABLE');
          gateHeld=true;try{return await commit(admission,prepare);}finally{gateHeld=false;}
        };
        const req=request({expectedRevisions:preparation==='revision-stale'?[objectRef('Teacher','teacher-a','rev-stale')]:[]});
        const encode=TextEncoder.prototype.encode;
        TextEncoder.prototype.encode=function(input?:string){
          const bytes=encode.call(this,input);
          if(input?.startsWith('{"kind":"ERROR"')){
            expect(leaseHeld).toBe(true);expect(gateHeld).toBe(true);expect(store.finalizations).toEqual([]);
            encoded.push(bytes);if(phase==='error-encode')advance();
          }
          return bytes;
        };
        let result;
        leaseHeld=true;
        try{result=await service.typedReadBuffered(ctx,req,()=>{expect(leaseHeld).toBe(true);expect(gateHeld).toBe(true);return active;});}
        finally{leaseHeld=false;TextEncoder.prototype.encode=encode;}
        const code=expire?'PERMISSION_DENIED':preparation==='revision-stale'?'REVISION_STALE':'CONTRACT_UNVERIFIABLE';
        expect(entryValid).toBe(true);expect(triggered).toBe(true);expect(result!.status).toBe(expire?401:409);
        expect(result!.body).toBe(encoded.at(-1)!);
        const body=JSON.parse(new TextDecoder().decode(result!.body!));
        expect(body.error.code).toBe(code);expect(body.items).toBeUndefined();expect(body.nextCursor).toBeUndefined();
        expect(store.finalizations.map(x=>[x.status,x.refusalCode])).toEqual([['REFUSED',code]]);
        expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);
      });
    }
  }
});

test('descriptorOnly bootstrap is NOT_ADMITTED in 2.1.0 and performs no projection',async()=>{
  const {store,service}=fixture();
  await refusal(service.typedRead(ctx,{...request(),descriptorOnly:true} as never),'INVALID_REQUEST',400);
  expect(store.projectionCalls).toBe(0);
  expect(store.commitCalls).toBe(0);
});

test('uncertain output commit discards the buffer as READ_UNRESOLVED with no second finalization',async()=>{
  const f=fixture();f.store.commitTerminal='UNKNOWN';
  await refusal(f.service.typedRead(ctx,request()),'READ_UNRESOLVED',503);
  expect(f.store.commitCalls).toBe(1);
  expect(f.store.directFinalizeCalls).toBe(0);
  expect(f.store.finalizations.filter(x=>x.status==='COMPLETED')).toHaveLength(0);
});

test('a result larger than one page refuses instead of truncating or issuing a forged cursor (IG3-REV-03/04)',async()=>{
  const {service}=fixture();
  await refusal(service.typedRead(ctx,request({pageSize:1})),'CONTRACT_UNVERIFIABLE',409);
});

describe('cursor continuation fails closed as CONTRACT_UNVERIFIABLE (409)',()=>{
  test('public-digest forged cursor position is not accepted',async()=>{
    const {service}=fixture();
    const binding={domain:'native-read-continuation/v2',requestDigest:'a'.repeat(64),principalBinding:'b'.repeat(64),registrySha256:TEST_REGISTRY_SHA256,readRevision:'read-r1',policyRevision:'policy-r1',asOf:'2026-10-24T00:00:00.000Z',pageSize:1,sealedPosition:'0',expiresAt:'2026-10-31T00:00:00.000Z',processEpoch:'epoch-1'};
    const forged=Buffer.from(canonicalJson({...binding,integrity:digest({cursorBinding:binding})})).toString('base64url');
    await refusal(service.typedRead(ctx,request({cursor:forged,pageSize:1})),'CONTRACT_UNVERIFIABLE',409);
  });
  test('malformed, cross-actor and expired-shaped cursors refuse uniformly',async()=>{
    const {service}=fixture();
    await refusal(service.typedRead(ctx,request({cursor:'not-a-cursor'})),'CONTRACT_UNVERIFIABLE',409);
    await refusal(service.typedRead({...ctx,actorId:'synthetic-other-actor'},request({cursor:'cross-actor-token'})),'CONTRACT_UNVERIFIABLE',409);
  });
  test('current denial precedes cursor details for an unbound principal (IG3-REV-06)',async()=>{
    const f=fixture();f.store.binding=null;
    await refusal(f.service.typedRead({...ctx,actorId:'fictional-unbound'},request({cursor:'prior-cursor'})),'PERMISSION_DENIED',403);
    expect(f.store.projectionCalls).toBe(0);
  });
  test('default bindings and mismatched registry bindings are unqualified',async()=>{
    const {store}=fixture();
    const unqualified=createNativeTypedRead(store.asStore(),OWNER);
    await refusal(unqualified.typedRead(ctx,request()),'CONTRACT_UNVERIFIABLE',409);
    const mismatched=createNativeTypedRead(store.asStore(),OWNER,{processEpoch:'epoch-1',registrySha256:'f'.repeat(64)});
    await refusal(mismatched.typedRead(ctx,request()),'CONTRACT_UNVERIFIABLE',409);
    expect(store.projectionCalls).toBe(0);
  });
});

test('revocation after projection discards the payload and finalizes REFUSED (IG3-REV-06)',async()=>{
  const {store,service}=fixture();
  const original=store.readSnapshot.bind(store);
  store.readSnapshot=(async(read:any)=>{const reply=await original(read);store.binding=version('teacher-a','rev-teacher-2',{...store.binding!.payload,state:'RETIRED' as const,assignmentState:knownK('INACTIVE' as const)});return reply;}) as typeof store.readSnapshot;
  await refusal(service.typedRead(ctx,request()),'PERMISSION_DENIED',403);
  expect(store.finalizations.at(-1)).toMatchObject({status:'REFUSED',refusalCode:'PERMISSION_DENIED'});
  expect(store.directFinalizeCalls).toBe(0);
});

describe('NG-A final gate horizon (W3-E1)',()=>{
  test('changed asserted class revision under the gate refuses without COMPLETED (W3-E1)',async()=>{
    const {store,service}=fixture();const original=store.commitReadOutput.bind(store);
    store.commitReadOutput=(async(r:any,p:any)=>original(r,async(view:any)=>p(new Proxy(view,{get(target:any,key:string){const value=Reflect.get(target,key);if(typeof value!=='function')return value;return async(...args:any[])=>{const out=await value(...args);if(key==='classGroups')return out.map((row:any)=>({...row,revisionId:'rev-class-after-preparation'}));return out;};}})))) as typeof store.commitReadOutput;
    await refusal(service.typedRead(ctx,request({expectedRevisions:[objectRef('ClassGroup','class-a','rev-class')]})),'REVISION_STALE',409);
    expect(store.finalizations.some(x=>x.status==='COMPLETED')).toBe(false);
    expect(store.finalizations.at(-1)?.status).toBe('REFUSED');
  });
  test('removed temporal membership under the gate never emits the old page (W3-E1)',async()=>{
    const {store,service}=fixture();const original=store.commitReadOutput.bind(store);
    store.commitReadOutput=(async(r:any,p:any)=>{store.temporals=[];return original(r,p);}) as typeof store.commitReadOutput;
    try{await service.typedRead(ctx,request());throw Error('expected final-gate refusal');}
    catch(error){expect(error).toBeInstanceOf(TypedReadRefusal);}
    expect(store.finalizations.some(x=>x.status==='COMPLETED')).toBe(false);
  });
});

describe('NG-A snapshot acquisition (SC1)',()=>{
  const SECRET='synthetic-owner-secret-for-tests';
  function acquiredFixture(){
    const {store}=fixture();
    const service=createNativeTypedRead(store.asStore(),OWNER,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:SECRET});
    return {store,service};
  }
  const acquireReq=(over:Record<string,unknown>={})=>({schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'acquire-1',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(testTemporal()),...over});
  test('CURRENT issues a sealed grant that round-trips; HISTORICAL refuses SNAPSHOT_UNAVAILABLE (SC1)',async()=>{
    const {service}=acquiredFixture();
    const acquired=await service.acquireSnapshot(ctx,acquireReq() as never);
    expect(acquired.schema).toBe('native-read-acquire-result.v2');
    expect(acquired.snapshot.registryVersion).toBe('1.1.0');
    expect(acquired.snapshot.consistency).toBe('SNAPSHOT');
    expect(acquired.planBinding).toMatch(/^[a-f0-9]{64}$/);
    expect((acquired as unknown as Record<string,unknown>).items).toBeUndefined();
    const historical=acquireReq({requestId:'acquire-hist',time:{mode:'HISTORICAL',asOf:'2026-10-24T00:00:00.000Z'}});
    await refusal(service.acquireSnapshot(ctx,historical as never),'SNAPSHOT_UNAVAILABLE',409);
  });
  test('acquired grant verifies snapshot/plan exactly; tamper refuses stale and grant alone grants no rights (SC1)',async()=>{
    const {store,service}=acquiredFixture();
    const acquired=await service.acquireSnapshot(ctx,acquireReq() as never);
    const readReq=request({snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission});
    const ok=await service.typedRead(ctx,readReq);
    expect(ok.kind).toBe('OK');
    const forgedProof=acquired.snapshotAdmission.proof.slice(0,-1)+(acquired.snapshotAdmission.proof.endsWith('A')?'B':'A');
    await refusal(service.typedRead(ctx,request({snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:{...acquired.snapshotAdmission,proof:forgedProof}})),'OBJECTSET_CURSOR_STALE',409);
    await refusal(service.typedRead(ctx,request({snapshot:{...acquired.snapshot,readRevision:'read-forged'},asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission})),'OBJECTSET_CURSOR_STALE',409);
    store.binding=version('teacher-a','rev-teacher-2',{...store.binding!.payload,state:'RETIRED' as const,assignmentState:knownK('INACTIVE' as const)});
    await refusal(service.typedRead(ctx,request({snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission})),'PERMISSION_DENIED',403);
  });
  test('acquired-to-prepare horizon drift refuses in FAIL_ON_CHANGE and SNAPSHOT with no egress (NG-FINAL-E1-ACQUIRED-HORIZON)',async()=>{
    for(const consistency of ['FAIL_ON_CHANGE','SNAPSHOT'] as const){
      const {store,service}=acquiredFixture();
      const acquired=await service.acquireSnapshot(ctx,acquireReq({requestId:'acquire-drift-'+consistency,consistency}) as never);
      // Whole-plan horizon drift after acquisition: binding head advances.
      store.binding=version('teacher-a','rev-teacher-drift',{...store.binding!.payload});
      // Keep teaching authorized so this case isolates horizon drift.
      store.temporals=store.temporals.map(v=>v.payload.bindingKind==='TEACHING_ASSIGNMENT'?{...v,payload:{...v.payload,targetRef:objectRef('Teacher','teacher-a','rev-teacher-drift')}}:v);
      await refusal(service.typedRead(ctx,request({snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission})),'OBJECTSET_CURSOR_STALE',409);
      expect(store.finalizations.some(x=>x.status==='COMPLETED')).toBe(false);
      expect(store.finalizations.at(-1)).toMatchObject({status:'REFUSED',snapshotDigest:null});
    }
  });
});


describe('F2 buffer lifetime at the owner commit boundary',()=>{
  test('encoding resource failure is a known refusal before terminal completion',async()=>{
    const f=fixture(),encode=TextEncoder.prototype.encode;
    TextEncoder.prototype.encode=function(input?:string){
      if(input?.startsWith('{"kind":"OK","contractVersion":"3.0.0"'))throw new RangeError('fictional encoder resource limit');
      return encode.call(this,input);
    };
    let result;
    try{result=await f.service.typedReadBuffered(ctx,request(),()=>true);}finally{TextEncoder.prototype.encode=encode;}
    expect(result!.status).toBe(409);
    expect(JSON.parse(new TextDecoder().decode(result!.body!)).error.code).toBe('OUTPUT_ADMISSION_BLOCKED');
    expect(f.store.finalizations.map(x=>x.status)).toEqual(['REFUSED']);
    expect(f.store.directFinalizeCalls).toBe(0);expect(f.store.commitCalls).toBe(1);
  });
  test('known owner refusal after preparation uses the gate-prepared generic error',async()=>{
    const f=fixture(),commit=f.store.commitReadOutput.bind(f.store);let prepared=false;
    f.store.commitReadOutput=async(r,prepare)=>commit(r,async view=>{
      const decision=await prepare(view);prepared=decision.kind==='OUTPUT_READY';
      return {kind:'OUTPUT_REFUSED',code:'horizon_drift'};
    });
    const result=await f.service.typedReadBuffered(ctx,request(),()=>true);
    expect(prepared).toBe(true);expect(result.status).toBe(409);
    const body=JSON.parse(new TextDecoder().decode(result.body!));
    expect(body.error.code).toBe('CONTRACT_UNVERIFIABLE');expect(body.items).toBeUndefined();
    expect(f.store.finalizations.map(x=>x.status)).toEqual(['REFUSED']);
  });
  test('an UNKNOWN commit discards successfully prepared bytes and never refinalizes or replays',async()=>{
    const f=fixture();f.store.commitTerminal='UNKNOWN';let encoded=false;
    const encode=TextEncoder.prototype.encode;
    TextEncoder.prototype.encode=function(input?:string){if(input?.startsWith('{"kind":"OK","contractVersion":"3.0.0"'))encoded=true;return encode.call(this,input);};
    const req=request();
    try{await refusal(f.service.typedReadBuffered(ctx,req,()=>true),'READ_UNRESOLVED',503);}finally{TextEncoder.prototype.encode=encode;}
    expect(encoded).toBe(true);expect(f.store.occurrenceStatus.get(req.requestId)).toBe('UNKNOWN');
    expect(f.store.commitCalls).toBe(1);expect(f.store.directFinalizeCalls).toBe(0);expect(f.store.finalizations).toEqual([]);
  });
});


test('F2 a lost commit acknowledgement discards prepared bytes without downgrading a completed occurrence',async()=>{
  const f=fixture(),commit=f.store.commitReadOutput.bind(f.store),req=request();
  f.store.commitReadOutput=async(r,prepare)=>{await commit(r,prepare);throw Error('fictional lost acknowledgement');};
  await refusal(f.service.typedReadBuffered(ctx,req,()=>true),'READ_UNRESOLVED',503);
  expect(f.store.occurrenceStatus.get(req.requestId)).toBe('COMPLETED');
  expect(f.store.finalizations.map(x=>x.status)).toEqual(['COMPLETED']);
  expect(f.store.commitCalls).toBe(1);expect(f.store.directFinalizeCalls).toBe(0);
});
