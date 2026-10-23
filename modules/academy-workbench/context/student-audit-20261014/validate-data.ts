import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export interface AuditStudent {
  studentId: string; name: string; fullCurrentHistoryVerified: false;
  sections: Array<{ rowKind: string; attemptIds: string[]; [key: string]: unknown }>;
  attempts: Array<{ id: string; score: number | null; [key: string]: unknown }>;
  prepVideosHistorical: Array<{ id: string; state: string; [key: string]: unknown }>;
  [key: string]: unknown;
}
export interface NormalizedAudit {
  schemaVersion: 'academy.audit.normalized/1.0.0'; collectedAt: string;
  coverage: { fullCurrentHistoryVerified: false; historicalAttempts: number; historicalVideos: number; sectionRowsIncludingPlaceholders: number; [key: string]: unknown };
  students: AuditStudent[]; [key: string]: unknown;
}
function requireValue(value: unknown, error: string): asserts value { if (!value) throw Error(error); }
/** Structural/integrity checks only. Never establishes source truth or missing school work. */
export function validateData(value: unknown): NormalizedAudit {
  requireValue(value && typeof value === 'object', 'audit_object_required');
  const x = value as NormalizedAudit;
  requireValue(x.schemaVersion === 'academy.audit.normalized/1.0.0', 'audit_schema_version');
  requireValue(typeof x.collectedAt === 'string' && Number.isFinite(Date.parse(x.collectedAt)), 'collection_clock');
  requireValue(x.coverage?.fullCurrentHistoryVerified === false, 'unsupported_complete_history_claim');
  requireValue(Array.isArray(x.students) && x.students.length === 5, 'bounded_five_student_scope');
  const ids = new Set<string>();
  for (const s of x.students) {
    requireValue(typeof s.studentId === 'string' && !!s.studentId && !ids.has(s.studentId), 'student_identity'); ids.add(s.studentId);
    requireValue(s.fullCurrentHistoryVerified === false, 'unsupported_student_complete_history_claim');
    requireValue(Array.isArray(s.attempts) && Array.isArray(s.sections) && Array.isArray(s.prepVideosHistorical), 'student_arrays');
    const attempts = new Set<string>();
    for (const a of s.attempts) {
      requireValue(typeof a.id === 'string' && !!a.id && !attempts.has(a.id), 'attempt_identity'); attempts.add(a.id);
      requireValue(a.score === null || (Number.isFinite(a.score) && a.score >= 0 && a.score <= 100), 'attempt_score');
    }
    for (const row of s.sections) {
      requireValue(typeof row.rowKind === 'string' && !!row.rowKind, 'row_kind_required');
      requireValue(Array.isArray(row.attemptIds) && row.attemptIds.every(id => attempts.has(id)), 'same_student_attempt_reference');
    }
    const videos = new Set<string>();
    for (const v of s.prepVideosHistorical) { requireValue(typeof v.id === 'string' && !!v.id && !videos.has(v.id), 'historical_video_identity'); videos.add(v.id); }
  }
  const counts = { historicalAttempts: x.students.reduce((n, s) => n + s.attempts.length, 0), historicalVideos: x.students.reduce((n, s) => n + s.prepVideosHistorical.length, 0), sectionRowsIncludingPlaceholders: x.students.reduce((n, s) => n + s.sections.length, 0) };
  for (const k of Object.keys(counts) as (keyof typeof counts)[]) requireValue(x.coverage[k] === counts[k], `coverage_count_${k}`);
  const visit = (v: unknown): void => {
    if (typeof v === 'string') {
      requireValue(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9_-]{24,}/.test(v), 'credential_pattern');
      for (const match of v.matchAll(/https?:\/\/[^\s<>"'\\)]+/g)) {
        const u = new URL(match[0]); requireValue(!u.username && !u.password, 'credential_url');
        for (const k of u.searchParams.keys()) requireValue(!/^(access_token|refresh_token|token|signature|sig|password|api_key|x-amz-signature|x-goog-signature)$/i.test(k), 'signed_private_url');
      }
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') for (const [k, nested] of Object.entries(v)) {
      requireValue(!/^(authorization|cookie|set-cookie|password|access_token|refresh_token|client_secret|api_key|private_key)$/i.test(k), 'credential_field'); visit(nested);
    }
  }; visit(x);
  return x;
}
export async function verifyPrivateData() {
  const url = new URL('../../private/student-audit-20261014/audit.json', import.meta.url);
  const bytes = await readFile(url); const x = validateData(JSON.parse(bytes.toString('utf8')));
  const manifest = JSON.parse(await readFile(new URL('../../private/student-audit-20261014/manifest.json', import.meta.url), 'utf8'));
  const digest = createHash('sha256').update(bytes).digest('hex');
  requireValue(manifest.auditSha256 === digest && manifest.auditBytes === bytes.length, 'audit_manifest_mismatch');
  return { structuralIntegrity: 'pass', studentCount: x.students.length, historicalAttempts: x.coverage.historicalAttempts, historicalVideos: x.coverage.historicalVideos, sectionRowsIncludingPlaceholders: x.coverage.sectionRowsIncludingPlaceholders, sha256: digest, sourceTruthVerified: false, fullCurrentHistoryVerified: false, missingWorkInferred: false, executionAuthority: 'none' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await verifyPrivateData(), null, 2));
