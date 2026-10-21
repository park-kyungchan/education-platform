import { assertExactKeys, assertInstant, canonicalJson, digest, requireText, stableId, unknown } from '../learning/model';
import { readLiteralKey, readLiteralName } from '../lms/academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';
import { bindStudentCourseRow } from '../lms/studentCourseRead';
import { sourceId, type CatalogNode } from './domain';
import type { StudentRegistration } from './contracts/storageRecords';
import { validateAcademyRecord, type SourceBookRegistration } from './records';

interface DiscoveryStudent { name:string;observedAt:string;courseRows:Array<{cells:string[];handlers:string[]}>;bookRows:Array<{cells:string[];bindings:string[]}> }
export interface NormalizedCohort {
  ownerId:string;teacherLabel:string;teacherKey:string;collegeKey:string;captureDigest:string;
  catalog:CatalogNode[];
  students:Array<{registration:StudentRegistration;observedAt:string;books:Array<{entityId:string;payload:SourceBookRegistration}>}>;
}
/** Pure corroboration, not authentication. Trusted intake must witness the admitted native acquisition separately. */
export function normalizeCohortDiscovery(input:unknown,expectedNames:readonly string[]):NormalizedCohort {
  canonicalJson(input);
  const data=readInputRecord(input);
  assertExactKeys(data,['schemaVersion','teacherLabel','principalKey','collegeKey','observedAt','source','students','academyMutations']);
  if(data.schemaVersion!==1||(data.source!=='native_browser_managed_auth'&&data.source!=='direct_http_api')||data.academyMutations!==0||!Array.isArray(data.students)||data.students.length!==expectedNames.length||expectedNames.length<1||expectedNames.length>64||new Set(expectedNames).size!==expectedNames.length)throw Error('invalid_cohort_scope');
  const acquisitionPrefix=data.source==='direct_http_api'?'direct-http':'native';
  const teacherLabel=readLiteralName(data.teacherLabel),teacherKey=readLiteralKey(data.principalKey),collegeKey=readLiteralKey(data.collegeKey);
  const observedAt=readLiteralName(data.observedAt);assertInstant(observedAt);
  const ownerId=stableId('owner','academy_instructor',collegeKey,teacherKey);
  const captureDigest=digest(data);
  const catalog=new Map<string,CatalogNode>(),studentKeys=new Set<string>(),seenNames=new Set<string>();
  const students=(data.students as DiscoveryStudent[]).map(raw=>{
    assertExactKeys(raw,['name','observedAt','courseRows','bookRows']);
    const name=readLiteralName(raw.name);assertInstant(raw.observedAt);
    if(!expectedNames.includes(name)||seenNames.has(name)||!Array.isArray(raw.courseRows)||raw.courseRows.length<1||raw.courseRows.length>1000||!Array.isArray(raw.bookRows)||raw.bookRows.length>1000)throw Error('source_subject_scope');
    seenNames.add(name);
    const keys=new Set<string>();
    for(const row of raw.courseRows){
      if(!Array.isArray(row.cells)||row.cells.length!==7||row.cells[1]!==teacherLabel)throw Error('source_teacher_binding');
      if(row.cells[2]!==name)throw Error('source_name_binding');
      if(!Array.isArray(row.handlers))throw Error('course_row_structure_drift');
      const status=row.handlers.map(text=>/^\s*onChangeStatus\(\s*([0-9 ,]+)\s*\)\s*;?\s*$/.exec(text)).find(Boolean);
      if(!status)throw Error('course_handler_signature_drift');
      const parts=status[1]!.split(',').map(value=>value.trim());
      if(parts.length!==5)throw Error('course_handler_signature_drift');
      keys.add(readLiteralKey(parts[2]));
    }
    if(keys.size!==1)throw Error('source_identity_ambiguous');
    const studentKey=[...keys][0]!;
    if(studentKeys.has(studentKey))throw Error('duplicate_student_identity');studentKeys.add(studentKey);
    const id=stableId('student','academy_student',ownerId,studentKey);
    const courseProof=raw.courseRows.every(row=>row.handlers.length===3)?'source:StudyCourse:teacher-and-student-cells-and-three-passive-tuples':'source:StudyCourse:teacher-and-student-cells-qualified-started-row-status-delete-variant';
    const refs=[`${acquisitionPrefix}-capture:${captureDigest}`, courseProof, 'source:getTextBookProgress:row-subject-and-course-book-student-tuple'];
    const courses=new Map(raw.courseRows.map(row=>{
      const observed=bindStudentCourseRow(row,{teacherLabel,studentKey,studentName:name});
      if(observed.identity.collegeKey!==collegeKey)throw Error('source_college_binding');
      return [observed.identity.courseKey,{row,observed}] as const;
    }));
    if(courses.size!==raw.courseRows.length)throw Error('ambiguous_course_binding');
    const bookKeys=new Set<string>();
    let namedRowObserved=false;
    const books=raw.bookRows.map(row=>{
      if(!Array.isArray(row.cells)||!Array.isArray(row.bindings)||![4,5].includes(row.cells.length))throw Error('book_row_structure_drift');
      if(row.cells.length===5){if(row.cells[0]!==name)throw Error('source_name_binding');namedRowObserved=true;}
      if(!namedRowObserved)throw Error('book_subject_not_independently_observed');
      const tuples=row.bindings.map(text=>{
        const match=/createBookIncorrectPapers\(\s*['"]?([0-9]+)['"]?\s*,\s*['"]?([0-9]+)['"]?\s*,\s*['"]?([0-9]+)['"]?\s*\)/.exec(text);
        if(!match)throw Error('book_handler_signature_drift');return match.slice(1).map(readLiteralKey);
      });
      if(tuples.length<1||new Set(tuples.map(tuple=>canonicalJson(tuple))).size!==1)throw Error('book_binding_ambiguous');
      const [courseKey,bookNo,bookStudent]=tuples[0]!;
      const course=courses.get(courseKey!);
      if(bookStudent!==studentKey||!course)throw Error('book_course_student_conflict');
      const identity=canonicalJson([courseKey,bookNo]);if(bookKeys.has(identity))throw Error('duplicate_book_binding');bookKeys.add(identity);
      const offset=row.cells.length===5?1:0;
      const bookLabel=readLiteralName(row.cells[offset]),progress=readLiteralName(row.cells[offset+1]);
      const sourceBook={namespace:'academy_book',literalKey:bookNo!};
      const catalogNodeId=sourceId(sourceBook);
      const node:CatalogNode={id:catalogNodeId,kind:'book_edition',sourceKey:sourceBook,label:bookLabel,parent:unknown('source_book_root_no_parent')};
      const existing=catalog.get(node.id);if(existing&&canonicalJson(existing)!==canonicalJson(node))throw Error('shared_book_metadata_conflict');catalog.set(node.id,node);
      const payload:SourceBookRegistration={kind:'source_book_registration',sourceStudent:{namespace:'academy_student',literalKey:studentKey},sourceCourse:{namespace:'academy_course',literalKey:courseKey!},
        sourceUserCourse:{namespace:'academy_user_course',literalKey:course.observed.identity.userCourseKey},sourceBook,catalogNodeId,
        sourceCourseLabel:course.row.cells[3]!,sourceBookLabel:bookLabel,sourceStatus:course.row.cells[5]!,sourceProgressLiteral:progress,
        sourceLearningRangeLiteral:course.row.cells[3]!.split('\n')[0]!,assignmentValidity:unknown('source_learning_range_not_effective_enrollment'),role:unknown('teacher_primary_supplementary_role_not_declared'),
        contractRef:'docs/academy-deterministic-read-contract.ts#sourceContracts/student_course-and-textbook',
        evidenceRefs:[`${acquisitionPrefix}-field-proof:${digest({teacherKey,collegeKey,name,courseRow:course.row,bookRow:row})}`,...refs.slice(1)]};
      validateAcademyRecord(payload);
      return {entityId:stableId('entity','academy_book_registration',id,course.observed.identity.userCourseKey,bookNo!),payload};
    });
    return {registration:{ownerId,id,displayName:name,sourceKey:{namespace:'academy_student',literalKey:studentKey},proofRefs:refs},observedAt:raw.observedAt,books};
  });
  requireText(captureDigest,'capture digest');
  return {ownerId,teacherLabel,teacherKey,collegeKey,captureDigest,catalog:[...catalog.values()],students};
}
