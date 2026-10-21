import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {selection,workflows} from './selection';
import {queryBoundary} from './query-boundary';
import evidence from './source-evidence.json';
import {projectLearningWork} from '../../apps/academy/dc-gang-a/src/academy/learningWorkProjection';
import {originalWrongApplicability,teacherActivitySummary,type TeacherActivityReview} from '../../apps/academy/dc-gang-a/src/academy/teacherWorkspace';
import type {LearningWorkAssignment,LearningWorkAttempt,TeacherClinicRevision} from '../../apps/academy/dc-gang-a/src/academy/learningWork';
import type {RecordVersion} from '../../apps/academy/dc-gang-a/src/academy/contracts/storageRecords';
import {classroomCyclePolicy} from '../../apps/academy/dc-gang-a/src/academy/classroomCyclePolicy';
import {unknown,known} from '../../apps/academy/dc-gang-a/src/learning/model';
import {buildTeacherWorkContext} from '../../apps/academy/dc-gang-a/src/academy/teacherWorkContext';
import {buildStudentPreparation} from '../../apps/academy/dc-gang-a/src/academy/preparationHistory';
import type {SourceBookRegistration} from '../../apps/academy/dc-gang-a/src/academy/records';

test('seven selected workflows retain producers, actual consumers, contracts, gaps and exact evidence',()=>{
  expect(workflows.map(w=>String(w.id)).sort()).toEqual(['class-preparation','lesson-delivery','progress-audit','homework-followup','assessment-preparation','wrong-answer-clinic','attendance-internal-journal'].sort());
  for(const workflow of workflows){
    expect(workflow.producers.length).toBeGreaterThan(0);expect(workflow.contracts.length).toBeGreaterThan(0);expect(workflow.currentConsumers.length).toBeGreaterThan(0);expect(workflow.demonstratedGaps.length).toBeGreaterThan(0);
    for(const path of workflow.evidencePaths)expect(evidence.sources.some(s=>s.path===path)).toBe(true);
  }
  expect(selection.secondReducer).toBe(false);
});
test('frozen source hashes cover all selected implementation and consumer bytes',()=>{
  for(const source of evidence.sources)expect(createHash('sha256').update(readFileSync(source.path)).digest('hex')).toBe(source.sha256);
});
function assertBackEdges(edges:typeof evidence.importEdges){
  for(const suffix of ['lms/endpointCatalog.ts','lms/lessonJournalTemplates.ts','lms/academyHttpClient.ts']){
    if(!edges.some(e=>e.from.endsWith(suffix)&&e.to.includes('/src/academy/')))throw Error('omitted_actual_lms_application_edge');
  }
}
test('actual reverse coupling and all six DC-to-gang-a edges survive; omitted edge fails',()=>{
  assertBackEdges(evidence.importEdges);
  expect(()=>assertBackEdges(evidence.importEdges.filter(e=>!e.from.endsWith('lms/endpointCatalog.ts')))).toThrow('omitted_actual_lms_application_edge');
  expect(evidence.dcGangImports).toHaveLength(6);
  expect(evidence.readInputImports.some(e=>e.from.endsWith('usecases/studentScene.ts'))).toBe(true);
  expect(evidence.lmsBackImports.find(e=>e.from.endsWith('academyHttpClient.ts'))?.typeOnly).toBe(true);
});
test('Education QRY qualifies DOM-01 before owner-local boundary; CON follows later QRY-02',()=>{
  expect(queryBoundary.workOrder.domainId).toBe('education');expect(queryBoundary.workOrder.projectId).toBe('education-platform');
  expect(queryBoundary.workOrder.qryWorkId).toBe('academy-query-integration-20261021');
  expect(queryBoundary.workOrder.sequence.indexOf('Later Education QRY-02 result')).toBeLessThan(queryBoundary.workOrder.sequence.indexOf('Academy Workbench CON consumer adaptation'));
  expect(queryBoundary.workOrder.workbenchProducerPrerequisite).toBe(false);
  expect(selection.heldTasks).toHaveLength(2);
});

// Small invented fixture exercises the maintained projection without loading storage/native entrypoints.
const student={namespace:'academy_student',literalKey:'synthetic-student'};
const assignment:LearningWorkAssignment={kind:'learning_work_assignment',sourceStudent:student,sourceCourse:{namespace:'academy_course',literalKey:'synthetic-course'},sourceBook:{namespace:'academy_book',literalKey:'edition-A'},sourceUserCourse:{namespace:'academy_user_course',literalKey:'registration-A'},registrationRevisionId:'registration-A-r1',assignmentKey:{namespace:'synthetic_assignment',literalKey:'work-A'},activity:'wrong_clinic',origin:'teacher_report',effectiveDate:'2090-01-02',dueDate:unknown('Not observed'),status:'assigned',catalogRefs:[],sectionNodeIds:['synthetic-section'],items:[{assignedItemId:'item-occurrence-1',itemKey:{namespace:'synthetic_item',literalKey:'item-1'},contentNodeId:'synthetic-item',sectionNodeId:'synthetic-section',labelLiteral:'Synthetic item'}],paper:known({paperKey:{namespace:'synthetic_paper',literalKey:'paper-A'},versionLiteral:'1',issuanceKey:{namespace:'synthetic_issuance',literalKey:'issue-A'},reissueOf:null,orderedItems:[{assignedItemId:'item-occurrence-1',printedOrdinal:'1'}]},['synthetic-identity-evidence']) ,evidenceRefs:['synthetic-assignment-evidence']};
const attempt:LearningWorkAttempt={kind:'learning_work_attempt',sourceStudent:student,attemptKey:{namespace:'synthetic_attempt',literalKey:'attempt-A'},assignmentRevisionId:'assignment-r1',paperIssuanceKey:{namespace:'synthetic_issuance',literalKey:'issue-A'},previousAttemptRevisionId:null,occurredAt:unknown('Not observed'),state:'graded',itemResults:[{assignedItemId:'item-occurrence-1',grade:known('incorrect',['synthetic-original-grade'])}],evidenceRefs:['synthetic-attempt-evidence']};
const decision:TeacherClinicRevision={kind:'teacher_clinic_revision',sourceStudent:student,assignmentRevisionId:'assignment-r1',attemptEntityId:'attempt-A',attemptRevisionId:'attempt-r1',assignedItemId:'item-occurrence-1',effectiveDate:'2090-01-02',reportedAt:'2090-01-02T02:00:00Z',decision:'completed',inspection:{writtenSolution:true,correctionExplanation:true},note:'Synthetic explicit teacher judgment',policyRevision:classroomCyclePolicy.operationalContextRevision};
const version=(payload:RecordVersion['payload'],entityId:string,revisionId:string,sequence=1):RecordVersion=>({ownerId:'synthetic-owner',studentId:'synthetic-student-id',entityId,sequence,revisionId,previousRevisionId:null,previousDigest:null,payload,contentDigest:'synthetic',integrityDigest:'synthetic',sourceObservedAt:'2090-01-02T00:00:00Z',recordedAt:'2090-01-02T02:00:00Z',actorId:'synthetic-teacher',idempotencyKey:revisionId,commandDigest:'synthetic'});
const work=version(assignment,'work-A','assignment-r1'),first=version(attempt,'attempt-A','attempt-r1'),final=version(decision,'decision-A','decision-r1');
const project=(rows:RecordVersion[],heads=rows)=>projectLearningWork('synthetic-student-id',student,'2090-01-03',rows,heads,[]);
test('maintained exact projection keeps raw incorrect score beside explicit teacher completion',()=>{
  const item=project([work,first,final]).assignments[0]!.attempts[0]!.items[0]!;
  expect(item.state).toBe('completed');expect(item.sourceGrade).toEqual(attempt.itemResults[0]!.grade);expect(item.completion?.revisionId).toBe('decision-r1');
});
test('attempt replacement retains prior teacher final without inspecting successor evidence',()=>{
  const next=version({...attempt,previousAttemptRevisionId:'attempt-r1'},'attempt-A','attempt-r2',2);
  const item=project([work,first,next,final],[work,next,final]).assignments[0]!.attempts[0]!.items[0]!;
  expect(item.state).toBe('prior_revision_completed');expect(item.completion).toBeNull();expect(item.retainedCompletion?.revisionId).toBe('decision-r1');expect(item.inspectionBasis).toBe('prior_attempt_revision');
});
test('withdrawal archives previous work and does not keep it writable or erase its history',()=>{
  const withdrawn=version({...assignment,status:'withdrawn'},'work-A','assignment-r2',2);
  const row=project([work,withdrawn,first,final],[withdrawn,first,final]).assignments[0]!;
  expect(row.record.payload.status).toBe('withdrawn');expect(row.writable).toBe(false);expect(row.archived[0]!.attempts[0]!.items[0]!.retainedCompletion?.revisionId).toBe('decision-r1');
});
test('foreign student is rejected and absent assignments remain unknown coverage',()=>{
  expect(()=>project([{...work,studentId:'foreign'}])).toThrow('work_context_scope_conflict');
  expect(project([]).assignments).toEqual([]);expect(project([]).coverage).toBe('retained_explicit_assignments_not_complete_inventory');
});
test('maintained context rejects a different book edition despite identical display label',()=>{
  const book:SourceBookRegistration={kind:'source_book_registration',sourceStudent:student,sourceCourse:assignment.sourceCourse,sourceUserCourse:assignment.sourceUserCourse,sourceBook:assignment.sourceBook,catalogNodeId:'synthetic-book-edition',sourceCourseLabel:'Synthetic course',sourceBookLabel:'Same visible title',sourceStatus:'Synthetic active',sourceProgressLiteral:'Unknown',sourceLearningRangeLiteral:'Unknown',assignmentValidity:unknown('Not enrollment evidence'),role:unknown('Not selected'),contractRef:'synthetic-contract',evidenceRefs:['synthetic-registration']};
  const retained={...version(book,'registration-A','registration-r1'),lastVerifiedAt:'2090-01-02T00:00:00Z'};
  const preparation=buildStudentPreparation(student,[retained],'2090-01-03');
  const input={studentId:'synthetic-student-id',studentKey:student,date:'2090-01-03',revision:'synthetic-scene-r1',catalog:[{id:'synthetic-book-edition',kind:'book_edition' as const,sourceKey:book.sourceBook,label:'Same visible title',parent:unknown<string>('Root')}],preparation,versions:[retained]};
  expect(buildTeacherWorkContext(input).data.books[0]!.sourceBook.literalKey).toBe('edition-A');
  expect(()=>buildTeacherWorkContext({...input,catalog:[{...input.catalog[0]!,sourceKey:{namespace:'academy_book',literalKey:'edition-B'}}]})).toThrow('work_context_book_binding_conflict');
});
test('exact100 current implementation excludes original wrong while independent stages remain pending; similar-default gap is retained',()=>{
  const review:TeacherActivityReview={kind:'teacher_activity_review',sourceStudent:student,studentBinding:{studentId:'synthetic-student-id',sourceStudent:student},reportedAt:'2090-01-02T00:00:00Z',evidenceRevisionIds:['assignment-r1'],assignmentRevisionId:'assignment-r1',selectedItemIds:['item-occurrence-1'],coverage:'known_subset',originalScore:100,originalWrong:'not_applicable',similarPrinted:'printed',similar:'unknown',appEntry:'not_entered',paper:{issuance:assignment.paper,corrections:[]},video:{upload:'uploaded',reference:'synthetic',review:'not_reviewed',note:''},mindmap:{state:'not_requested',note:'',explanation:null},final:{decision:'pending',checkedSolutionAndUnderstanding:false,note:''}};
  const summary=teacherActivitySummary(review);
  expect(originalWrongApplicability(100)).toBe('not_applicable');expect(summary.learning).toBe('unknown');expect(summary.similarAssignment).toBe('unknown');expect(summary.similarPrint).toBe('printed');expect(summary.appRecord).toBe('not_entered');expect(summary.wholeBookComplete).toBe(false);
  expect(queryBoundary.demonstratedStateRefinements.some(g=>g.id==='G-100')).toBe(true);
});
