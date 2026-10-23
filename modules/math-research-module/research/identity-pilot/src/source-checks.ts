import { createHash } from 'node:crypto';
import type { Bundle, Issue } from './model.ts';
/** Read-only bytes must come from the caller's explicitly allowed source resolver. */
export async function verifySourcePins(bundle: Bundle, readSource: (sourcePath: string) => Promise<Uint8Array>): Promise<Issue[]> {
  const issues: Issue[] = [];
  const cache = new Map<string, Promise<Uint8Array>>();
  const read = (path: string) => { if (!cache.has(path)) cache.set(path, readSource(path)); return cache.get(path)!; };
  const parse = async (path: string, expected: string): Promise<any> => {
    let bytes: Uint8Array;
    try { bytes = await read(path); } catch { issues.push({ code: 'SOURCE_UNAVAILABLE', path, message: 'Cannot read the explicitly pinned source' }); return undefined; }
    if (createHash('sha256').update(bytes).digest('hex') !== expected) { issues.push({ code: 'SOURCE_HASH_DRIFT', path, message: 'Source bytes changed; reobserve before using the crosswalk' }); return undefined; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { issues.push({ code: 'SOURCE_INVALID_JSON', path, message: 'Expected JSON source' }); return undefined; }
  };
  for (const record of bundle.harnessRecords) {
    const parsed = await parse(record.sourcePath, record.sourceSha256);
    if (!parsed) continue;
    const records = Array.isArray(parsed) ? parsed : parsed.artifacts ?? parsed.records;
    const matches = Array.isArray(records) ? records.filter((x: any) => x.id === record.id) : [];
    if (matches.length !== 1 || matches[0].projectId !== record.projectId || matches[0].kind !== record.kind)
      issues.push({ code: 'SOURCE_ARTIFACT_MISMATCH', path: record.sourcePath, message: `The pinned source must contain exactly one matching ${record.id}` });
  }
  for (const work of bundle.workContexts) {
    const parsed = await parse(work.sourcePath, work.sourceSha256);
    if (parsed && (parsed.projectId !== work.projectId || parsed.workId !== work.workId)) issues.push({ code: 'SOURCE_WORK_MISMATCH', path: work.sourcePath, message: 'Work context pair does not match its pinned source' });
  }
  for (const revision of bundle.revisions.filter(r => r.type === 'source_document')) {
    const { sourcePath, sha256, jsonPointer, legacyId } = revision.core.details;
    if (typeof sourcePath !== 'string' || typeof sha256 !== 'string') { issues.push({ code: 'SOURCE_PIN_MISSING', path: revision.id, message: 'Source documents need an explicit sourcePath and SHA-256' }); continue; }
    let parsed = await parse(sourcePath, sha256);
    if (parsed && typeof jsonPointer === 'string') {
      if (!jsonPointer.startsWith('/')) { issues.push({ code: 'SOURCE_LOCATOR_INVALID', path: sourcePath, message: 'Expected a JSON Pointer' }); continue; }
      for (const token of jsonPointer.slice(1).split('/')) parsed = parsed?.[token.replace(/~1/g, '/').replace(/~0/g, '~')];
      if (!parsed || (legacyId && (parsed.typeId ?? parsed.subtypeId) !== legacyId)) issues.push({ code: 'SOURCE_LOCATOR_MISMATCH', path: sourcePath, message: 'Source pointer or original legacy identity does not match' });
    }
  }
  return issues;
}
