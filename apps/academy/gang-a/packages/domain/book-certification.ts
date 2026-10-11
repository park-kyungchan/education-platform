import {z} from 'zod';
import {StudentId,EntityId,NativeEntityId,EvidenceId} from './ids.ts';

export const CertificationScope=z.strictObject({studentId:StudentId,bookEditionId:EntityId,testEntityId:EntityId,nativeTestId:NativeEntityId,assessmentKind:z.literal('book_certification_assessment')});
export type CertificationScope=z.infer<typeof CertificationScope>;
export const CertificationAttempt=z.discriminatedUnion('state',[
 z.strictObject({state:z.literal('ungraded'),attemptId:EntityId,nativeAttemptId:NativeEntityId,score:z.null(),scoreUnit:z.null(),evidenceId:EvidenceId}),
 z.strictObject({state:z.literal('graded'),attemptId:EntityId,nativeAttemptId:NativeEntityId,score:z.number(),scoreUnit:z.literal('points'),evidenceId:EvidenceId})
]);
export const CertificationQuery=z.discriminatedUnion('state',[
 z.strictObject({state:z.literal('unqueried'),scope:CertificationScope}),
 z.strictObject({state:z.literal('supplied_result'),scope:CertificationScope,bindingEvidenceId:EvidenceId,queryEvidenceId:EvidenceId,attempts:z.array(CertificationAttempt)})
]);
/** Numeric policy only. A pass neither chooses a retake nor confirms book completion. */
export function classifyCertificationScore(input:unknown){const score=z.number().parse(input);return score>=70?'passed' as const:'failed' as const;}
