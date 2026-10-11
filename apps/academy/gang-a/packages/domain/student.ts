import {z} from 'zod';
import {StudentId,NativeStudentId,Instant,EvidenceId} from './ids.ts';
export const Student=z.strictObject({studentId:StudentId,displayName:z.string().min(1),nativeIdentity:z.discriminatedUnion('status',[z.strictObject({status:z.literal('unverified'),nativeStudentId:NativeStudentId.nullable()}),z.strictObject({status:z.literal('verified'),nativeStudentId:NativeStudentId,evidenceId:EvidenceId})]),managementState:z.enum(['active','unknown','withdrawn']),validFrom:Instant.nullable(),validTo:Instant.nullable(),rosterRevision:z.string().min(1)}).superRefine((s,c)=>{if(s.validFrom&&s.validTo&&Date.parse(s.validFrom)>=Date.parse(s.validTo))c.addIssue({code:'custom',message:'invalid_validity_interval'});});
export type Student=z.infer<typeof Student>;
