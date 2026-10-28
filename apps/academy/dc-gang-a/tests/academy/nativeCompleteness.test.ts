import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {canonicalJson,digest,known as legacyKnown} from '../../src/learning/model';
import {nativeProposalTexts,assertCompleteGrades} from '../../src/academy/nativeCompleteness';
import {createAcademySourceAudit} from '../../src/lms/academySourceAudit';
import {nativeBusinessDate,assertTeacherDate,computeReadHorizon} from '../../src/academy/nativePrerequisiteStore';
import {requestDigest,validateOwnerPayload,type OwnerAppendCommand,type ActivityScopeLink,type LessonSessionRecord,type NativeScoreEvidence,type OwnerVersion} from '../../src/academy/contracts/prerequisiteRecords';
import type {TeacherPrerequisiteReadStore} from '../../src/academy/ports/teacherStore';
import {PrerequisiteApplication} from '../../src/academy/prerequisiteApplication';
import {context,known,instant,objectRef} from './nativePrerequisiteContracts.test';
import {foundation,admitted,FictionalSql} from './nativePrerequisiteStore.test';
import {scene,retained} from './nativePrerequisitePort.test';

type Scene=Awaited<ReturnType<typeof scene>>;
/** Only synthetic retained rows are deliberately damaged to exercise the real source readers/validators. */
function revise(f:Scene,entity:string,change:(p:any)=>void){const row=f.sql.rows('record_versions').find(r=>r.entity_id===entity)!;const payload=structuredClone(row.payload);change(payload);row.payload=payload;row.content_digest=digest(payload);const body={ownerId:row.owner_id,studentId:row.student_id,entityId:row.entity_id,sequence:row.sequence,revisionId:row.revision_id,previousRevisionId:row.previous_revision_id,previousDigest:row.previous_digest,payload:row.payload,contentDigest:row.content_digest,sourceObservedAt:row.source_observed_at,recordedAt:row.recorded_at,actorId:row.actor_id,idempotencyKey:row.idempotency_key,commandDigest:row.command_digest};row.integrity_digest=digest(body);}
async function issue(f:Scene,label:string){const target=context('nf-consume-'+label),closure=await f.store.readSnapshot(v=>v.approvalClosurePreview(target,f.draftRef));const c={context:context('nf-issue-'+label),draftRef:f.draftRef,closure,validForSeconds:900};const proof=await (async()=>{await f.store.admitCommand({context:c.context,requestDigest:requestDigest('issueApproval',c)});return f.store.issueApproval(c);})();return {target,closure,proof};}
async function consume(f:Scene,i:Awaited<ReturnType<typeof issue>>){const c={context:i.target,draftRef:f.draftRef,approvalProofHandle:i.proof.proofHandle};return admitted(f.store,'consumeApprovalAndApproveDraft',c,()=>f.store.consumeApprovalAndApproveDraft(c));}
async function refused(f:Scene,code:string){const before=canonicalJson([f.sql.rows('record_heads'),f.sql.rows('approval_heads')]);await expect(f.store.readSnapshot(v=>v.approvalClosurePreview(context('nf-preview'),f.draftRef))).rejects.toThrow(code);expect(canonicalJson([f.sql.rows('record_heads'),f.sql.rows('approval_heads')])).toBe(before);}
async function stale(f:Scene,i:Awaited<ReturnType<typeof issue>>,code:string){const before=canonicalJson([f.sql.rows('record_heads'),f.sql.rows('approval_heads')]);await expect(consume(f,i)).rejects.toThrow(code);expect(canonicalJson([f.sql.rows('record_heads'),f.sql.rows('approval_heads')])).toBe(before);}

test('NF-01 positive: all eight native checks, explicit 3/7 score distinct from two correct grades and exact mechanical text',async()=>{
 const f=await scene();expect(f.attempt.payload.kind==='learning_work_attempt'&&f.attempt.payload.itemResults.every(x=>x.grade.state==='known'&&x.grade.value==='correct')).toBe(true);
 const evidence=await f.store.scoreEvidenceCurrent(context().ownerId,f.scoreResult.identity.nativeKey);expect(evidence!.payload.score).toEqual({earned:3,maximum:7});expect(await f.store.scoreEvidenceForAttempt(context().ownerId,f.scoreCommand.payload.attemptRef)).toHaveLength(1);
 expect(f.dc.payload.progressText.state==='known'&&f.dc.payload.progressText.value).toBe(nativeProposalTexts(f.proposalSources).progressText);
 const i=await issue(f,'eight-positive');expect(i.closure.dependencies.some(x=>x.ref.objectTypeId==='NativeScoreEvidence')).toBe(true);expect(i.closure.dependencies.some(x=>x.ref.objectKey===f.registration.entityId)).toBe(true);expect(i.closure.dependencies.some(x=>x.ref.objectKey===f.previous.identity.nativeKey)).toBe(true);expect((await consume(f,i)).sequence).toBe(2);
});
test('NF-01 refuses partial/ungraded/missing score or unsupported numeric scale; caller flags and prose are never evidence',async()=>{
 for(const scenario of ['partial','ungraded','score-missing','scale-unsupported','prose','flags'] as const){const f=await scene();
  if(scenario==='partial')revise(f,'attempt-current',p=>p.itemResults.pop());
  if(scenario==='ungraded')revise(f,'attempt-current',p=>p.itemResults[0].grade=legacyKnown('ungraded',['synthetic-grade']));
  if(scenario==='score-missing')f.sql.rows('native_score_evidence_heads').splice(0);
  if(scenario==='scale-unsupported'){const r=f.sql.rows('native_score_evidence_versions')[0]!,body=r.body as OwnerVersion<NativeScoreEvidence>;const payload={...body.payload,scale:{...body.payload.scale,version:'2.0.0'}};const {integrityDigest,...rest}=body;r.body={...rest,payload,contentDigest:digest(payload),integrityDigest:digest({...rest,payload,contentDigest:digest(payload)})};}
  if(scenario==='prose')revise(f,f.draftRef.identity.nativeKey,p=>p.progressText=known('All complete. Contradicts the exact source.'));
  if(scenario==='flags')revise(f,f.draftRef.identity.nativeKey,p=>p.completeness=true);
  await refused(f,scenario==='scale-unsupported'?'score_scale_unsupported':scenario==='flags'?'unexpected or missing domain fields':scenario==='prose'?'completeness_unverified_prose':'completeness_unknown');
 }
});
test('NF-01 refuses earlier due date, missing prior assessment, unknown applicability and mismatched exact content',async()=>{
 for(const scenario of ['bad-due','missing-assessment','unknown-origin','unknown-due','content-conflict','registration-missing'] as const){const f=await scene();
  if(scenario==='bad-due')revise(f,'homework-current',p=>p.dueDate=legacyKnown('2026-10-01',['synthetic-due']));
  if(scenario==='missing-assessment'){revise(f,f.draftRef.identity.nativeKey,p=>p.previousAssessmentRefs=known([]));f.sql.rows('record_heads').splice(f.sql.rows('record_heads').findIndex(r=>r.entity_id===f.assessmentResult.identity.nativeKey),1);f.sql.rows('activity_scope_heads').splice(f.sql.rows('activity_scope_heads').findIndex(h=>(f.sql.rows('activity_scope_versions').find(v=>v.entity_key===h.entity_key&&v.sequence===h.sequence)!.body as OwnerVersion<ActivityScopeLink>).payload.activityKind==='PREVIOUS_HOMEWORK_ASSESSMENT'),1);}
  if(scenario==='unknown-origin'){const h=f.sql.rows('activity_scope_heads'),index=h.findIndex(h=>(f.sql.rows('activity_scope_versions').find(v=>v.entity_key===h.entity_key&&v.sequence===h.sequence)!.body as OwnerVersion<ActivityScopeLink>).payload.activityRef.identity.nativeKey==='homework-origin');h.splice(index,1);}
  if(scenario==='unknown-due')revise(f,'homework-origin',p=>p.dueDate={state:'unknown',reason:'No due date evidence'});
  if(scenario==='content-conflict')revise(f,'homework-current',p=>p.items[0].sectionNodeId='book');
  if(scenario==='registration-missing')f.sql.rows('record_heads').splice(f.sql.rows('record_heads').findIndex(r=>r.entity_id==='registration'),1);
  await refused(f,scenario==='bad-due'?'completeness_source_conflict':scenario==='missing-assessment'?'PREVIOUS_HOMEWORK':scenario==='content-conflict'?'work_item_scope_conflict':'completeness_unknown');
 }
});
test('NF-02 prior origin link-only CAS is pinned; unavailable lesson/link and newly applicable obligation invalidate old proof',async()=>{
 for(const scenario of ['origin-link','lesson-unavailable','link-unavailable','new-obligation'] as const){const f=await scene(),i=await issue(f,scenario);const origin=(await f.store.activityScopes(context().ownerId,{})).find(x=>x.payload.activityRef.identity.nativeKey==='homework-origin')!;expect(i.closure.linkExpectations.some(x=>x.nativeLinkIdentity===origin.entityKey)).toBe(true);
  if(scenario==='origin-link'){const c={context:context('nf-origin-link'),entityKey:origin.entityKey,expectedRevisionId:origin.revisionId,payload:{...origin.payload,sourceLiteral:'Invented corrected source relationship'}};await admitted(f.store,'append:scope',c,()=>f.store.appendActivityScope(c));}
  if(scenario==='lesson-unavailable')f.sql.rows('lesson_heads').splice(f.sql.rows('lesson_heads').findIndex(x=>x.entity_key===f.previous.identity.nativeKey),1);
  if(scenario==='link-unavailable')f.sql.rows('activity_scope_heads').splice(f.sql.rows('activity_scope_heads').findIndex(x=>x.entity_key===origin.entityKey),1);
  if(scenario==='new-obligation'){const extra=retained(f.sql,'new-prior-obligation',{...f.original.payload,assignmentKey:{namespace:'synthetic_assignment',literalKey:'new-obligation'}} as typeof f.original.payload);await f.attach('HOMEWORK_ASSIGNMENT',objectRef('HomeworkAssignment',extra.entityId,extra.revisionId),f.previousScope);}
  await stale(f,i,scenario==='origin-link'?'approval_closure_mismatch':scenario==='lesson-unavailable'?'stale_source_revision':scenario==='new-obligation'?'PREVIOUS_HOMEWORK':'completeness_unknown');
 }
});
test('NF-05 valid other-lesson/class/date scope correction retains identity/history, rejects foreign student/owner/stale CAS and invalid scope',async()=>{
 const f=await scene(),i=await issue(f,'scope-correction'),old=(await f.store.activityScopes(context().ownerId,{})).find(x=>x.payload.activityRef.identity.nativeKey==='homework-origin')!;
 const correction={context:context('nf-move-scope'),entityKey:old.entityKey,expectedRevisionId:old.revisionId,payload:{...old.payload,recordScope:f.recordScope}};
 const moved=await admitted(f.store,'append:scope',correction,()=>f.store.appendActivityScope(correction));expect(moved.identity.nativeKey).toBe(old.entityKey);expect(moved.sequence).toBe(2);const history=await f.store.ownerHistory(context().ownerId,'scope',old.entityKey);expect(history.map(x=>x.revisionId)).toEqual([old.revisionId,moved.revisionId]);expect((await f.store.ownerRevision(context().ownerId,'scope',old.entityKey,old.revisionId))!.payload).toEqual(old.payload);
 await stale(f,i,'completeness_source_conflict');
 const staleCorrection={...correction,context:context('nf-stale-cas')};await expect(admitted(f.store,'append:scope',staleCorrection,()=>f.store.appendActivityScope(staleCorrection))).rejects.toThrow('revision_conflict');
 for(const scenario of ['student','owner','invalid-scope']){const c={...correction,context:{...context('nf-wrong-'+scenario),...(scenario==='owner'?{ownerId:'synthetic-other-owner',verifiedSession:{...context().verifiedSession,ownerId:'synthetic-other-owner'}}:{})},expectedRevisionId:moved.revisionId,payload:{...correction.payload,recordScope:{...f.recordScope,...(scenario==='student'?{studentRef:objectRef('Student','other-student')}:{businessDate:'2026-10-23'})}}};await expect(admitted(f.store,'append:scope',c,()=>f.store.appendActivityScope(c))).rejects.toThrow();}
});
test('NF-04 native Seoul calendar and half-open dated/undated attribution; caller sourceObservedAt cannot change authority date',async()=>{
 expect(nativeBusinessDate('2026-10-23T15:00:00.000Z')).toBe('2026-10-24');expect(nativeBusinessDate('2026-10-23T14:59:59.999Z')).toBe('2026-10-23');
 const f=await foundation(),p=(await f.store.teacherCurrent(context().ownerId,f.teacher.identity.nativeKey))!.payload;
 for(const date of ['2026-10-01','2026-10-23'])expect(()=>assertTeacherDate({...p,validFrom:'2026-10-01',validTo:'2026-10-24'},date)).not.toThrow();for(const date of ['2026-09-30','2026-10-24','2026-10-25'])expect(()=>assertTeacherDate({...p,validFrom:'2026-10-01',validTo:'2026-10-24'},date)).toThrow('teacher_binding_inactive');
 for(const interval of [{validFrom:'2026-10-25',validTo:null},{validFrom:'2026-01-01',validTo:'2026-10-24'}]){const s=await scene(),teacher=(await s.store.teacherCurrent(context().ownerId,s.teacher.identity.nativeKey))!;const {teacherKey,ownerId,...payload}=teacher.payload;const c={context:context('nf-change-validity'),entityKey:teacher.entityKey,expectedRevisionId:teacher.revisionId,payload:{...payload,...interval}};await admitted(s.store,'append:teacher',c,()=>s.store.appendTeacher(c));
  await refused(s,'teacher_binding_inactive');const cmd={context:{...context('nf-undated'),sourceObservedAt:'2026-10-01T00:00:00.000Z'},studentId:'student-a',expectedRevisionId:s.student.revisionId,payload:{kind:'student_record' as const,displayName:known('Invented'),enrollmentState:known('ACTIVE' as const)}};await expect(admitted(s.store,'append:student',cmd,()=>s.store.appendStudentRevision(cmd))).rejects.toThrow('teacher_binding_inactive');
 }
});
test('NF-06 closed historical reads return old ACTIVE teacher/links/ISSUED approval; historical reads grant no current attribution',async()=>{
 const f=await scene(),i=await issue(f,'history');await consume(f,i);const teacher=(await f.store.teacherCurrent(context().ownerId,f.teacher.identity.nativeKey))!,{teacherKey,ownerId,...payload}=teacher.payload;const retire={context:context('nf-retire-history'),entityKey:teacher.entityKey,expectedRevisionId:teacher.revisionId,payload:{...payload,state:'RETIRED' as const}};await admitted(f.store,'append:teacher',retire,()=>f.store.appendTeacher(retire));
 let escaped:TeacherPrerequisiteReadStore|undefined;await f.store.readSnapshot(async view=>{escaped=view;expect(Object.isFrozen(view)).toBe(true);expect((await view.ownerRevision(context().ownerId,'teacher',teacher.entityKey,teacher.revisionId))!.payload).toMatchObject({state:'ACTIVE'});expect((await view.ownerRevision(context().ownerId,'approval',i.proof.approvalId,i.proof.result.revisionId))!.payload).toMatchObject({state:'ISSUED'});expect(await view.ownerHistory(context().ownerId,'teacher',teacher.entityKey,1,1)).toHaveLength(1);expect(await view.ownerRevision('wrong-owner','teacher',teacher.entityKey,teacher.revisionId)).toBeNull();expect(await view.ownerRevision(context().ownerId,'class',teacher.entityKey,teacher.revisionId)).toBeNull();expect(await view.ownerRevision(context().ownerId,'teacher',teacher.entityKey,'unknown-revision')).toBeNull();await expect(view.ownerHistory(context().ownerId,'teacher',teacher.entityKey,0,1001)).rejects.toThrow('invalid_history_range');await expect(view.ownerRevision(context().ownerId,'driver' as any,teacher.entityKey,teacher.revisionId)).rejects.toThrow('owner_family_required');});
 for(const m of ['ownerRevision','ownerHistory','scoreEvidenceCurrent','scoreEvidenceForAttempt'] as const)await expect(Reflect.apply(escaped![m],escaped,[context().ownerId,'teacher','x','r'])).rejects.toThrow('read_snapshot_closed');
 const c={context:context('nf-after-retire'),studentId:'student-a',expectedRevisionId:f.student.revisionId,payload:{kind:'student_record' as const,displayName:known('Invented'),enrollmentState:known('ACTIVE' as const)}};await expect(admitted(f.store,'append:student',c,()=>f.store.appendStudentRevision(c))).rejects.toThrow('teacher_binding_inactive');
});
test('NF-03 all dependency writers acquire common owner protection before narrower locks/source reads',async()=>{
 const native=readFileSync(new URL('../../src/academy/nativePrerequisiteStore.ts',import.meta.url),'utf8'),legacy=readFileSync(new URL('../../src/academy/postgresStore.ts',import.meta.url),'utf8');
 const spans=[['registerStudent','students','input.ownerId'],['append','clinicRequest','command.ownerId'],['applySourceRefresh','admitSourceRequest','cohort.ownerId'],['applySourceArea','finishSourceAreas','ownerId'],['saveCatalog','catalog','ownerId']];
 for(const [start,end,owner] of spans){const body=legacy.slice(legacy.indexOf('  async '+start+'('),legacy.indexOf('  async '+end+'('));const lock=body.indexOf('await lockApprovalDependencies(tx,'+owner+')');expect(lock).toBeGreaterThan(0);const firstQuery=body.search(/await tx`(?:SELECT|INSERT|UPDATE)/);expect(lock).toBeLessThan(firstQuery);}
 expect(native.indexOf('await lockApprovalDependencies(tx,c.ownerId)')).toBeLessThan(native.indexOf('const admitted=await this.admission(tx,r)'));expect(legacy).toContain('await guardReservedAppend(tx,command.ownerId,command.actorId,command.idempotencyKey)');
 const f=await scene();const locks=f.sql.queries.filter(q=>q.text.includes('pg_advisory_xact_lock'));expect(locks.some(q=>String(q.values[0])===canonicalJson(['native-prerequisite-owner',context().ownerId]))).toBe(true);
});
test('NF-08 actual frozen source facade matches the repaired native literal exact whitelist; writers/driver rejected and every method expires',async()=>{
 const f=await foundation(),source=readFileSync(new URL('./teacherReadSnapshot.test.ts',import.meta.url),'utf8');const match=source.match(/Object\.keys\(snapshot\)\.sort\(\)\)\.toEqual\((\[[^\]]+\])\.sort\(\)\)/)!;expect(match).not.toBeNull();const expected=JSON.parse(match[1]!.replaceAll("'",'"')) as string[];
 let saved:TeacherPrerequisiteReadStore|undefined;await f.store.readSnapshot(async view=>{saved=view;expect(Object.isFrozen(view)).toBe(true);expect(Object.keys(view).sort()).toEqual(expected.sort());for(const writer of ['db','append','appendScoreEvidence','admitCommand','migrate','fenceCommand','finalizeReadOccurrence','commitReadOutput'])expect(writer in view).toBe(false);expect([...Object.keys(view),'append'].sort()).not.toEqual(expected.sort());});
 for(const key of Object.keys(saved!))await expect(Reflect.apply((saved as any)[key],saved,[])).rejects.toThrow('read_snapshot_closed');
 await expect(f.store.readSnapshot(async view=>{saved=view;throw Error('synthetic-expiry');})).rejects.toThrow('synthetic-expiry');for(const key of Object.keys(saved!))await expect(Reflect.apply((saved as any)[key],saved,[])).rejects.toThrow('read_snapshot_closed');expect(f.sql.queries.some(q=>q.text==='SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')).toBe(true);
});

test('NF-04 dated writes/issuer/consume use the occurrence date even after native calendar expiry; boundary creation refuses',async()=>{
 const f=await scene({validFrom:'2026-01-01',validTo:'2026-10-25'});f.sql.now='2026-10-26T00:00:00.000Z';const i=await issue(f,'historical-date');expect((await consume(f,i)).sequence).toBe(2);
 const undated={context:context('nf-expired-now'),studentId:'student-a',expectedRevisionId:f.student.revisionId,payload:{kind:'student_record' as const,displayName:known('Invented'),enrollmentState:known('ACTIVE' as const)}};await expect(admitted(f.store,'append:student',undated,()=>f.store.appendStudentRevision(undated))).rejects.toThrow('teacher_binding_inactive');
 for(const date of ['2025-12-31','2026-10-25']){const g=await foundation({validFrom:'2026-01-01',validTo:'2026-10-25'});const payload={kind:'lesson_session' as const,classGroupRef:g.recordScope.classGroupRef,businessDate:date,occurrenceOrdinal:known(2),startsAt:known(date+'T00:00:00.000Z'),endsAt:known(date+'T01:00:00.000Z'),teacherRefs:known([g.ref('Teacher',g.teacher)]),participantRefs:known([g.recordScope.studentRef]),lessonState:known('HELD' as const),synthetic:true};const c={context:context('nf-dated-boundary-'+date),entityKey:null,expectedRevisionId:null,payload};await expect(admitted(g.store,'append:lesson',c,()=>g.store.appendLesson(c))).rejects.toThrow('teacher_binding_inactive');}
});
test('NF-05 scope correction resolves a different real class and business date through declared native ports',async()=>{
 const f=await scene();const g={context:context('nf-other-class'),entityKey:null,expectedRevisionId:null,payload:{kind:'class_group' as const,displayName:known('Invented Other Class'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}};const group=await admitted(f.store,'append:class',g,()=>f.store.appendClassGroup(g));const classRef=f.ref('ClassGroup',group);
 const l={context:context('nf-other-class-lesson'),entityKey:null,expectedRevisionId:null,payload:{kind:'lesson_session' as const,classGroupRef:classRef,businessDate:'2026-10-22',occurrenceOrdinal:known(1),startsAt:known('2026-10-22T00:00:00.000Z'),endsAt:known('2026-10-22T01:00:00.000Z'),teacherRefs:known([f.ref('Teacher',f.teacher)]),participantRefs:known([f.recordScope.studentRef]),lessonState:known('HELD' as const),synthetic:true}};const lesson=await admitted(f.store,'append:lesson',l,()=>f.store.appendLesson(l));const lessonRef=f.ref('LessonSession',lesson);
 for(const [kind,from,to] of [['CLASS_MEMBERSHIP',f.recordScope.studentRef,classRef],['LESSON_PARTICIPATION',lessonRef,f.recordScope.studentRef],['TEACHING_ASSIGNMENT',classRef,f.ref('Teacher',f.teacher)]] as const){const c={context:context('nf-other-'+kind),entityKey:null,expectedRevisionId:null,payload:{kind:'temporal_binding' as const,bindingKind:kind,subjectRef:from,targetRef:to,validFrom:'2026-01-01',validTo:null,sourceLiteral:'Invented exact other class relation',synthetic:true}};await admitted(f.store,'append:binding',c,()=>f.store.appendTemporalBinding(c));}
 const old=(await f.store.activityScopes(context().ownerId,{})).find(x=>x.payload.activityRef.identity.nativeKey==='homework-origin')!,recordScope={...f.recordScope,classGroupRef:classRef,lessonRef,businessDate:'2026-10-22'},c={context:context('nf-other-class-correction'),entityKey:old.entityKey,expectedRevisionId:old.revisionId,payload:{...old.payload,recordScope}};
 const moved=await admitted(f.store,'append:scope',c,()=>f.store.appendActivityScope(c));expect((await f.store.ownerRevision(context().ownerId,'scope',old.entityKey,moved.revisionId))!.payload).toMatchObject({recordScope});expect((await f.store.ownerRevision(context().ownerId,'scope',old.entityKey,old.revisionId))!.payload).toEqual(old.payload);
});
test('NF-01/NF-02 exact score evidence correction has CAS/immutable history and invalidates pending proof',async()=>{
 const f=await scene(),i=await issue(f,'score-cas');const c={...f.scoreCommand,context:context('nf-score-correction'),entityKey:f.scoreResult.identity.nativeKey,expectedRevisionId:f.scoreResult.revisionId,payload:{...f.scoreCommand.payload,score:{earned:1,maximum:5},measurementLiteral:'Invented explicit revised measurement'}};const next=await admitted(f.store,'appendScoreEvidence',c,()=>f.store.appendScoreEvidence(c));expect(next.sequence).toBe(2);expect((await f.store.ownerRevision(context().ownerId,'evidence',next.identity.nativeKey,f.scoreResult.revisionId))!.payload).toMatchObject({score:{earned:3,maximum:7}});await stale(f,i,'completeness_unverified_prose');
 const staleCommand={...c,context:context('nf-score-stale')};await expect(admitted(f.store,'appendScoreEvidence',staleCommand,()=>f.store.appendScoreEvidence(staleCommand))).rejects.toThrow('revision_conflict');
 for(const score of [{earned:6,maximum:5},{earned:0,maximum:0},{earned:NaN,maximum:1}])expect(()=>validateOwnerPayload({...c.payload,score})).toThrow();expect(()=>validateOwnerPayload({...c.payload,complete:true} as NativeScoreEvidence)).toThrow();
});


test('native source enumeration preserves the existing normalized source-audit digest contract and still rejects corrupt envelopes',async()=>{
 const f=await scene(),acquisition={schemaVersion:1,family:'student_course',status:'observed',studentCourses:[],studentCourseScope:{teacherLabel:'Invented Teacher',studentKey:'91001',studentName:'Invented Student'},observedAt:instant,coverage:'observed_rows_not_all_assignments_or_pagination',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false};
 const payload={kind:'source_audit' as const,acquisition,contractRef:'synthetic-audit-contract'},audit=retained(f.sql,'normalized-source-audit',payload),contentDigest=createAcademySourceAudit(acquisition).contentDigest;expect(contentDigest).not.toBe(digest(payload));const row=f.sql.rows('record_versions').find(r=>r.entity_id===audit.entityId)!;const {integrityDigest,...body}=audit;row.content_digest=contentDigest;row.integrity_digest=digest({...body,contentDigest});
 const i=await issue(f,'native-audit-digest');row.content_digest='b'.repeat(64);await stale(f,i,'stored_revision_integrity');f.sql.rows('record_versions').find(r=>r.entity_id===audit.entityId)!.content_digest=contentDigest;const fresh=await issue(f,'native-audit-restored-new-occurrence');expect((await consume(f,fresh)).sequence).toBe(2);
});
test('SC4 activity-scope link revision drift refuses the final gate for the completeness scene',async()=>{
 const f=await scene();const owner=context().ownerId;
 const horizon=await f.store.readSnapshot(view=>computeReadHorizon(view,owner,context().actorId,f.recordScope.businessDate,[f.scoreCommand.payload.attemptRef]));
 const link=(await f.store.activityScopes(owner,{})).find(x=>x.payload.activityRef.identity.nativeKey==='homework-origin')!;
 const fix={context:context('sc4-completeness-link'),entityKey:link.entityKey,expectedRevisionId:link.revisionId,payload:{...link.payload,sourceLiteral:'Invented corrected completeness link'}};
 await admitted(f.store,'append:scope',fix,()=>f.store.appendActivityScope(fix));
 const request={ownerId:owner,actorId:context().actorId,requestId:'sc4-completeness-gate',runId:'synthetic-run',requestDigest:'a'.repeat(64),selectorDigest:'a'.repeat(64),processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0' as const,consumerProfile:'CURRENT_1_1' as const,consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};
 await f.store.admitReadOccurrence(request);
 expect(await f.store.commitReadOutput(request,async()=>({kind:'OUTPUT_READY',value:{items:['completeness-page']},horizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await f.store.readOccurrenceLookup(request)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift',snapshotDigest:null});
});
test('G4 terminal same-key CAS preserves source/history, emits one ABSENT relation and blocks all reattachment escapes',async()=>{
 const f=await scene(),owner=context().ownerId;
 const active=(await f.store.activityScopes(owner,{})).find(v=>v.payload.activityRef.identity.nativeKey===f.current.entityId)!;
 const beforeSource=await f.store.history(owner,'student-a',f.current.entityId);
 const invalid={context:context('g4-modified-lineage'),entityKey:active.entityKey,expectedRevisionId:active.revisionId,payload:{...active.payload,state:'DETACHED' as const,sourceLiteral:'changed forbidden lineage'}};
 await expect(admitted(f.store,'append:scope',invalid,()=>f.store.appendActivityScope(invalid))).rejects.toThrow('activity_scope_terminal_payload_changed');
 const detach={context:context('g4-terminal'),entityKey:active.entityKey,expectedRevisionId:active.revisionId,payload:{...active.payload,state:'DETACHED' as const}};
 const terminal=await admitted(f.store,'append:scope',detach,()=>f.store.appendActivityScope(detach));
 expect(terminal.identity.nativeKey).toBe(active.entityKey);expect(terminal.sequence).toBe(active.sequence+1);
 expect(terminal.receipt.changed[0]!.after).toEqual({scheme:'OWNER_REVISION',value:terminal.revisionId});
 expect(terminal.receipt.changedLinks).toHaveLength(1);
 expect(terminal.receipt.changedLinks[0]).toMatchObject({nativeLinkIdentity:active.entityKey,before:{scheme:'OWNER_REVISION',value:active.revisionId},after:'ABSENT'});
 const history=await f.store.ownerHistory(owner,'scope',active.entityKey);
 expect(history.map(row=>row.revisionId)).toEqual([active.revisionId,terminal.revisionId]);
 expect(history[0]!.payload).toEqual(active.payload);expect(history[1]!.previousRevisionId).toBe(active.revisionId);
 expect(history[1]!.previousDigest).toBe(active.integrityDigest);
 expect(await f.store.history(owner,'student-a',f.current.entityId)).toEqual(beforeSource);
 for(const [name,key,ref] of [['same-key',active.entityKey,active.payload.activityRef],['new-key',null,active.payload.activityRef],['different-revision',null,{...active.payload.activityRef,revision:f.current.revisionId}]] as const){
   const c={context:context('g4-reattach-'+name),entityKey:key,expectedRevisionId:key?terminal.revisionId:null,payload:{...active.payload,state:'ACTIVE' as const,activityRef:ref}};
   await expect(admitted(f.store,'append:scope',c,()=>f.store.appendActivityScope(c))).rejects.toThrow('activity_scope_terminal');
 }
 const stale={...detach,context:context('g4-competing-stale')};
 await expect(admitted(f.store,'append:scope',stale,()=>f.store.appendActivityScope(stale))).rejects.toThrow('revision_conflict');
 const issueContext=context('g4-terminal-approval');
 await expect(f.store.readSnapshot(view=>view.approvalClosurePreview(issueContext,f.draftRef))).rejects.toThrow('scope_conflict');
 expect((await f.store.ownerHistory(owner,'scope',active.entityKey))).toHaveLength(2);
});

test('NF-07 a Student revision refuses other owner payload families and leaves the Student head untouched',async()=>{
 const f=await scene(),before=canonicalJson(f.sql.rows('record_heads'));
 const body=f.sql.rows('class_versions')[0]!.body,classPayload=structuredClone((typeof body==='string'?JSON.parse(body):body).payload);
 const c={context:context('nf-wrong-family'),studentId:'student-a',expectedRevisionId:f.student.revisionId,payload:classPayload};
 await expect(admitted(f.store,'append:student',c,()=>f.store.appendStudentRevision(c))).rejects.toThrow('invalid_student_payload_kind');
 expect(canonicalJson(f.sql.rows('record_heads'))).toBe(before);
});
test('NF-08 prerequisite reads enforce the teacher binding dated validity, like writes',async()=>{
 const f=await foundation(),ctx={ownerId:context().ownerId,actorId:context().actorId,role:'teacher' as const};
 await expect(new PrerequisiteApplication(f.store,ctx.ownerId,()=>'2025-12-30T00:00:00.000Z').classGroups(ctx)).rejects.toThrow('teacher_binding_inactive');
 expect(await new PrerequisiteApplication(f.store,ctx.ownerId,()=>'2026-10-24T00:00:00.000Z').classGroups(ctx)).toHaveLength(1);
});
test('NF-09 each named student-record operation stores only its own payload kind',async()=>{
 const f=await scene(),row=f.sql.rows('record_versions').find(r=>(r.payload as {kind?:string}).kind==='daily_progress')!;
 const c={context:context('nf-kind'),studentId:String(row.student_id),payload:structuredClone(row.payload) as never};
 await expect(admitted(f.store,'createAssessment',c,()=>f.store.createAssessment(c))).rejects.toThrow('invalid_student_payload_kind');
});
test('NF-10 named correction operations accept only their own payload kind',async()=>{
 const f=await foundation(),ctx={ownerId:context().ownerId,actorId:context().actorId,role:'teacher' as const},app=new PrerequisiteApplication(f.store,ctx.ownerId);
 await expect(app.correctProgress(ctx,{payload:{kind:'daily_record_draft'}} as never)).rejects.toThrow('invalid_student_payload_kind');
 await expect(app.correctAssessment(ctx,{payload:{kind:'daily_progress'}} as never)).rejects.toThrow('invalid_student_payload_kind');
 await expect(app.updateDraft(ctx,{payload:{kind:'previous_homework_assessment'}} as never)).rejects.toThrow('invalid_student_payload_kind');
});
test('NF-11 an unknown business timezone is a closed input refusal',async()=>{
 const f=await scene(),body=f.sql.rows('class_versions')[0]!.body,payload=structuredClone((typeof body==='string'?JSON.parse(body):body).payload);
 payload.businessTimezone={...payload.businessTimezone,value:'Mars/Olympus'};
 expect(()=>validateOwnerPayload(payload)).toThrow('invalid_business_timezone');
});
