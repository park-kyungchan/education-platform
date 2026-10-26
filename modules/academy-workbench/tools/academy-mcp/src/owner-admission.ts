import {z} from 'zod';

/** Owner admission record (G1). Fail-closed: no record means only the single
 * historically verified date is admitted. */
export const ownerAdmissionSchema = z.object({
  schemaVersion: z.literal('academy.owner-admission/1'),
  decider: z.literal('user'),
  decidedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceNamespace: z.literal('academy.lms.dayrecord'),
  teacherId: z.string().regex(/^[1-9][0-9]{0,15}$/),
  allowedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allowedThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  failClosedDefault: z.literal('2026-10-23'),
  note: z.string().max(500).optional(),
}).strict().superRefine((v, c) => {
  if (v.allowedThrough < v.allowedFrom) c.addIssue({code: 'custom', message: 'admission_range_inverted'});
});

export type OwnerAdmission = z.infer<typeof ownerAdmissionSchema>;

export const FAIL_CLOSED_DEFAULT = '2026-10-23';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateAdmitted(lessonDate: string, admission: OwnerAdmission | null): boolean {
  if (!DATE.test(lessonDate)) return false;
  if (!admission) return lessonDate === FAIL_CLOSED_DEFAULT;
  return admission.allowedFrom <= lessonDate && lessonDate <= admission.allowedThrough;
}

export function admissionBlocker(lessonDate: string, admission: OwnerAdmission | null): string | null {
  return isDateAdmitted(lessonDate, admission) ? null : 'lesson_date_out_of_admitted_scope';
}
