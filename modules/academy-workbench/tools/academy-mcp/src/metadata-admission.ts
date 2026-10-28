import {z} from 'zod';
import {dailyRecordDateSchema} from './dailyrecord-context.ts';

/** Owner-issued launch policy, separate from DailyRecord and both paper families.
 * Adding this schema grants no admission: existing records remain unchanged. */
export const metadataAdmissionSchema=z.object({schemaVersion:z.literal('academy.metadata-admission/1'),
  sourceNamespace:z.literal('academy.lms.metadata'),teacherId:z.string().regex(/^[1-9][0-9]{0,15}$/),
  allowedFrom:dailyRecordDateSchema.nullable(),allowedThrough:dailyRecordDateSchema.nullable(),
  studentScope:z.enum(['configured','source_verified']),
  relativeSelectors:z.array(z.enum(['1','11','12','13','14','15','16'])).max(7).default([]),
  operations:z.array(z.enum(['student_papers','daily_metadata','daily_inventory','daily_history','printed_paper_metadata'])).min(1).max(5),
}).strict().superRefine((v,c)=>{
  if(v.allowedFrom!==null&&v.allowedThrough!==null&&v.allowedFrom>v.allowedThrough)c.addIssue({code:'custom',message:'ordered_metadata_admission_required'});
  if(new Set(v.operations).size!==v.operations.length)c.addIssue({code:'custom',message:'unique_metadata_operations_required'});
});
export type MetadataAdmission=z.infer<typeof metadataAdmissionSchema>;
export function metadataDateAdmitted(date:string,policy:MetadataAdmission){
  return dailyRecordDateSchema.safeParse(date).success&&(policy.allowedFrom===null||date>=policy.allowedFrom)&&(policy.allowedThrough===null||date<=policy.allowedThrough);
}
