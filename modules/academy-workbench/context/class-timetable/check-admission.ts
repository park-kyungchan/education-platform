import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { platformRoot } from './validate.ts';

/** Verify the scoped approval against bytes without interpreting or emitting student data. */
export async function checkAdmission(root: string = platformRoot): Promise<void> {
  const record = JSON.parse(await readFile(resolve(root, 'provenance/class-timetable-admission-20261028.json'), 'utf8'));
  const path = 'modules/academy-workbench/context/class-timetable/timetable.json';
  if (record.schema !== 'education.class-timetable-private-admission.v1' || record.repository !== 'park-kyungchan/education-platform' || record.visibility !== 'private' || record.file !== path || !/^[a-f0-9]{64}$/.test(record.sha256)) throw Error('class_timetable_admission_invalid');
  const actual = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
  if (actual !== record.sha256) throw Error('class_timetable_admission_hash_mismatch');
}
