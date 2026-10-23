import {createHash} from 'node:crypto';
import {z} from 'zod';

const text=z.string().min(1).max(4096),id=text.max(1024),sha=z.string().regex(/^[a-f0-9]{64}$/);
const nullable=z.string().max(4096).nullable();
export const assessmentBindingSchema=z.object({schemaVersion:z.literal('academy.assessment-binding/1'),
  research:z.object({owner:z.literal('math-research-module'),revision:z.literal('07edb2dea2e5997aea4318f0fa2efa21dde633df'),pins:z.array(z.object({path:id,sha256:sha}).strict()).min(1).max(256)}).strict(),
  sourceContext:z.object({owner:id,sourceRevision:id,scopeId:id,edition:nullable,unit:nullable,observationHash:sha.optional(),sourceHandle:id.optional(),observedAt:z.iso.datetime({offset:true}).optional()}).strict().nullable(),
  study:z.object({scope:z.object({researchTypeIds:z.array(id).min(1).max(256),researchRevision:z.literal('07edb2dea2e5997aea4318f0fa2efa21dde633df'),edition:nullable,unit:nullable}).strict(),studied:z.boolean(),summary:z.string().max(20000),evidenceNotes:z.array(z.string().max(4096)).max(128),attribution:z.literal('teacher-reported'),acceptance:z.literal(false)}).strict().nullable(),
  intent:z.object({axes:z.object({structure:z.string().max(4096),reasoning:z.string().max(4096),representation:z.string().max(4096),conditions:z.string().max(4096),errors:z.string().max(4096),transfer:z.string().max(4096)}).strict(),notes:z.string().max(20000)}).strict().nullable(),
}).strict().superRefine((v,c)=>{if(new Set(v.research.pins.map(p=>p.path)).size!==v.research.pins.length)c.addIssue({code:'custom',message:'duplicate_research_pin'});if(v.study&&new Set(v.study.scope.researchTypeIds).size!==v.study.scope.researchTypeIds.length)c.addIssue({code:'custom',message:'duplicate_study_type'});});
export type AssessmentBinding=z.infer<typeof assessmentBindingSchema>;
/** Binding is evidence of the caller's task, never source truth or effect authority. */
export function assessmentEnvelope(input:{assessmentBinding?:AssessmentBinding},result:unknown){
  if(!input.assessmentBinding)return result;
  const binding=assessmentBindingSchema.parse(input.assessmentBinding);
  return {...result as object,assessmentBinding:binding,assessmentBindingSha256:createHash('sha256').update(JSON.stringify(binding)).digest('hex'),
    comparisonLimitations:binding.study&&binding.sourceContext?(['edition','unit'] as const).filter(field=>binding.study!.scope[field]===null||binding.sourceContext![field]===null).map(field=>field+'_metadata_unqualified: readonly_comparison_is_provisional_and_scope_equivalence_is_not_established'):[],
    comparisonEvidence:binding.intent?Object.keys(binding.intent.axes).map(axis=>({axis,state:'unknown',reason:'lexical_retrieval_does_not_establish_mathematical_axis'})):[],bindingQualification:'caller_context_not_independently_authenticated',researchAcceptance:'not_inferred',finalItemMembershipCreated:false};
}

export function validateAssessmentOperation(input:{assessmentBinding?:AssessmentBinding;learningState?:string;hierarchyIds?:string[];hierarchyId?:string;purpose?:string},operation:'find'|'review'){
  const b=input.assessmentBinding;if(!b)return;
  if(!b.sourceContext)throw Error('assessment_source_context_required');
  if(input.hierarchyIds&&!input.hierarchyIds.includes(b.sourceContext.scopeId)||input.hierarchyId&&input.hierarchyId!==b.sourceContext.scopeId)throw Error('assessment_source_scope_conflict');
  if(b.study&&(['edition','unit'] as const).some(field=>b.study!.scope[field]!==null&&b.sourceContext![field]!==null&&b.study!.scope[field]!==b.sourceContext![field]))throw Error('assessment_edition_unit_conflict');
  if(operation==='review'&&input.purpose==='protocol_verification')return;
  if(!b.study||!b.intent)throw Error('assessment_study_intent_required');
  if(operation==='find'&&((input.learningState==='teacher_reported_complete')!==b.study.studied))throw Error('assessment_study_report_conflict');
  if(operation==='review'&&!b.study.studied)throw Error('assessment_study_not_reported');
}
