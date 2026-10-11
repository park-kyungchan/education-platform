import {existsSync, lstatSync, statSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {createHash} from 'node:crypto';

export const canonicalNames = ['domain-01.json', 'domain-02.json', 'domain-03.json', 'domain-04.json', 'curriculum-boundary.json'] as const;
type SourcePin = {name: string; workpackSha256?: string};
export function inventoryCanonical(root: string) {
  const pins = JSON.parse(readFileSync(resolve(root, 'canonical/required-sources.json'), 'utf8')) as {files: SourcePin[]};
  return canonicalNames.map(name => {
    const path = resolve(root, 'canonical', name);
    const pin = pins.files.find(item => item.name === name);
    const expectedSha256 = pin?.workpackSha256 && /^[a-f0-9]{64}$/.test(pin.workpackSha256) ? pin.workpackSha256 : null;
    const base = {name, path, expectedSha256, canonicalVerified: false};
    if (!existsSync(path)) return {...base, status: 'absent'};
    if (!lstatSync(path).isFile()) return {...base, status: 'non-regular-unverified'};
    const bytes = readFileSync(path);
    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    return {...base, status: 'present-unverified', bytes: bytes.length, actualSha256, matchesDeclaredChecksum: expectedSha256 ? actualSha256 === expectedSha256 : null};
  });
}
export function writableProbe(target: string) {
  let parent = resolve(target);
  while (!existsSync(parent)) {
    const next = dirname(parent);
    if (next === parent) return {target, writable: false, error: 'No existing parent.'};
    parent = next;
  }
  let probe: string | undefined;
  try {
    if (!statSync(parent).isDirectory()) throw new Error('Existing parent is not a directory.');
    probe = mkdtempSync(join(parent, '.math-runtime-probe-'));
    const file = join(probe, 'write-test');
    writeFileSync(file, 'MathEducation runtime write probe\n', {flag: 'wx'});
    const writable = readFileSync(file, 'utf8') === 'MathEducation runtime write probe\n';
    return {target: resolve(target), existingParent: parent, writable};
  } catch (error) {
    return {target: resolve(target), existingParent: parent, writable: false, error: String(error)};
  } finally {
    if (probe) rmSync(probe, {recursive: true, force: true});
  }
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..');
  console.log(JSON.stringify({
    kind: 'MathEducationWorkspaceRuntimeValidation',
    canonicalInputs: inventoryCanonical(root),
    canonicalImportValidationPerformed: false,
    fullRelationAudit: 'blocked-pending-verified-original-import',
    targetVpsExecutionVerified: false,
    historicalExportCoverageIsCurrentWorkspaceApproval: false,
  }, null, 2));
}
