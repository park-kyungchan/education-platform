import {z} from 'zod';
import {dailyRecordDateSchema} from './dailyrecord-context.ts';

/** Owner admission record (G1). Fail-closed: no record means only the single
 * historically verified date is admitted. */
const commonAdmission = {
  decider: z.literal('user'),
  decidedAt: dailyRecordDateSchema,
  sourceNamespace: z.literal('academy.lms.dayrecord'),
  teacherId: z.string().regex(/^[1-9][0-9]{0,15}$/),
  failClosedDefault: z.literal('2026-10-23'),
  note: z.string().max(500).optional(),
};
export const ownerAdmissionSchema = z.discriminatedUnion('schemaVersion', [
  z.object({schemaVersion: z.literal('academy.owner-admission/1'), ...commonAdmission,
    allowedFrom: dailyRecordDateSchema, allowedThrough: dailyRecordDateSchema}).strict(),
  // Version 2 requires an explicit owner-issued record: null means no bound.
  z.object({schemaVersion: z.literal('academy.owner-admission/2'), ...commonAdmission,
    allowedFrom: dailyRecordDateSchema.nullable(), allowedThrough: dailyRecordDateSchema.nullable(),
    studentScope: z.enum(['configured', 'source_verified']).optional()}).strict(),
]).superRefine((v, c) => {
  if (v.allowedFrom !== null && v.allowedThrough !== null && v.allowedThrough < v.allowedFrom)
    c.addIssue({code: 'custom', message: 'admission_range_inverted'});
});

export type OwnerAdmission = z.infer<typeof ownerAdmissionSchema>;

export const FAIL_CLOSED_DEFAULT = '2026-10-23';

export function isDateAdmitted(lessonDate: string, admission: OwnerAdmission | null): boolean {
  if (!dailyRecordDateSchema.safeParse(lessonDate).success) return false;
  if (!admission) return lessonDate === FAIL_CLOSED_DEFAULT;
  return (admission.allowedFrom === null || admission.allowedFrom <= lessonDate)
    && (admission.allowedThrough === null || lessonDate <= admission.allowedThrough);
}

export function admissionBlocker(lessonDate: string, admission: OwnerAdmission | null): string | null {
  return isDateAdmitted(lessonDate, admission) ? null : 'lesson_date_out_of_admitted_scope';
}
