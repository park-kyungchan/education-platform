import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
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

export const dailyRecordSaveRequestEvidenceSchema = z.object({
  runtime: id,
  requestRef: id,
  requestTextSha256: hash,
  currentUserEventRef: id,
}).strict();
export type DailyRecordSaveRequestEvidence = z.infer<typeof dailyRecordSaveRequestEvidenceSchema>;

/** Live owner evidence source: re-read the runtime owner's current-request
 * file on every consumption, so a stale, foreign or missing current user
 * event rejects instead of the admission attesting to itself. The launch
 * supplies only the path; the owner rewrites the file per instruction. */
export function liveSaveRequestEvidence(path: string) {
  return async (): Promise<DailyRecordSaveRequestEvidence> => {
    let bytes: Buffer;
    try { bytes = readFileSync(path); } catch { throw Error('dailyrecord_save_current_request_unavailable'); }
    if (bytes.length > 16384) throw Error('dailyrecord_save_current_request_unavailable');
    return dailyRecordSaveRequestEvidenceSchema.parse(JSON.parse(bytes.toString('utf8')));
  };
}

export interface DailyRecordSaveConsumeOwner {
  /** Re-read the actual current user event from the runtime owner. */
  readCurrentRequest: () => Promise<DailyRecordSaveRequestEvidence>;
  /** Durable exclusive consume before dispatch; false means already used. */
  consumeOnce: (key: string, record: Readonly<{request: DailyRecordSaveRequestEvidence; studentId: string; lessonDate: string; field: string; effectRecordKey: string; after: string}>) => Promise<boolean>;
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Canonical JSON digest identical to Education `learning/model.digest`:
 * sorted object keys, no whitespace. The owner client
 * (`journalHttpActionDigest`) compares its approval decision against this
 * exact digest of the complete action, so the admission must return it —
 * never the internal admitted-tuple key. */
export function canonicalActionDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
/** Sorted-key, whitespace-free JSON; undefined object members are omitted. */
export function canonicalJson(part: unknown): string {
  if (part === null || typeof part === 'boolean' || typeof part === 'string') return JSON.stringify(part);
  if (typeof part === 'number' && Number.isFinite(part)) return JSON.stringify(part);
  if (typeof part !== 'object' || part === null) throw Error('dailyrecord_save_action_not_json');
  if (Array.isArray(part)) return '[' + part.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(part).filter(k => (part as Record<string, unknown>)[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalJson((part as Record<string, unknown>)[k])).join(',') + '}';
}

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
    async consumeApproval(action: Readonly<{attemptId: string; target: {studentName: string; date: string; groupId: string; teacherKey: string; studentKey: string; courseKey: string; recordKey: string; membershipKey: string}; field: string; effectRecordKey: string; before: string; after: string; wireDigest: string}>) {
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
      return consumed ? {status: 'verified' as const, actionDigest: canonicalActionDigest(action)} : {status: 'rejected' as const};
    },
  };
}
export type DailyRecordSaveApproval = ReturnType<typeof createDailyRecordSaveAdmission>;
