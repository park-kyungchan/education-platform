import { expect, test } from 'bun:test';
import { planDayRecordEvidence, planTextbookEvidence } from '../../src/academy/sourceEvidence';
import type { StoredStudent } from '../../src/academy/postgresStore';
import type { SourceBookRegistration } from '../../src/academy/records';
import { unknown } from '../../src/learning/model';

const student:StoredStudent={ownerId:'fixture-owner',id:'fixture-student',displayName:'Invented Learner',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['fixture'],registeredAt:'2090-01-01T00:00:00Z'};
const book:SourceBookRegistration={kind:'source_book_registration',sourceStudent:student.sourceKey,sourceCourse:{namespace:'academy_course',literalKey:'71001'},sourceUserCourse:{namespace:'academy_user_course',literalKey:'81001'},sourceBook:{namespace:'academy_book',literalKey:'61001'},catalogNodeId:'fixture-book',sourceCourseLabel:'Invented course',sourceBookLabel:'Invented book',sourceStatus:'Invented source status',sourceProgressLiteral:'20%',sourceLearningRangeLiteral:'Invented learning range',assignmentValidity:unknown('not_enrollment'),role:unknown('teacher_role_unknown'),contractRef:'fixture',evidenceRefs:['fixture']};
const record={studentKey:'91001',studentName:'Invented Learner',courseKey:'71001',bookNo:'61001',paperKey:'51001',attemptKey:'41001',sourceTitle:'Invented minor-unit required example',score:75,items:[{originalOrdinal:'1',lectureKey:'31001',outerLectureKey:'21001',scoring:'X'},{originalOrdinal:'2',lectureKey:'31002',outerLectureKey:'21002',scoring:'O'}],sourceDate:{literal:'09-21',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}};
const snapshot=(records:unknown[],observedAt='2090-01-01T00:00:01Z')=>({schemaVersion:1,family:'textbook',status:'observed',records,dailyResults:[],dayRecords:[],observedAt,coverage:'exact_selected_existing_records_not_whole_book',unknownStates:['teacher_acceptance_unknown'],nativePrintInvoked:false,automaticRetryAllowed:false});

test('splits actual-source snapshots into stable student/book/attempt evidence without promoting grades or incomplete dates',()=>{
  const first=planTextbookEvidence('fixture-owner',[student],[book],[snapshot([record])]);
  expect(first).toHaveLength(1);
  expect(first[0]!.studentId).toBe(student.id);
  expect(first[0]!.payload.kind).toBe('source_audit');
  const acquisition=first[0]!.payload.acquisition as ReturnType<typeof snapshot>;
  expect(acquisition.records).toEqual([record]);
  expect(acquisition.unknownStates).toContain('teacher_acceptance_unknown');
  expect(acquisition.nativePrintInvoked).toBe(false);
  const later=planTextbookEvidence('fixture-owner',[student],[book],[snapshot([record],'2090-01-02T00:00:00Z')]);
  expect(later[0]!.entityId).toBe(first[0]!.entityId);
  expect(later[0]!.sourceObservedAt).not.toBe(first[0]!.sourceObservedAt);
});

test('rejects duplicate source identities across batches instead of allowing competing writes',()=>{
  expect(()=>planTextbookEvidence('fixture-owner',[student],[book],[snapshot([record]),snapshot([{...record,score:100}])])).toThrow('duplicate_source_evidence_identity');
});

test('refuses foreign student, owner, course and book bindings before any intake effect',()=>{
  expect(()=>planTextbookEvidence('fixture-owner',[student],[book],[snapshot([{...record,studentKey:'91002'}])])).toThrow('source_student_binding_conflict');
  expect(()=>planTextbookEvidence('foreign-owner',[student],[book],[snapshot([record])])).toThrow('source_student_binding_conflict');
  expect(()=>planTextbookEvidence('fixture-owner',[student],[book],[snapshot([{...record,courseKey:'71002'}])])).toThrow('source_book_binding_conflict');
  expect(()=>planTextbookEvidence('fixture-owner',[student],[book],[snapshot([{...record,bookNo:'61002'}])])).toThrow('source_book_binding_conflict');
});

test('refuses effectful or unknown item correctness snapshots through the original audit contract',()=>{
  expect(()=>planTextbookEvidence('fixture-owner',[student],[book],[{...snapshot([record]),nativePrintInvoked:true}])).toThrow('invalid_source_audit');
  expect(()=>planTextbookEvidence('fixture-owner',[student],[book],[snapshot([{...record,items:[{...record.items[0],scoring:'unknown'}]}])])).toThrow('invalid_source_item');
});

test('retains verified lesson occurrences without aliasing calendar course keys to learning-course keys',()=>{
  const scope={family:'day_record',teacherLabel:'Invented Teacher',date:'2090-01-02',groupIds:['21001'],studentNames:[student.displayName]};
  const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{studentName:student.displayName,date:scope.date,groupId:'21001',teacherKey:'11001',studentKey:'91001',courseKey:'99001',recordKey:'41001',membershipKey:'81001',fields:{attendance:'Y',progress:'Invented official progress',homework:'Invented assignment'}}],requestedScope:scope,observedAt:'2090-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['teacher_acceptance_unknown'],nativePrintInvoked:false,automaticRetryAllowed:false};
  const plan=planDayRecordEvidence('fixture-owner','11001',[student],[acquisition]);
  expect(plan).toHaveLength(1);
  expect(plan[0]!.payload.acquisition).toEqual(acquisition);
  expect(()=>planDayRecordEvidence('fixture-owner','11002',[student],[acquisition])).toThrow('source_principal_conflict');
});
