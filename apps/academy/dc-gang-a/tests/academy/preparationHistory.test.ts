import {describe,expect,test} from 'bun:test';
import {buildStudentPreparation} from '../../src/academy/preparationHistory';
import {unknown} from '../../src/learning/model';
import type {SourceBookRegistration,TeacherReportedNote} from '../../src/academy/records';
import {validateAcademyRecord} from '../../src/academy/records';
const student={namespace:'academy_student',literalKey:'91001'};
const course={namespace:'academy_course',literalKey:'92001'};
const book={namespace:'academy_book',literalKey:'94001'};
const registration:SourceBookRegistration={kind:'source_book_registration',sourceStudent:student,sourceCourse:course,sourceUserCourse:{namespace:'academy_user_course',literalKey:'93001'},sourceBook:book,catalogNodeId:'invented-book-root',sourceCourseLabel:'Invented 가우스 course',sourceBookLabel:'Invented 가우스 volume',sourceStatus:'Invented active',sourceProgressLiteral:'Invented progress',sourceLearningRangeLiteral:'Invented range',assignmentValidity:unknown('not_enrollment_proof'),role:unknown('not_declared'),contractRef:'invented-source-contract',evidenceRefs:['invented-proof']};
const legacy:TeacherReportedNote={kind:'teacher_reported_note',directiveRef:'invented-teacher-directive',text:JSON.stringify({schemaVersion:1,kind:'teacher_confirmed_video_history_with_source_attachments',date:'2090-01-02',sourceStudentKey:'91001',completedUnits:[{courseSourceKey:'92001',unitSourceKey:'95001',labelLiteral:'1-1 Invented first unit',videoState:'teacher_confirmed_resolved',basis:'explicit_teacher_historical_confirmation_list_retention_exception',videoSourceKeys:[],originalUploadIdentityInvented:false,problemSolvingEstablished:false}],recentVideoFacts:[],gradeEvidence:[],sourceBookInventoryRefs:[{courseSourceKey:'92001',labelLiteral:'Invented 가우스 volume',units:[{unitSourceKey:'95001',labelLiteral:'1-1 Invented first unit'},{unitSourceKey:'95002',labelLiteral:'1-2 Invented second unit'}]}],homework:'Invented homework basis',homeworkProvenance:'prior_official_homework_and_confirmed_carryover',sourceRefs:['invented-source'],directiveRef:'invented-teacher-directive',sourceCommentBody:'not_qualified',physicalInspection:'not_reported',allHomeworkPagesAndItemsJoined:false,correctionByTeacherNotInferredFromAppScore:true})};
const version=(payload:any,revisionId:string,recordedAt='2090-01-02T00:00:00Z')=>({payload,revisionId,recordedAt,sourceObservedAt:recordedAt});
describe('persistent preparation compatibility and teacher authority',()=>{
 test('retains explicit historical completion without fabricating an upload or claiming homework grading',()=>{
  const result=buildStudentPreparation(student,[version(registration,'book-v1'),version(legacy,'teacher-v1')],'2090-01-02');
  expect(result.books).toHaveLength(1);
  expect(result.books[0]!.unitInventoryCoverage).toBe('retained_unit_references_not_full_source_inventory');
  expect(result.books[0]!.units[0]!.video.state).toBe('teacher_confirmed_resolved');
  expect(result.books[0]!.units[0]!.video.teacherRevisionRefs).toEqual(['teacher-v1']);
  expect(result.books[0]!.units[0]!.video.sourceVideoRefs).toEqual([]);
  expect(result.books[0]!.units[0]!.appGradingEstablished).toBe(false);
  expect(result.books[0]!.units[1]!.video.state).toBe('source_not_loaded');
  expect(result.wholeHomeworkCoverageEstablished).toBe(false);
 });
 test('a later unsolicited source upload is reference-only after teacher completion',()=>{
  const snapshot={kind:'source_prestudy_snapshot',sourceStudent:student,teacherKey:'97001',coverage:'all_returned_requested_rows_not_all_time_history',evidenceRefs:['invented-video-read'],videos:[{prestudyKey:'98001',studentKey:'91001',teacherKey:'97001',courseKey:'92001',sunitKey:'95001',unitLabelLiteral:'1-1 Invented first unit',versionLiteral:'1',lane:'teacher_unconfirmed',statusLiteral:'0',scoreLiteral:'0',createdLiteral:'2090-01-03',commentLiteral:''}]};
  const result=buildStudentPreparation(student,[version(registration,'book-v1'),version(legacy,'teacher-v1'),version(snapshot,'video-v1','2090-01-03T00:00:00Z')],'2090-01-03');
  expect(result.books[0]!.units[0]!.video.state).toBe('teacher_confirmed_resolved');
  expect(result.books[0]!.units[0]!.video.referenceVideoRefs).toEqual(['98001']);
 });
 test('only an explicit applicable teacher instruction reopens work while retaining acceptance evidence',()=>{
  const instruction={kind:'teacher_activity_revision',sourceStudent:student,sourceCourse:course,sourceBook:book,sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95001'},activity:'prestudy_review',scope:'minor_unit',decision:'reopen',effectiveDate:'2090-01-03',authority:'explicit_teacher_report',directiveRef:'invented-reinspection-request',evidenceRefs:['invented-request']};
  const records=[version(registration,'book-v1'),version(legacy,'teacher-v1'),version(instruction,'instruction-v1','2090-01-03T00:00:00Z')];
  expect(buildStudentPreparation(student,records,'2090-01-02').books[0]!.units[0]!.video.state).toBe('teacher_confirmed_resolved');
  const pending=buildStudentPreparation(student,records,'2090-01-03').books[0]!.units[0]!;
  expect(pending.video.state).toBe('teacher_reinspection_required');
  expect(pending.video.priorAcceptanceRevisionRefs).toEqual(['teacher-v1']);
  expect(pending.video.teacherRevisionRefs).toEqual(['instruction-v1']);
  const final={...instruction,decision:'accepted',effectiveDate:'2090-01-04'};
  expect(buildStudentPreparation(student,[...records,version(final,'accepted-v2','2090-01-04T00:00:00Z')],'2090-01-04').books[0]!.units[0]!.video.state).toBe('teacher_confirmed_resolved');
 });
 test('uses a qualified full unit inventory and explicit audit scope without treating progress scalars as app grading',()=>{
  const inventory={kind:'source_course_inventory',sourceStudent:student,sourceCourse:course,sourceUserCourse:registration.sourceUserCourse,sourceBook:book,bookLabelLiteral:registration.sourceBookLabel,courseVersionLiteral:'ver.3',coverage:'all_returned_course_units',evidenceRefs:['invented-table'],units:[{sunitKey:'95001',bunitKey:'96001',sourceOrder:0,labelLiteral:'1-1 Invented first unit',progressCells:[{fieldId:'step_3_value_0',literal:'100'}]},{sunitKey:'95002',bunitKey:'96001',sourceOrder:1,labelLiteral:'1-2 Invented second unit',progressCells:[]}]};
  const scope={kind:'teacher_preparation_assignment',sourceStudent:student,sourceCourse:course,sourceBook:book,start:'book_beginning',upperBound:{state:'known',value:'95001',evidenceRefs:['invented-directive']},series:'gauss',teacherBookAliasLiteral:'Invented alias',directiveRef:'invented-directive',effectiveDate:'2090-01-02'};
  const result=buildStudentPreparation(student,[version(registration,'book-v1'),version(inventory,'inventory-v1'),version(scope,'scope-v1')],'2090-01-02');
  expect(result.books[0]!.unitInventoryCoverage).toBe('all_returned_course_units');
  expect(result.books[0]!.units).toHaveLength(2);
  expect(result.books[0]!.units[0]!.duty).toBe('current_duty');
  expect(result.books[0]!.units[1]!.duty).toBe('outside_current_audit_scope');
  expect(result.books[0]!.units[0]!.appGradingEstablished).toBe(false);
 });
 test('ordinary prose, a source-reviewed label and empty comment composer do not issue teacher acceptance',()=>{
  const body=JSON.parse(legacy.text);body.completedUnits=[];
  const source={kind:'source_prestudy_snapshot',sourceStudent:student,teacherKey:'97001',coverage:'all_returned_requested_rows_not_all_time_history',evidenceRefs:['invented-video-read'],videos:[{prestudyKey:'98001',studentKey:'91001',teacherKey:'97001',courseKey:'92001',sunitKey:'95001',unitLabelLiteral:'1-1 Invented first unit',versionLiteral:'1',lane:'teacher_confirmed',statusLiteral:'1',scoreLiteral:'5',createdLiteral:'2090-01-02',commentLiteral:''}]};
  const result=buildStudentPreparation(student,[version(registration,'book-v1'),version({...legacy,text:JSON.stringify(body)},'definitions-v1'),version(source,'video-v1'),version({kind:'teacher_reported_note',text:'Invented all done prose',directiveRef:'invented-prose'},'prose-v1')],'2090-01-02');
  expect(result.books[0]!.units[0]!.video.state).toBe('source_reviewed_teacher_acceptance_unqualified');
  expect(result.books[0]!.units[0]!.video.teacherRevisionRefs).toEqual([]);
 });
 test('foreign legacy subjects and incompatible teacher authority fail closed',()=>{
  const body=JSON.parse(legacy.text);body.sourceStudentKey='91002';
  expect(()=>buildStudentPreparation(student,[version(registration,'book-v1'),version({...legacy,text:JSON.stringify(body)},'foreign-v1')],'2090-01-02')).toThrow('legacy_preparation_subject_or_directive_conflict');
  const instruction={kind:'teacher_activity_revision',sourceStudent:student,sourceCourse:course,sourceBook:book,sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95001'},activity:'app_problem_grading',scope:'minor_unit',decision:'accepted',effectiveDate:'2090-01-02',authority:'explicit_teacher_report',directiveRef:'invented-directive',evidenceRefs:['invented-ref']};
  expect(()=>validateAcademyRecord(instruction as never)).toThrow('teacher_activity_authority');
  expect(()=>validateAcademyRecord({...instruction,activity:'prestudy_review',effectiveDate:'2090-02-31'} as never)).toThrow('invalid_preparation_date');
 });
 test('source observation cutoff uses the Korean lesson date rather than the UTC date',()=>{
  const body=JSON.parse(legacy.text);body.completedUnits=[];
  const snapshot={kind:'source_prestudy_snapshot',sourceStudent:student,teacherKey:'97001',coverage:'all_returned_requested_rows_not_all_time_history',evidenceRefs:['invented-video-read'],videos:[{prestudyKey:'98001',studentKey:'91001',teacherKey:'97001',courseKey:'92001',sunitKey:'95001',unitLabelLiteral:'1-1 Invented first unit',versionLiteral:'1',lane:'teacher_unconfirmed',statusLiteral:'0',scoreLiteral:'0',createdLiteral:'2090-01-03',commentLiteral:''}]};
  const rows=[version(registration,'book-v1'),version({...legacy,text:JSON.stringify(body)},'definitions-v1'),version(snapshot,'late-video','2090-01-02T16:00:00Z')];
  expect(buildStudentPreparation(student,rows,'2090-01-02').books[0]!.units[0]!.video.state).toBe('source_not_loaded');
  expect(buildStudentPreparation(student,rows,'2090-01-03').books[0]!.units[0]!.video.state).toBe('awaiting_teacher_review');
 });
 test('notebook and clinic judgments remain independent and Davinci never acquires a video duty',()=>{
  const body=JSON.parse(legacy.text);body.completedUnits=[];
  const review={kind:'teacher_activity_revision',sourceStudent:student,sourceCourse:course,sourceBook:book,sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95001'},activity:'solution_note_inspection',scope:'minor_unit',decision:'accepted',effectiveDate:'2090-01-02',authority:'explicit_teacher_report',directiveRef:'invented-note-inspection',evidenceRefs:['invented-paper-check']};
  const rows=[version(registration,'book-v1'),version({...legacy,text:JSON.stringify(body)},'definitions-v1'),version(review,'inspection-v1')];
  const unit=buildStudentPreparation(student,rows,'2090-01-02').books[0]!.units[0]!;
  expect(unit.teacherActivities.find(a=>a.activity==='solution_note_inspection')!.state).toBe('teacher_confirmed_resolved');
  expect(unit.teacherActivities.find(a=>a.activity==='wrong_clinic')!.state).toBe('teacher_evidence_not_reported');
  expect(unit.video.state).toBe('source_not_loaded');
  const davinci={...registration,sourceCourseLabel:'Invented 다빈치 course',sourceBookLabel:'Invented 다빈치 edition'};
  expect(buildStudentPreparation(student,[version(davinci,'book-v1'),rows[1]!],'2090-01-02').books[0]!.units[0]!.video.state).toBe('not_required');
 });
 test('a teacher revision cannot disappear behind an unqualified minor-unit join',()=>{
  const instruction={kind:'teacher_activity_revision',sourceStudent:student,sourceCourse:course,sourceBook:book,sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95999'},activity:'prestudy_review',scope:'minor_unit',decision:'accepted',effectiveDate:'2090-01-02',authority:'explicit_teacher_report',directiveRef:'invented-directive',evidenceRefs:['invented-ref']};
  expect(()=>buildStudentPreparation(student,[version(registration,'book-v1'),version(legacy,'teacher-v1'),version(instruction,'unknown-unit')],'2090-01-02')).toThrow('teacher_unit_binding_unqualified');
 });
});
export {student,course,book,registration,legacy,version};
