import {Evidence} from './evidence.ts';
import {z} from 'zod';
import {StudentId,EntityId,EvidenceId,NativeEntityId} from './ids.ts';
export const AssessmentKind=z.enum(['daily_test_activity','textbook_daily_restudy_section','major_assessment','book_certification_assessment','lesson']);
export const Assessment=z.strictObject({id:EntityId,studentId:StudentId,kind:AssessmentKind,nativeId:NativeEntityId.nullable(),labelRaw:z.string(),evidenceIds:z.array(EvidenceId),completionState:z.enum(['unknown','teacher_confirmed_complete','teacher_confirmed_incomplete'])});
export const AssessmentRelation=z.strictObject({from:EntityId,to:EntityId,kind:z.enum(['related','independent']),evidenceIds:z.array(EvidenceId).min(1)});
/** DT is a DailyTest class activity. Daily Restudy is a textbook section.
 * Neither a label nor a diary mention proves native identity or completion. */
export function assertAssessmentIdentity(left:unknown,right:unknown,evidenceInputs:readonly unknown[]=[]){const a=Assessment.parse(left),b=Assessment.parse(right);if(a.studentId!==b.studentId)throw Error('assessment_student_scope_mismatch');if(a.kind!==b.kind)throw Error('different_assessment_kinds_cannot_be_the_same_entity');if(a.nativeId===null||b.nativeId===null||a.nativeId!==b.nativeId)return false;
 const evidence=evidenceInputs.map(value=>Evidence.parse(value)),claim=z.strictObject({nativeAssessmentId:NativeEntityId,kind:AssessmentKind});
 const identityEvidence=(assessment:Assessment)=>evidence.filter(e=>assessment.evidenceIds.includes(e.evidenceId)&&e.verificationStatus!=='contradicted'&&e.scope.studentId===assessment.studentId&&e.scope.entityIds.includes(assessment.id)&&['imported_snapshot','direct_lms_observation'].includes(e.source.kind)&&e.claim.type==='native_assessment_identity_observation').filter(e=>{const parsed=claim.safeParse(e.claim.value);return parsed.success&&parsed.data.nativeAssessmentId===assessment.nativeId&&parsed.data.kind===assessment.kind;});
 return identityEvidence(a).some(e=>identityEvidence(b).some(other=>other.scope.sourceId===e.scope.sourceId));
}
export type Assessment=z.infer<typeof Assessment>;
