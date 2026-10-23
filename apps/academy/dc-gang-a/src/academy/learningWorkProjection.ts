import {assertDate,canonicalJson,immutableCopy,known,unknown} from '../learning/model';
import type {CatalogNode,SourceKey} from './domain';
import type {RecordVersion} from './contracts/storageRecords';
import type {LearningWorkAssignment,LearningWorkAttempt,TeacherClinicRevision} from './learningWork';
import {classroomCyclePolicy} from './classroomCyclePolicy';
import {assessmentScoreBasis,assertReplacementGraph,replacementPredecessor,selectEffectiveAssignments} from './learningWorkBindings';
import {assertActivityReviewAttemptBinding,teacherActivitySummary} from './teacherWorkspace';
import type {StudentWorkspaceVersion} from './ownerWorkspaceStore';
type Version<T>=RecordVersion&{payload:T};
export interface PinnedCatalog {node:CatalogNode;revisionId:string}
const businessDate=(instant:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
/** Lesson-effective teacher decisions, not a claim to reconstruct what a source showed on that date. */
export function projectLearningWork(studentId:string,studentKey:SourceKey,date:string,versions:readonly RecordVersion[],heads:readonly RecordVersion[],catalog:readonly PinnedCatalog[],workspaces:readonly StudentWorkspaceVersion[]=[]){
  assertDate(date);
  const rows=[...new Map(versions.map(row=>[row.revisionId,row])).values()];
  for(const row of rows)if(row.studentId!==studentId||'sourceStudent' in row.payload&&canonicalJson(row.payload.sourceStudent)!==canonicalJson(studentKey))throw Error('work_context_scope_conflict');
  const assignments=rows.filter((v):v is Version<LearningWorkAssignment>=>v.payload.kind==='learning_work_assignment');
  const attempts=rows.filter((v):v is Version<LearningWorkAttempt>=>v.payload.kind==='learning_work_attempt');
  const decisions=rows.filter((v):v is Version<TeacherClinicRevision>=>v.payload.kind==='teacher_clinic_revision');
  const latest=<T extends RecordVersion>(values:readonly T[])=>[...values].sort((a,b)=>b.sequence-a.sequence)[0]??null;
  const currentIds=new Set(heads.map(v=>v.revisionId));
  const selected=selectEffectiveAssignments(assignments,date);
  const effectiveAssignments=assignments.filter(v=>v.payload.effectiveDate<=date);
  let replacementError:string|null=null;
  try{assertReplacementGraph(effectiveAssignments);}catch(error){replacementError=(error as Error).message;}
  const replacing=new Map<string,string[]>();
  if(!replacementError)for(const successor of selected){const prior=replacementPredecessor(successor,effectiveAssignments);if(prior){const refs=replacing.get(prior.revisionId)??[];refs.push(successor.revisionId);replacing.set(prior.revisionId,refs);}}
  for(const review of workspaces)if(review.studentId!==studentId||review.ownerId!==(rows[0]?.ownerId??review.ownerId)||canonicalJson(review.payload.sourceStudent)!==canonicalJson(studentKey))throw Error('work_context_scope_conflict');
  const projectAssignment=(record:Version<LearningWorkAssignment>,historical:boolean)=>{
      const payload=record.payload,replacedBy=replacing.get(record.revisionId)??[];
      const obligationState=payload.status==='withdrawn'?'withdrawn' as const:replacedBy.length===1?'replaced' as const:'active' as const;
      const writable=!historical&&currentIds.has(record.revisionId)&&obligationState==='active';
      const nodes=payload.catalogRefs.map(ref=>{const found=catalog.find(row=>row.revisionId===ref.revisionId&&row.node.id===ref.nodeId);if(!found)throw Error('work_catalog_binding_conflict');return found.node;});
      const related=attempts.filter(v=>v.payload.assignmentRevisionId===record.revisionId);
      const activityReviews=workspaces.flatMap(review=>{
        if(review.payload.kind!=='teacher_activity_review'||review.payload.assignmentRevisionId!==record.revisionId||businessDate(review.payload.reportedAt)>date)return [];
        const binding=review.payload.attemptBinding,attempt=binding?.state==='known'?related.find(row=>row.entityId===binding.value.attemptEntityId&&row.revisionId===binding.value.attemptRevisionId)??null:null;
        let qualified=binding?.state==='known';try{assertActivityReviewAttemptBinding(review.payload,record,attempt);}catch{qualified=false;}
        return [{record:review,summary:teacherActivitySummary(review.payload),attemptBindingQualified:qualified,attemptIsRetainedHead:!!attempt&&currentIds.has(attempt.revisionId)}];
      });
      return {record,catalog:nodes,writable,obligationState,replacement:{replaces:replacementError?unknown(replacementError):payload.replaces??unknown('replacement_not_reported'),replacedBy:replacedBy.length===1?known(replacedBy,[record.revisionId,...replacedBy]):unknown(replacedBy.length>1?'ambiguous_replacement_claims':replacementError??'no_qualified_replacement_observed')},activityReviews,history:assignments.filter(v=>v.entityId===record.entityId),
        attempts:[...new Set(related.map(v=>v.entityId))].map(entityId=>{
          const attempt=latest(related.filter(v=>v.entityId===entityId))!;
          const scoreBasis=assessmentScoreBasis(record,attempt,rows,heads);
          const defaultClinicTargets=scoreBasis.state==='known'&&scoreBasis.value.score===100?{wrong:'excluded_exact_100' as const,similar:'excluded_exact_100' as const}:scoreBasis.state==='known'?{wrong:'requires_teacher_selection' as const,similar:'requires_teacher_selection' as const}:{wrong:'unknown' as const,similar:'unknown' as const};
          const attemptReviews=activityReviews.filter(row=>row.attemptBindingQualified&&row.record.payload.kind==='teacher_activity_review'&&row.record.payload.attemptBinding?.state==='known'&&row.record.payload.attemptBinding.value.attemptRevisionId===attempt.revisionId);
          const items=payload.items.map(item=>{
            const history=decisions.filter(v=>v.payload.assignmentRevisionId===record.revisionId&&v.payload.attemptEntityId===entityId&&v.payload.assignedItemId===item.assignedItemId).sort((a,b)=>a.sequence-b.sequence);
            const effective=history.filter(v=>v.payload.effectiveDate<=date),effectiveHead=latest(effective),current=latest(history);
            const decision=effectiveHead,currentDecision=latest(effective.filter(v=>v.payload.attemptRevisionId===attempt.revisionId));
            let retainedCompletion:Version<TeacherClinicRevision>|null=null;
            for(const row of effective){if(row.payload.decision==='completed')retainedCompletion=row;else if(classroomCyclePolicy.clinicWorkflow.completionInvalidatingDecisions.includes(row.payload.decision))retainedCompletion=null;}
            // Source replacement never deletes a teacher judgment or silently inspects the successor evidence.
            const completion=retainedCompletion?.payload.attemptRevisionId===attempt.revisionId?retainedCompletion:null;
            const inspectionBasis=completion?'current_attempt_revision' as const:retainedCompletion?'prior_attempt_revision' as const:'not_established' as const;
            return {item,sourceGrade:attempt.payload.itemResults.find(row=>row.assignedItemId===item.assignedItemId)?.grade??unknown('No qualified item grade'),decision,currentDecision,completion,retainedCompletion,inspectionBasis,history,
              writable:writable&&currentIds.has(attempt.revisionId)&&(!current||current.revisionId===effectiveHead?.revisionId),
              expectedRevisionId:current?.revisionId??null,
              state:completion?'completed' as const:retainedCompletion?'prior_revision_completed' as const:currentDecision?.payload.decision??'source_unknown' as const};
          });
          return {record:attempt,history:related.filter(v=>v.entityId===entityId),items,completed:items.length>0&&items.every(item=>item.state==='completed'),assessmentTarget:{assignmentRevisionId:record.revisionId,attemptEntityId:attempt.entityId,attemptRevisionId:attempt.revisionId},scoreBasis,defaultClinicTargets,explicitAssignments:'preserved_independently' as const,activityReviews:attemptReviews};
        }),
      };
  };
  const projected=selected.map(record=>({...projectAssignment(record,false),archived:assignments.filter(v=>v.entityId===record.entityId&&v.revisionId!==record.revisionId).map(v=>projectAssignment(v,true))}));
  return immutableCopy({schemaVersion:1 as const,refinementsVersion:1 as const,date,coverage:'retained_explicit_assignments_not_complete_inventory' as const,activityReviewCoverage:'retained_workspace_heads_not_complete_review_history' as const,
    sourceClockMeaning:'latest_retained_source_versions_not_historical_source_reconstruction' as const,
    assignments:projected,
    currentObligations:projected.filter(row=>row.obligationState==='active').map(row=>({assignmentRevisionId:row.record.revisionId,completion:'not_inferred_from_score_or_assignment_level_review' as const})),
    unknowns:['No catalog-only section is an assignment','Missing attempt or grade is unknown, not nonperformance','Completion is exact assignment revision/attempt/item only; no official projection or delivery'],
  });
}
export type LearningWorkProjection=ReturnType<typeof projectLearningWork>;
