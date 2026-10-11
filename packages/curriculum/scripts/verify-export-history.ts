import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

type Digest = {path: string; sha256: string; bytes: number};
type Mapping = {originalPath: string; historicalPath: string; originalSha256: string; originalBytes: number};
type Manifest = {history: {originalFiles: Digest[]; sourceMapping: Mapping[]}};
type Attachment = {status: string; path?: string; sourceSha256?: string; sourceByteSize?: number};
const root = resolve(import.meta.dir, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'runtime.manifest.json'), 'utf8')) as Manifest;
const mapping = new Map(manifest.history.sourceMapping.map(item => [item.originalPath, item]));
const source = (path: string) => readFileSync(resolve(root, mapping.get(path)?.historicalPath ?? path));
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
for (const original of manifest.history.originalFiles) {
  const bytes = source(original.path);
  assert.equal(bytes.length, original.bytes, original.path);
  assert.equal(digest(bytes), original.sha256, original.path);
}
const historicalDigests = JSON.parse(source('provenance/file-digests.json').toString('utf8')) as Digest[];
for (const entry of historicalDigests) {
  const bytes = source(entry.path);
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(digest(bytes), entry.sha256, entry.path);
}
const inventory = JSON.parse(source('provenance/attachment-inventory.json').toString('utf8')) as Attachment[];
for (const item of inventory) {
  if (item.status !== 'exported') continue;
  assert(item.path);
  const bytes = source(item.path);
  assert.equal(bytes.length, item.sourceByteSize, item.path);
  assert.equal(digest(bytes), item.sourceSha256, item.path);
}
const coverage = JSON.parse(source('provenance/export-coverage.json').toString('utf8')) as {canonicalRelationsDeclared: number; relationAssertionsIndividuallyRead: number; relationAssertionsUnread: number; canonicalWorkpacksExported: number; cloudTaskLaunched: boolean};
assert.equal(coverage.canonicalRelationsDeclared, coverage.relationAssertionsIndividuallyRead + coverage.relationAssertionsUnread);
assert.equal(coverage.canonicalWorkpacksExported, 0);
assert.equal(coverage.cloudTaskLaunched, false);
const originalPaths = new Set(manifest.history.originalFiles.map(file => file.path));
for (const name of ['domain-01.json', 'domain-02.json', 'domain-03.json', 'domain-04.json', 'curriculum-boundary.json']) assert.equal(originalPaths.has('canonical/' + name), false);
console.log(JSON.stringify({originalArchiveFilesVerified: manifest.history.originalFiles.length, historicalExportDigestsVerified: historicalDigests.length, originalAttachmentsVerified: inventory.filter(item => item.status === 'exported').length, modifiedOrExcludedOriginalFilesVerified: mapping.size, currentWorkspaceCanonicalInputApproval: false, targetVpsExecutionVerified: false}));
