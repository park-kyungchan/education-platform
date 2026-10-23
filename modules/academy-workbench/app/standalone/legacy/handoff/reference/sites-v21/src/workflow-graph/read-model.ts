import {z} from 'zod';
import {WORKFLOW_CATALOG_PIN,selectWorkflowTemplate,emptyWorkflowTemplate,type VerifiedWorkflowCatalog} from './catalog.ts';
import {AcademyLocalDate,deriveDateCohorts,type VerifiedMemberships} from './membership.ts';
import {OperationalId,OperationalRevision} from './operational-context.ts';
import {deepFreeze} from './primitives.ts';

export const WorkflowPreparationRequest=z.strictObject({date:AcademyLocalDate,session:z.union([z.literal('all'),z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]).default('all'),policyIds:z.array(OperationalId).max(12),expectedCatalogRevision:OperationalRevision});
export type WorkflowPreparationRequest=z.infer<typeof WorkflowPreparationRequest>;

/** Pure server read model. This module does not register transport routes.
 * The HTTP/MCP adapter must separately enforce owner identity, exact
 * origin, admitted protected paths and the extended cohort-purpose field gate.
 * Successful schema parsing or source hashing does not establish that gate. */
export function buildWorkflowPreparation(catalog:VerifiedWorkflowCatalog,memberships:VerifiedMemberships,input:unknown){
 const request=WorkflowPreparationRequest.parse(input);
 const workflowTemplate=request.policyIds.length?selectWorkflowTemplate(catalog,{policyIds:request.policyIds,expectedRevision:request.expectedCatalogRevision}):emptyWorkflowTemplate(catalog,request.expectedCatalogRevision);
 const dateCohorts=deriveDateCohorts(memberships,{date:request.date,session:request.session});
 return deepFreeze({
  schemaVersion:'academy.workflow-preparation/1.0.0' as const,
  kind:'workflow_preparation_reference' as const,
  requestedDate:request.date,
  timezone:'Asia/Seoul' as const,
  dateCohorts,
  workflowTemplate:{...workflowTemplate,meaning:'selected_policy_reference_not_student_tasks' as const},
  studentWork:{assignments:{state:'not_loaded' as const,items:[]},executionAttempts:{state:'not_loaded' as const,items:[]},currentDecisions:{selection:'current_not_declared' as const,items:[],clockOrderingUsedToInferCurrent:false as const},taskCount:null,emptyMeansNoTasks:false as const},
  sourceCoverage:[
   {sourceKind:'operating_policy_checkpoint' as const,revision:catalog.revision,sourceAsOf:'2026-10-08',coverage:request.policyIds.length?'selected_policy_dependency_and_lineage_closure' as const:'no_policies_selected' as const,liveStudentRetrievalVerified:false as const},
   {sourceKind:'user_confirmed_membership' as const,revision:memberships.sourceSha256,sourceAsOf:memberships.confirmedAsOf,coverage:'explicitly_confirmed_students_only' as const,liveStudentRetrievalVerified:false as const},
   {sourceKind:'lms_date_specific_work' as const,revision:null,sourceAsOf:null,coverage:'not_queried' as const,liveStudentRetrievalVerified:false as const}
  ],
  references:{catalog:WORKFLOW_CATALOG_PIN,wholeLens:{repository:'export-source/design-reference',commit:'14bdcd7c3efa6edaca2ed411e708a0dbec8c9589',path:'docs/academy-whole-lens-target-architecture.json',meaning:'design_reference_not_runtime_authority' as const}},
  actionBoundary:{executionAuthority:'not_granted_by_context' as const,executionAllowed:false as const,authorityEvaluatedHere:false as const,capabilityEvaluatedHere:false as const,externalSourceQueried:false as const,studentRecordsChanged:false as const}
 });
}
