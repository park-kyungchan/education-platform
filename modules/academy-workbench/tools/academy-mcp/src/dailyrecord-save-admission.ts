import {createHash} from 'node:crypto';
import {z} from 'zod';
import {dailyRecordFieldSchema} from './dailyrecord-context.ts';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().min(1).max(256);

/**
 * Launch-pinned DailyRecord save admission. The runtime owner issues this
 * file from the actual current user save instruction; tool callers can
 * neither supply nor widen it. It mirrors the Education
 * `journalRequestAdmission` contract at the MCP patch level: exact admitted
 * (student, date, field, effect record, after-value) tuples, a current
 * request evidence binding, and durable one-time consumption owned by the
 * backend process. Approval flags in tool input are never authority.
 */
export const dailyRecordSaveAdmissionSchema = z.object({
  schemaVersion: z.literal('academy.dailyrecord-save-admission/1'),
  runtime: id,
  requestRef: id,
  requestTextSha256: hash,
  currentUserEventRef: id,
  admitted: z.array(z.object({
    studentId: id,
    lessonDate: z.iso.date(),
    field: dailyRecordFieldSchema,
    effectRecordKey: id,
    after: z.string().max(8192),
  }).strict()).min(1).max(32),
}).strict();
export type DailyRecordSaveAdmission = z.infer<typeof dailyRecordSaveAdmissionSchema>;

export interface DailyRecordSaveRequestEvidence {
  runtime: string;
  requestRef: string;
  requestTextSha256: string;
  currentUserEventRef: string;
}

export interface DailyRecordSaveConsumeOwner {
  /** Re-read the actual current user event from the runtime owner. */
  readCurrentRequest: () => Promise<DailyRecordSaveRequestEvidence>;
  /** Durable exclusive consume before dispatch; false means already used. */
  consumeOnce: (key: string, record: Readonly<{request: DailyRecordSaveRequestEvidence; studentId: string; lessonDate: string; field: string; effectRecordKey: string; after: string}>) => Promise<boolean>;
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Admission object handed to the native client's applyJournalAction port. */
export function createDailyRecordSaveAdmission(
  admission: Readonly<DailyRecordSaveAdmission>,
  owner: DailyRecordSaveConsumeOwner,
) {
  dailyRecordSaveAdmissionSchema.parse(admission);
  const admitted = new Map(admission.admitted.map(entry => [
    digest({studentId: entry.studentId, lessonDate: entry.lessonDate, field: entry.field, effectRecordKey: entry.effectRecordKey, after: entry.after}),
    entry,
  ]));
  if (admitted.size !== admission.admitted.length) throw Error('dailyrecord_save_duplicate_admitted_action');
  const used = new Set<string>();
  return {
    admissionDigest: digest(admission),
    async consumeApproval(action: Readonly<{target: {studentKey: string; date: string}; field: string; effectRecordKey: string; after: string}>) {
      const key = digest({studentId: action.target.studentKey, lessonDate: action.target.date, field: action.field, effectRecordKey: action.effectRecordKey, after: action.after});
      if (!admitted.has(key) || used.has(key)) return {status: 'rejected' as const};
      const actual = await owner.readCurrentRequest();
      if (actual.runtime !== admission.runtime || actual.requestRef !== admission.requestRef
        || actual.requestTextSha256 !== admission.requestTextSha256 || actual.currentUserEventRef !== admission.currentUserEventRef) {
        return {status: 'rejected' as const};
      }
      const consumed = await owner.consumeOnce('dailyrecord-save-' + key, Object.freeze({
        request: actual, studentId: action.target.studentKey, lessonDate: action.target.date,
        field: action.field, effectRecordKey: action.effectRecordKey, after: action.after,
      }));
      used.add(key);
      return consumed ? {status: 'verified' as const, actionDigest: key} : {status: 'rejected' as const};
    },
  };
}
export type DailyRecordSaveApproval = ReturnType<typeof createDailyRecordSaveAdmission>;
