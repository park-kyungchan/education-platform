/** Exact retained-source/binding checks shared by existing transaction guards and read projection. */
import {canonicalJson,known,unknown,type Knowledge} from '../learning/model';
import {createAcademySourceAudit} from '../lms/academySourceAudit';
import {readInputRecord} from '../contracts/readInputRecord';
import type {StoredSourceRecord} from '../lms/academyReadProtocol';
import type {RecordVersion} from './contracts/storageRecords';
import type {LearningWorkAssignment,LearningWorkAttempt} from './learningWork';
export type AssignmentVersion=RecordVersion&{payload:LearningWorkAssignment};
export type AttemptVersion=RecordVersion&{payload:LearningWorkAttempt};
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** The maintained projection and transaction guards share the same lesson-effective selection. */
export function selectEffectiveAssignments(assignments:readonly AssignmentVersion[],date:string):AssignmentVersion[]{
  return [...new Set(assignments.map(row=>row.entityId))].flatMap(id=>{
    const latest=assignments.filter(row=>row.entityId===id&&row.payload.effectiveDate<=date).sort((a,b)=>b.sequence-a.sequence)[0];return latest?[latest]:[];
  });
}
export function replacementPredecessor(successor:AssignmentVersion,assignments:readonly AssignmentVersion[]):AssignmentVersion|null {
  const link=successor.payload.replaces;if(link?.state!=='known')return null;
  const prior=assignments.find(row=>row.revisionId===link.value.assignmentRevisionId);
  if(!prior||prior.entityId===successor.entityId||prior.ownerId!==successor.ownerId||prior.studentId!==successor.studentId
    ||(['sourceStudent','sourceCourse','sourceUserCourse','sourceBook','registrationRevisionId'] as const).some(key=>!equal(prior.payload[key],successor.payload[key]))
    ||prior.payload.effectiveDate>successor.payload.effectiveDate)throw Error('work_replacement_binding_conflict');
  return prior;
}
/** Entity-level cycles are invalid even when immutable revision references themselves form a DAG. */
export function assertReplacementGraph(assignments:readonly AssignmentVersion[]):void {
  const edges=new Map<string,Set<string>>(),claims=new Map<string,Set<string>>();
  for(const row of assignments){const prior=replacementPredecessor(row,assignments);if(prior){const next=edges.get(row.entityId)??new Set<string>();next.add(prior.entityId);edges.set(row.entityId,next);const owners=claims.get(prior.revisionId)??new Set<string>();owners.add(row.entityId);claims.set(prior.revisionId,owners);}}
  const visited=new Set<string>(),visiting=new Set<string>();
  const visit=(id:string)=>{if(visiting.has(id))throw Error('work_replacement_cycle');if(visited.has(id))return;visiting.add(id);for(const next of edges.get(id)??[])visit(next);visiting.delete(id);visited.add(id);};
  for(const id of edges.keys())visit(id);
  for(const owners of claims.values())if(owners.size>1)throw Error('work_replacement_ambiguous');
}
/** Existing mutation guards call this under their student lock, using retained assignment history. */
export function assertAssignmentNotReplaced(assignment:AssignmentVersion,successors:readonly AssignmentVersion[],date:string):void {
  for(const successor of selectEffectiveAssignments(successors,date))if(successor.payload.replaces?.state==='known'&&successor.payload.replaces.value.assignmentRevisionId===assignment.revisionId){replacementPredecessor(successor,[assignment]);throw Error('work_assignment_replaced');}
}
export interface VerifiedAssessmentScore {score:number;sourceAuditRevisionId:string;sourcePaperKey:string;sourceAttemptKey:string;sourceObservedAt:string;currentness:'retained_head_not_live_source';teacherReview:'not_inferred';finalCompletion:'not_inferred'}
/** Unknown/mismatched/stale evidence cannot exclude a default target. No original is modified. */
export function assessmentScoreBasis(assignment:AssignmentVersion,attempt:AttemptVersion,rows:readonly RecordVersion[],heads:readonly RecordVersion[]):Knowledge<VerifiedAssessmentScore> {
  const binding=attempt.payload.assessmentBasis;
  if(binding?.state!=='known')return unknown('assessment_source_attempt_binding_not_qualified');
  const source=rows.find(row=>row.revisionId===binding.value.sourceAuditRevisionId);
  if(attempt.payload.assignmentRevisionId!==assignment.revisionId||attempt.ownerId!==assignment.ownerId||attempt.studentId!==assignment.studentId||!equal(attempt.payload.sourceStudent,assignment.payload.sourceStudent)
    ||attempt.payload.attemptKey.namespace!=='academy_textbook_attempt'||attempt.payload.attemptKey.literalKey!==binding.value.attemptKey
    ||!source||source.ownerId!==assignment.ownerId||source.studentId!==assignment.studentId||source.payload.kind!=='source_audit'
    ||![assignment.revisionId,attempt.revisionId,source.revisionId].every(id=>heads.some(row=>row.revisionId===id)))return unknown('assessment_basis_unresolved_or_not_retained_head');
  return retainedAssessmentScore(assignment,attempt.payload,source);
}
/** The store supplies an exact current source row; this function does not authenticate or acquire it. */
export function retainedAssessmentScore(assignment:AssignmentVersion,attempt:LearningWorkAttempt,source:RecordVersion):Knowledge<VerifiedAssessmentScore> {
  const binding=attempt.assessmentBasis;
  if(binding?.state!=='known'||source.payload.kind!=='source_audit'||source.revisionId!==binding.value.sourceAuditRevisionId||source.ownerId!==assignment.ownerId||source.studentId!==assignment.studentId||attempt.assignmentRevisionId!==assignment.revisionId||!equal(attempt.sourceStudent,assignment.payload.sourceStudent)||attempt.attemptKey.namespace!=='academy_textbook_attempt'||attempt.attemptKey.literalKey!==binding.value.attemptKey)return unknown('assessment_basis_scope_conflict');
  const paper=assignment.payload.paper;
  if(paper.state!=='known'||paper.value.paperKey.namespace!=='academy_textbook_paper'||paper.value.paperKey.literalKey!==binding.value.paperKey
    ||!equal(attempt.paperIssuanceKey,paper.value.issuanceKey))return unknown('assessment_paper_binding_unresolved');
  try{
    const audit=createAcademySourceAudit(source.payload.acquisition),snapshot=readInputRecord(source.payload.acquisition);
    if(snapshot.family!=='textbook'||snapshot.status!=='observed'||audit.contentDigest!==source.contentDigest||Date.parse(audit.observedAt)!==Date.parse(source.sourceObservedAt))return unknown('assessment_source_not_verified');
    const matches=(snapshot.records as StoredSourceRecord[]).filter(row=>row.studentKey===assignment.payload.sourceStudent.literalKey&&row.courseKey===assignment.payload.sourceCourse.literalKey&&row.bookNo===assignment.payload.sourceBook.literalKey&&row.paperKey===binding.value.paperKey&&row.attemptKey===binding.value.attemptKey);
    if(matches.length!==1||matches[0]!.score===null)return unknown('assessment_score_not_exactly_observed');
    return known({score:matches[0]!.score,sourceAuditRevisionId:source.revisionId,sourcePaperKey:binding.value.paperKey,sourceAttemptKey:binding.value.attemptKey,sourceObservedAt:source.sourceObservedAt,currentness:'retained_head_not_live_source',teacherReview:'not_inferred',finalCompletion:'not_inferred'},[source.revisionId,assignment.revisionId]);
  }catch{return unknown('assessment_source_contract_not_qualified');}
}
