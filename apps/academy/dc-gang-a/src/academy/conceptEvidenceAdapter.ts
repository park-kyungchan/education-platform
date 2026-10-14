import {known,unknown,canonicalJson} from '../learning/model';
import type {RecordVersion,StoredStudent} from './contracts/storageRecords';
import type {StudentWorkspaceVersion} from './ownerWorkspaceStore';
import type {StudentConceptEvidence} from './conceptEvidenceGraph';
import type {SourceKey} from './domain';

export interface ConceptEvidenceRead {
 student:StoredStudent;legacy:RecordVersion[];workspaces:StudentWorkspaceVersion[];currentRevisionIds:string[];
}
/** Exact existing revision records only. Aggregate audit snapshots remain aggregate source observations. */
export function adaptConceptEvidence(ownerId:string,studentId:string,read:ConceptEvidenceRead){
 if(read.student.ownerId!==ownerId||read.student.id!==studentId)throw Error('student_scope_conflict');
 const all=new Map(read.legacy.map(row=>[row.revisionId,row]));const descriptors:StudentConceptEvidence[]=[];
 const metadata:{revisionId:string;kind:string;entityId:string;current:boolean;scopeNote:string;clockMeaning:'source_observation'|'local_report_receipt';reportedAt:string|null;actualLearningTime:'not_inferred'}[]=[];
 for(const row of [...read.legacy,...read.workspaces]){
  if(row.ownerId!==ownerId||row.studentId!==studentId)throw Error('foreign_concept_evidence');
  const payload=row.payload;
  if(payload.kind==='teacher_parent_draft'||payload.kind==='teacher_clinic_request'||payload.kind==='teacher_observation_request')continue;
  let sourceKey:SourceKey,grain:StudentConceptEvidence['grain']='source_observation',bookEdition=unknown<SourceKey>('Exact book edition is not established for this retained revision'),scopeNote='Aggregate retained revision; no question-level identity is fabricated';
  if(payload.kind==='source_book_registration'){sourceKey=payload.sourceBook;bookEdition=known(payload.sourceBook,[row.revisionId]);}
  else if(payload.kind==='learning_work_assignment'){sourceKey=payload.assignmentKey;grain='activity';bookEdition=known(payload.sourceBook,[row.revisionId]);scopeNote='Exact assigned item range, not whole-book mastery';}
  else if(payload.kind==='learning_work_attempt'){
   sourceKey=payload.attemptKey;grain=payload.itemResults.length===1?'question_attempt':'activity';scopeNote=payload.itemResults.length===1?'One recorded item in this exact attempt':'Multiple/unknown item membership in the exact attempt; not a single-question claim';
   const assignment=all.get(payload.assignmentRevisionId);if(assignment?.payload.kind==='learning_work_assignment'&&canonicalJson(assignment.payload.sourceStudent)===canonicalJson(read.student.sourceKey))bookEdition=known(assignment.payload.sourceBook,[assignment.revisionId,row.revisionId]);
  }else if(payload.kind==='teacher_activity_review'){
   sourceKey={namespace:'teacher_activity_review',literalKey:payload.assignmentRevisionId};grain='activity';scopeNote='Attributable teacher-reported exact assignment scope; no source or mastery promotion';
   const assignment=all.get(payload.assignmentRevisionId);if(assignment?.payload.kind==='learning_work_assignment')bookEdition=known(assignment.payload.sourceBook,[assignment.revisionId,row.revisionId]);
  }else {sourceKey={namespace:'retained_academy_revision',literalKey:row.revisionId};if(['teacher_observation','teacher_clinic_revision','teacher_activity_revision'].includes(payload.kind))grain='activity';}
  const teacherReport=payload.kind.startsWith('teacher_');
  const observedAt=teacherReport?row.recordedAt:'sourceObservedAt'in row?row.sourceObservedAt:row.recordedAt;
  const reportedAt='reportedAt'in payload&&typeof payload.reportedAt==='string'?payload.reportedAt:null;
  descriptors.push({ownerId,studentId,revisionId:row.revisionId,sourceKey,grain,bookEdition,observedAt,sourceRefs:[row.revisionId]});
  metadata.push({revisionId:row.revisionId,kind:payload.kind,entityId:row.entityId,current:read.currentRevisionIds.includes(row.revisionId),scopeNote,clockMeaning:teacherReport?'local_report_receipt':'source_observation',reportedAt,actualLearningTime:'not_inferred'});
 }
 return {descriptors,metadata};
}
