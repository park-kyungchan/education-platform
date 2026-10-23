/** Additive boundary for the separately pinned workflow route. Legacy scopes
 * do not acquire this authority and continue through their original checks. */
import {z} from 'zod';
const Id=z.string().min(1).max(512).refine(v=>!v.includes('*'),'wildcard_scope_forbidden');
const UniqueIds=z.array(Id).refine(v=>new Set(v).size===v.length,'duplicate_scope_id');
const DateOnly=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const n=Date.parse(v+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v;});
export const WORKFLOW_SCOPE_FIELDS={
 'policy-index':['policy.summary','policy.domain','source.revision'],
 'source-binding':['policy.selected_dependency_lineage','cohort.confirmed_membership','cohort.identity_binding','source.revision'],
 'preparation':['policy.selected_dependency_lineage','cohort.date_session_membership','cohort.coverage','studentWork.not_loaded','currentDecision.current_not_declared','source.revision']
} as const;
export const WorkflowScope=z.strictObject({phase:z.enum(['policy-index','source-binding','preparation']),date:DateOnly.nullable(),session:z.union([z.literal('all'),z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]).nullable(),policyIds:UniqueIds.max(12),studentIds:UniqueIds.max(4),nodeIds:UniqueIds,domain:z.enum(['administration','middle_school','elementary_school','teaching_coaching']).nullable(),offset:z.number().int().min(0).max(10000).nullable(),limit:z.number().int().min(1).max(20).nullable()});
export type WorkflowScope=z.infer<typeof WorkflowScope>;
export function assertWorkflowScope(scope:{selectedStudentId:string|null;allowedEntityIds:string[];fields:string[];window:string|null;purpose:string;cohortPreparation?:unknown}){
 const s=WorkflowScope.parse(scope.cohortPreparation);
 if(scope.selectedStudentId!==null||scope.purpose!=='teacher_private_workflow_preparation_reference')throw Error('workflow_scope_purpose_invalid');
 const expected=[...new Set([...s.studentIds,...s.policyIds,...s.nodeIds])].sort();
 if(JSON.stringify([...scope.allowedEntityIds].sort())!==JSON.stringify(expected))throw Error('workflow_entity_scope_mismatch');
 if(JSON.stringify([...scope.fields].sort())!==JSON.stringify([...WORKFLOW_SCOPE_FIELDS[s.phase]].sort()))throw Error('workflow_field_scope_mismatch');
 if(s.phase==='policy-index'){
  if(s.date!==null||s.session!==null||s.studentIds.length||s.policyIds.length||s.offset===null||s.limit===null)throw Error('workflow_index_scope_invalid');
 }else if(s.date===null||s.session===null||s.domain!==null||s.offset!==null||s.limit!==null)throw Error('workflow_date_session_scope_required');
 if(scope.window!==JSON.stringify(s))throw Error('workflow_window_scope_mismatch');
 return s;
}
