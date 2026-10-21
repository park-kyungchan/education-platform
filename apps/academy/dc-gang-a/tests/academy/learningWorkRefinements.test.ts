import {describe,expect,test} from 'bun:test';
import {TeacherApplication} from '../../src/academy/application';
import {projectLearningWork} from '../../src/academy/learningWorkProjection';
import {assessmentScoreBasis,assertAssignmentNotReplaced,assertReplacementGraph,replacementPredecessor,type AssignmentVersion,type AttemptVersion} from '../../src/academy/learningWorkBindings';
import {teacherActivitySummary,validateTeacherWorkspace,workspaceEntityId,assertActivityReviewAttemptBinding,type TeacherActivityReview} from '../../src/academy/teacherWorkspace';
import {validateAcademyRecord,type AcademyRecord,type SourceBookRegistration} from '../../src/academy/records';
import {validateLearningAttempt,type LearningWorkAssignment,type LearningWorkAttempt} from '../../src/academy/learningWork';
import type {RecordVersion,CurrentRecord,StoredStudent} from '../../src/academy/contracts/storageRecords';
import type {StudentWorkspaceVersion} from '../../src/academy/ownerWorkspaceStore';
import type {TeacherStore,TeacherReadStore} from '../../src/academy/ports/teacherStore';
import {academyConnectionStatus} from '../../src/academy/nativeConnector';
import {createAcademySourceAudit} from '../../src/lms/academySourceAudit';
import {classroomCyclePolicy} from '../../src/academy/classroomCyclePolicy';
import {canonicalJson,digest,known,unknown} from '../../src/learning/model';
import {exactWorkFixture,exactAttemptFixture} from './learningWorkFixtures';

const owner='synthetic-dom02-owner',studentId='synthetic-dom02-student',time='2090-01-02T00:00:00.000Z',date='2090-01-03';
function version<T extends AcademyRecord>(payload:T,entityId:string,revisionId:string,sequence=1):RecordVersion&{payload:T}{
 const contentDigest=payload.kind==='source_audit'?createAcademySourceAudit(payload.acquisition).contentDigest:digest(payload);
 const body={ownerId:owner,studentId,entityId,sequence,revisionId,previousRevisionId:null,previousDigest:null,payload,contentDigest,sourceObservedAt:time,recordedAt:time,actorId:'synthetic-teacher',idempotencyKey:revisionId,commandDigest:'synthetic-command'};
 return {...body,integrityDigest:digest(body)};
}
function fixture(score=100){
 const payload:LearningWorkAssignment={...exactWorkFixture(),activity:'daily_test',effectiveDate:'2090-01-02',paper:known({...((exactWorkFixture().paper as any).value),paperKey:{namespace:'academy_textbook_paper',literalKey:'51001'}},['synthetic-paper-identity'])};
 const work=version(payload,'work-A','work-A-r1');
 const source=version({kind:'source_audit' as const,contractRef:'synthetic-exact-textbook-source',acquisition:{schemaVersion:1,family:'textbook',status:'observed',records:[{studentKey:'91001',studentName:'Invented DOM02 Learner',courseKey:'92001',bookNo:'94001',paperKey:'51001',attemptKey:'41001',sourceTitle:'Invented assessment',score,items:[{originalOrdinal:'1',lectureKey:'31001',outerLectureKey:'21001',scoring:'O'}],sourceDate:{literal:'01-02',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}}],dailyResults:[],dayRecords:[],observedAt:time,coverage:'exact_selected_existing_records_not_whole_book',unknownStates:['teacher_acceptance_unknown'],nativePrintInvoked:false,automaticRetryAllowed:false}},'source-A','source-A-r1');
 const attempt=version<LearningWorkAttempt>({...exactAttemptFixture(),assignmentRevisionId:work.revisionId,attemptKey:{namespace:'academy_textbook_attempt',literalKey:'41001'},assessmentBasis:known({sourceAuditRevisionId:source.revisionId,paperKey:'51001',attemptKey:'41001'},['synthetic-exact-source-crosswalk']),evidenceRefs:[source.revisionId]},'attempt-A','attempt-A-r1');
 const catalog=payload.catalogRefs.map((ref,index)=>({revisionId:ref.revisionId,node:{id:ref.nodeId,kind:({book:'book_edition',major:'major_unit',middle:'middle_unit',minor:'minor_unit',section:'learning_section',page:'printed_page','problem-1':'problem','problem-2':'problem'} as const)[ref.nodeId]!,sourceKey:ref.nodeId==='book'?payload.sourceBook:{namespace:'synthetic_catalog',literalKey:ref.nodeId},label:'Invented '+ref.nodeId,parent:index===0?unknown<string>('Root'):known(index>=6?'page':['book','major','middle','minor','section'][index-1]!,['synthetic-parent'])}}));
 const rows=[work,attempt,source];
 const project=(selected:RecordVersion[]=rows,heads:RecordVersion[]=selected,reviews:StudentWorkspaceVersion[]=[])=>projectLearningWork(studentId,payload.sourceStudent,date,selected,heads,catalog,reviews);
 return {payload,work,source,attempt,catalog,rows,project};
}
function review(f:ReturnType<typeof fixture>,bound=false):TeacherActivityReview {
 return {kind:'teacher_activity_review',studentBinding:{studentId,sourceStudent:f.payload.sourceStudent},sourceStudent:f.payload.sourceStudent,reportedAt:time,evidenceRevisionIds:[f.work.revisionId,...(bound?[f.attempt.revisionId]:[])],assignmentRevisionId:f.work.revisionId,selectedItemIds:f.payload.items.map(i=>i.assignedItemId),coverage:'whole_assigned_items',originalScore:100,originalWrong:'not_applicable',similarPrinted:'unknown',similar:'unknown',appEntry:'not_entered',paper:{issuance:f.payload.paper,corrections:[]},video:{upload:'unknown',reference:'',review:'not_reviewed',note:''},mindmap:{state:'not_requested',note:'',explanation:null},final:{decision:'accepted',checkedSolutionAndUnderstanding:true,note:'Invented explicit scoped teacher final'},...(bound?{attemptBinding:known({attemptEntityId:f.attempt.entityId,attemptRevisionId:f.attempt.revisionId},[f.attempt.revisionId])}:{})};
}
function reviewVersion(payload:TeacherActivityReview):StudentWorkspaceVersion {
 const body={ownerId:owner,studentId,entityId:workspaceEntityId(payload),sequence:1,revisionId:'synthetic-review-'+digest(payload),previousRevisionId:null,previousDigest:null,payload,contentDigest:digest(payload),recordedAt:time,actorId:'synthetic-teacher',idempotencyKey:'synthetic-review-intent',commandDigest:'synthetic-command'};return {...body,integrityDigest:digest(body)};
}

describe('DOM-02 exact assessment default targets',()=>{
 test('verified exact100 excludes BOTH defaults while scores, teacher review, explicit assignments and payload digests stay independent',()=>{
  const f=fixture(),before=canonicalJson(f.rows),explicit=version({...f.payload,assignmentKey:{namespace:'fixture_assignment',literalKey:'explicit-later'},activity:'similar_clinic',effectiveDate:'2090-01-03'} as LearningWorkAssignment,'explicit-later','explicit-later-r1');
  const projected=f.project([...f.rows,explicit]),attempt=projected.assignments[0]!.attempts[0]!;
  expect(attempt.defaultClinicTargets).toEqual({wrong:'excluded_exact_100',similar:'excluded_exact_100'});expect(attempt.completed).toBe(false);
  expect(attempt.scoreBasis.state).toBe('known');if(attempt.scoreBasis.state==='known'){expect(attempt.scoreBasis.value.score).toBe(100);expect(attempt.scoreBasis.value.teacherReview).toBe('not_inferred');expect(attempt.scoreBasis.value.finalCompletion).toBe('not_inferred');}
  expect(projected.currentObligations.map(row=>row.assignmentRevisionId)).toContain(explicit.revisionId);expect(attempt.items[0]!.sourceGrade).toEqual(f.attempt.payload.itemResults[0]!.grade);expect(canonicalJson(f.rows)).toBe(before);
 });
 test.each([0,99,99.999])('score%s never auto-assigns a clinic or closes teacher review, even with zero source wrong items',score=>{
  const f=fixture(score),target=f.project().assignments[0]!.attempts[0]!;expect(target.defaultClinicTargets).toEqual({wrong:'requires_teacher_selection',similar:'requires_teacher_selection'});expect(target.completed).toBe(false);
 });
 test('legacy and explicit unknown bindings remain accepted without inserting new fields',()=>{
  const f=fixture(),legacy={...f.attempt.payload};delete legacy.assessmentBasis;legacy.attemptKey={namespace:'fixture_attempt',literalKey:'legacy'};const old=version(legacy,'attempt-A','attempt-A-r1'),bytes=canonicalJson(old);
  validateLearningAttempt(legacy);const view=f.project([f.work,old,f.source]).assignments[0]!.attempts[0]!;expect(view.defaultClinicTargets.wrong).toBe('unknown');expect(view.defaultClinicTargets.similar).toBe('unknown');expect(canonicalJson(old)).toBe(bytes);expect(Object.hasOwn(legacy,'assessmentBasis')).toBe(false);
 });
 test.each(['wrong-attempt','wrong-student','wrong-book','wrong-course','wrong-paper','ambiguous','blocked'])('source %s cannot exclude targets',kind=>{
  const f=fixture(),bad=structuredClone(f.source),snapshot=bad.payload.acquisition as any,row=snapshot.records[0];
  if(kind==='wrong-attempt')row.attemptKey='41002';if(kind==='wrong-student')row.studentKey='91002';if(kind==='wrong-book')row.bookNo='94002';if(kind==='wrong-course')row.courseKey='92002';if(kind==='wrong-paper')row.paperKey='51002';if(kind==='ambiguous')snapshot.records.push(structuredClone(row));if(kind==='blocked')snapshot.status='blocked';
  const view=f.project([f.work,f.attempt,bad]).assignments[0]!.attempts[0]!;expect(view.scoreBasis.state).toBe('unknown');expect(view.defaultClinicTargets.wrong).toBe('unknown');expect(view.defaultClinicTargets.similar).toBe('unknown');
 });
 test('old source/attempt heads, paper namespaces and mismatched attempt binding stay unknown',()=>{
  const f=fixture();expect(assessmentScoreBasis(f.work,f.attempt,f.rows,[f.work,f.attempt]).state).toBe('unknown');expect(assessmentScoreBasis(f.work,f.attempt,f.rows,[f.work,f.source]).state).toBe('unknown');
  const wrong=version({...f.payload,paper:known({...((f.payload.paper as any).value),paperKey:{namespace:'other-paper-namespace',literalKey:'51001'}},['synthetic'])},'work-A',f.work.revisionId);
  expect(assessmentScoreBasis(wrong,f.attempt,[wrong,f.attempt,f.source],[wrong,f.attempt,f.source]).state).toBe('unknown');
  const payload={...f.attempt.payload,attemptKey:{namespace:'other-attempt-namespace',literalKey:'41001'}};expect(()=>validateLearningAttempt(payload)).toThrow('assessment_attempt_binding_conflict');
 });
 test('a schema-valid score mutation with the original source digest cannot become verified100',()=>{
  const f=fixture(90),tampered=structuredClone(f.source);(tampered.payload.acquisition as any).records[0].score=100;
  const attempt=f.project([f.work,f.attempt,tampered]).assignments[0]!.attempts[0]!;expect(attempt.scoreBasis.state).toBe('unknown');expect(attempt.defaultClinicTargets.similar).toBe('unknown');expect(tampered.contentDigest).toBe(f.source.contentDigest);
 });
});

describe('DOM-02 attempt-specific teacher originals and paper stages',()=>{
 test('legacy final remains assignment-scoped; exact new review binds one attempt without promoting every attempt',()=>{
  const f=fixture(),legacy=review(f),exact=review(f,true),oldBytes=canonicalJson(legacy);validateTeacherWorkspace(legacy);validateTeacherWorkspace(exact);
  expect(teacherActivitySummary(legacy).attemptBinding.state).toBe('unknown');expect(teacherActivitySummary(legacy).learning).toBe('teacher_finalized_assigned_items');expect(workspaceEntityId(exact)).not.toBe(workspaceEntityId(legacy));
  const rv=reviewVersion(exact),other=version({...f.attempt.payload,attemptKey:{namespace:'fixture_attempt',literalKey:'another'},assessmentBasis:unknown('Another occurrence has no exact source')},'attempt-B','attempt-B-r1');
  const view=f.project([...f.rows,other],undefined,[reviewVersion(legacy),rv]).assignments[0]!;
  expect(view.activityReviews).toHaveLength(2);expect(view.attempts.find(a=>a.record.entityId==='attempt-A')!.activityReviews).toHaveLength(1);expect(view.attempts.find(a=>a.record.entityId==='attempt-B')!.activityReviews).toHaveLength(0);expect(view.attempts.every(a=>a.completed===false)).toBe(true);expect(canonicalJson(legacy)).toBe(oldBytes);
 });
 test('grade revision preserves final for its prior exact revision and cannot inherit its inspection',()=>{
  const f=fixture(),rv=reviewVersion(review(f,true)),next=version({...f.attempt.payload},'attempt-A','attempt-A-r2',2);
  const view=f.project([...f.rows,next],[f.work,next,f.source],[rv]).assignments[0]!;expect(view.activityReviews[0]!.record.payload).toEqual(rv.payload);expect(view.attempts[0]!.activityReviews).toHaveLength(0);expect(view.attempts[0]!.completed).toBe(false);
 });
 test('review cutoff follows the academy business date without rewriting its original report clock',()=>{
  const f=fixture(),r=review(f,true);r.reportedAt='2090-01-03T16:00:00Z';const row=reviewVersion(r),before=canonicalJson(row);
  expect(f.project(undefined,undefined,[row]).assignments[0]!.activityReviews).toHaveLength(0);
  expect(projectLearningWork(studentId,f.payload.sourceStudent,'2090-01-04',f.rows,f.rows,f.catalog,[row]).assignments[0]!.activityReviews).toHaveLength(1);expect(canonicalJson(row)).toBe(before);
 });
 test.each(['missing','assignment','student','owner','entity','revision','item','issuance'])('new exact review refuses %s scope drift using the transaction guard',drift=>{
  const f=fixture(),r=review(f,true),attempt=structuredClone(f.attempt);let selected:AttemptVersion|null=attempt;
  if(drift==='missing')selected=null;if(drift==='assignment')attempt.payload.assignmentRevisionId='other';if(drift==='student')attempt.studentId='other';if(drift==='owner')attempt.ownerId='other';if(drift==='entity')attempt.entityId='other';if(drift==='revision')attempt.revisionId='other';if(drift==='item')r.selectedItemIds=['foreign-item'];if(drift==='issuance')attempt.payload.paperIssuanceKey={namespace:'fixture_issuance',literalKey:'other'};
  expect(()=>assertActivityReviewAttemptBinding(r,f.work,selected)).toThrow('workspace_attempt_binding_conflict');
 });
 test('known attempt source is evidence-bound and independent of a teacher-reported score',()=>{
  const f=fixture(),r=review(f,true);r.evidenceRevisionIds=[f.work.revisionId];expect(()=>validateTeacherWorkspace(r)).toThrow('workspace_attempt_evidence_required');r.evidenceRevisionIds.push(f.attempt.revisionId);r.originalScore=40;r.originalWrong='potentially_applicable';validateTeacherWorkspace(r);expect(f.project(undefined,undefined,[reviewVersion(r)]).assignments[0]!.attempts[0]!.scoreBasis.state).toBe('known');
 });
 test('distribution and print are independent observed stages; paper identity alone establishes neither',()=>{
  const f=fixture(),r=review(f,true),before=canonicalJson(r),initial=teacherActivitySummary(r);expect(initial.paperStages.printed.state).toBe('unknown');expect(initial.paperStages.distributed.state).toBe('unknown');expect(canonicalJson(r)).toBe(before);
  r.paper.stages={printed:unknown('Not observed'),distributed:known({issuanceKey:(f.payload.paper as any).value.issuanceKey,state:'done',observedAt:time},['synthetic-distribution-report'])};validateTeacherWorkspace(r);const summary=teacherActivitySummary(r);expect(summary.paperStages.printed.state).toBe('unknown');expect(summary.paperStages.distributed.state).toBe('known');expect(summary.appRecord).toBe('not_entered');expect(r.paper.issuance).toEqual(f.payload.paper);
  r.final={decision:'pending',checkedSolutionAndUnderstanding:false,note:''};validateTeacherWorkspace(r);expect(teacherActivitySummary(r).learning).toBe('unknown');
 });
 test('known print never proves distribution; foreign issuance and future stage observations are refused',()=>{
  const f=fixture(),r=review(f,true);r.paper.stages={printed:known({issuanceKey:(f.payload.paper as any).value.issuanceKey,state:'done',observedAt:time},['synthetic-print-report']),distributed:unknown('Not observed')};validateTeacherWorkspace(r);expect(teacherActivitySummary(r).paperStages.distributed.state).toBe('unknown');
  r.paper.stages.printed=known({issuanceKey:{namespace:'fixture_issuance',literalKey:'foreign'},state:'done',observedAt:time},['synthetic']);expect(()=>validateTeacherWorkspace(r)).toThrow('workspace_paper_stage_binding_conflict');
  r.paper.stages.printed=known({issuanceKey:(f.payload.paper as any).value.issuanceKey,state:'done',observedAt:'2090-01-04T00:00:00Z'},['synthetic']);expect(()=>validateTeacherWorkspace(r)).toThrow('workspace_paper_stage_binding_conflict');
 });
});

describe('DOM-02 replacement/withdrawal lineage',()=>{
 function successor(f:ReturnType<typeof fixture>,id='work-B'){return version({...f.payload,assignmentKey:{namespace:'fixture_assignment',literalKey:id},effectiveDate:'2090-01-03',replaces:known({assignmentRevisionId:f.work.revisionId},[f.work.revisionId]),evidenceRefs:[...f.payload.evidenceRefs,f.work.revisionId]},id,id+'-r1');}
 test('validated exact replacement removes only its predecessor from active obligations, retaining history and originals',()=>{
  const f=fixture(),next=successor(f),before=canonicalJson(f.work);validateAcademyRecord(next.payload);assertReplacementGraph([f.work,next]);
  const view=f.project([...f.rows,next]);expect(view.currentObligations.map(row=>row.assignmentRevisionId)).toEqual([next.revisionId]);expect(view.assignments[0]!.obligationState).toBe('replaced');expect(view.assignments[0]!.writable).toBe(false);expect(view.assignments[0]!.attempts[0]!.record).toEqual(f.attempt);expect(canonicalJson(f.work)).toBe(before);
  expect(()=>assertAssignmentNotReplaced(f.work,[next],date)).toThrow('work_assignment_replaced');expect(()=>assertAssignmentNotReplaced(f.work,[next],'2090-01-02')).not.toThrow();
 });
 test('withdrawal does not resurrect its replaced predecessor; a later distinct predecessor revision is not silently cancelled',()=>{
  const f=fixture(),next=successor(f),withdrawn=version({...next.payload,status:'withdrawn'},next.entityId,'work-B-r2',2);
  const view=f.project([...f.rows,next,withdrawn]);expect(view.currentObligations).toEqual([]);expect(view.assignments[1]!.archived[0]!.record).toEqual(next);
  const later=version({...f.payload,effectiveDate:'2090-01-03'},f.work.entityId,'work-A-r2',2);expect(f.project([...f.rows,next,later]).currentObligations.map(row=>row.assignmentRevisionId)).toContain(later.revisionId);
 });
 test('a future successor revision cannot hide an already-effective replacement from transaction guards',()=>{
  const f=fixture(),next=successor(f),future=version({...next.payload,status:'withdrawn',effectiveDate:'2090-01-04'},next.entityId,'work-B-r2',2);
  expect(()=>assertAssignmentNotReplaced(f.work,[next,future],date)).toThrow('work_assignment_replaced');expect(f.project([...f.rows,next,future]).assignments[0]!.obligationState).toBe('replaced');
 });
 test.each(['unknown','missing','foreign-book','foreign-student','foreign-owner','self'])('%s replacement cannot create a false cancellation',kind=>{
  const f=fixture(),next=successor(f);if(kind==='unknown')next.payload.replaces=unknown('Not linked');if(kind==='missing')next.payload.replaces=known({assignmentRevisionId:'absent'},['synthetic']);if(kind==='foreign-book')next.payload.sourceBook={namespace:'academy_book',literalKey:'94002'};if(kind==='foreign-student')next.payload.sourceStudent={namespace:'academy_student',literalKey:'91002'};if(kind==='foreign-owner')next.ownerId='foreign';if(kind==='self')next.entityId=f.work.entityId;
  if(kind==='foreign-student'){expect(()=>f.project([...f.rows,next])).toThrow('work_context_scope_conflict');return;}
  if(kind!=='unknown')expect(()=>replacementPredecessor(next,[f.work])).toThrow('work_replacement_binding_conflict');
  if(kind!=='self')expect(f.project([...f.rows,next]).currentObligations.map(row=>row.assignmentRevisionId)).toContain(f.work.revisionId);
 });
 test('entity cycles and ambiguous competing successors are rejected by guards and never cancel read obligations',()=>{
  const f=fixture(),b=successor(f),a2=version({...f.payload,effectiveDate:'2090-01-03',replaces:known({assignmentRevisionId:b.revisionId},[b.revisionId]),evidenceRefs:[...f.payload.evidenceRefs,b.revisionId]},f.work.entityId,'work-A-r2',2);
  expect(()=>assertReplacementGraph([f.work,b,a2])).toThrow('work_replacement_cycle');expect(f.project([...f.rows,b,a2]).currentObligations).toHaveLength(2);
  const c=successor(f,'work-C');expect(()=>assertReplacementGraph([f.work,b,c])).toThrow('work_replacement_ambiguous');expect(f.project([...f.rows,b,c]).currentObligations).toHaveLength(3);
 });
});

test('actual TeacherApplication composes the refinements through its scoped readSnapshot without acquiring source or rewriting records',async()=>{
 const f=fixture(),registration=version<SourceBookRegistration>({kind:'source_book_registration',sourceStudent:f.payload.sourceStudent,sourceCourse:f.payload.sourceCourse,sourceUserCourse:f.payload.sourceUserCourse,sourceBook:f.payload.sourceBook,catalogNodeId:'book',sourceCourseLabel:'Invented course',sourceBookLabel:'Invented book',sourceStatus:'Invented active',sourceProgressLiteral:'Unknown',sourceLearningRangeLiteral:'Unknown',assignmentValidity:unknown('Not enrollment evidence'),role:unknown('Not declared'),contractRef:'synthetic-registration',evidenceRefs:['synthetic']},'registration',f.payload.registrationRevisionId),reviewRow=reviewVersion(review(f,true));
 const all=[...f.rows,registration],before=canonicalJson([all,reviewRow]);let snapshots=0,writes=0;
 const student:StoredStudent={ownerId:owner,id:studentId,displayName:'Invented DOM02 Learner',sourceKey:f.payload.sourceStudent,proofRefs:['synthetic'],registeredAt:time};
 const read:TeacherReadStore={students:async()=>[student],current:async()=>all.map(row=>({...row,lastVerifiedAt:time})) as CurrentRecord[],history:async()=>[],preparationRevisions:async()=>[f.work,f.attempt],catalog:async()=>f.catalog.map(row=>row.node),pinnedCatalog:async()=>f.catalog,observationRequest:async()=>null,observationResult:async()=>null,clinicRequest:async()=>null,clinicResult:async()=>null,studentWorkspaces:async()=>[reviewRow]};
 const store:TeacherStore={...read,readSnapshot:async callback=>{snapshots++;return callback(read);},append:async()=>{writes++;throw Error('not_admitted');}};
 const app=new TeacherApplication(store,owner,()=>academyConnectionStatus),scene=await app.student({ownerId:owner,actorId:'synthetic-teacher',role:'teacher'},studentId,date);
 expect(snapshots).toBe(1);expect(writes).toBe(0);expect(scene.workContext.data.exactWork.assignments[0]!.attempts[0]!.defaultClinicTargets.similar).toBe('excluded_exact_100');expect(scene.workContext.data.exactWork.assignments[0]!.attempts[0]!.activityReviews[0]!.record.revisionId).toBe(reviewRow.revisionId);expect(scene.knowledge.sourceFreshness).toBe('last_successful_acquisition_not_view_time');expect(canonicalJson([all,reviewRow])).toBe(before);
 await expect(app.student({ownerId:'foreign',actorId:'synthetic-teacher',role:'teacher'},studentId,date)).rejects.toThrow();expect(snapshots).toBe(1);
});

test('a replaced-target refusal retains the actual clinic request original and its terminal outcome without retrying a decision',async()=>{
 const f=fixture(),replacement=version({...f.payload,assignmentKey:{namespace:'fixture_assignment',literalKey:'replacement'},replaces:known({assignmentRevisionId:f.work.revisionId},[f.work.revisionId]),evidenceRefs:[...f.payload.evidenceRefs,f.work.revisionId]},'replacement','replacement-r1');
 const originals:RecordVersion[]=[];let attemptedDecisions=0;
 const student:StoredStudent={ownerId:owner,id:studentId,displayName:'Invented DOM02 Learner',sourceKey:f.payload.sourceStudent,proofRefs:['synthetic'],registeredAt:time};
 const read:TeacherReadStore={students:async()=>[student],current:async()=>[],history:async()=>[],preparationRevisions:async()=>[],catalog:async()=>[],pinnedCatalog:async()=>[],observationRequest:async()=>null,observationResult:async()=>null,clinicRequest:async()=>originals.at(-1)??null,clinicResult:async()=>null};
 const store:TeacherStore={...read,readSnapshot:async callback=>callback(read),append:async command=>{
   if(command.payload.kind==='teacher_clinic_revision'){attemptedDecisions++;assertAssignmentNotReplaced(f.work,[replacement],date);throw Error('unexpected_admission');}
   if(command.payload.kind!=='teacher_clinic_request')throw Error('not_admitted');
   const saved=version(command.payload,command.entityId,'original-'+originals.length,originals.length+1);originals.push(saved);
   return {status:'saved',revisionId:saved.revisionId,sequence:saved.sequence,recordedAt:saved.recordedAt,contentDigest:saved.contentDigest,officialSaved:false,parentSent:false};
 }};
 const app=new TeacherApplication(store,owner),actor={ownerId:owner,actorId:'synthetic-teacher',role:'teacher' as const},input={studentId,assignmentRevisionId:f.work.revisionId,attemptEntityId:f.attempt.entityId,attemptRevisionId:f.attempt.revisionId,assignedItemId:f.payload.items[0]!.assignedItemId,effectiveDate:date,expectedRevisionId:null,expectedPolicyRevision:classroomCyclePolicy.operationalContextRevision,idempotencyKey:'synthetic-replaced-intent',reportedAt:time,decision:'completed',inspection:{writtenSolution:true,correctionExplanation:true},note:'Invented explicit original'};
 await expect(app.saveClinicDecision(actor,input)).rejects.toMatchObject({message:'work_assignment_replaced',originalRetained:true});
 expect(originals).toHaveLength(2);expect((originals[0]!.payload as any).resolution).toBe('pending');expect((originals[1]!.payload as any).resolution).toBe('rejected');expect((originals[1]!.payload as any).decision).toEqual((originals[0]!.payload as any).decision);
 await expect(app.saveClinicDecision(actor,input)).rejects.toMatchObject({message:'work_assignment_replaced',originalRetained:true});expect(originals).toHaveLength(2);expect(attemptedDecisions).toBe(1);
});
