import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

type View = { pageId: string; currentFile: string; baselineFile: string; currentHtmlSha256: string; baselineHtmlSha256: string; payloadSha256: string };
const root = resolve(import.meta.dir, '../derived/ui');
const manifest = JSON.parse(readFileSync(resolve(root, 'ui-source-manifest.json'), 'utf8')) as { views: View[] };
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const payload = (html: string) => {
  const opening = '<script type="application/json" id="me-payload">';
  const start = html.indexOf(opening);
  assert(start >= 0);
  const end = html.indexOf('</script>', start + opening.length);
  assert(end > start);
  return html.slice(start + opening.length, end);
};
assert.equal(manifest.views.length, 48);
assert.equal(new Set(manifest.views.map(view => view.pageId)).size, 48);
for (const view of manifest.views) {
  const current = readFileSync(resolve(root, view.currentFile));
  const baseline = readFileSync(resolve(root, view.baselineFile));
  assert.equal(sha(current), view.currentHtmlSha256, view.pageId);
  assert.equal(sha(baseline), view.baselineHtmlSha256, view.pageId);
  const currentPayload = payload(current.toString('utf8'));
  assert.equal(currentPayload, payload(baseline.toString('utf8')), view.pageId);
  assert.equal(sha(currentPayload), view.payloadSha256, view.pageId);
}
console.log(JSON.stringify({ views: 48, exactHtmlHashesVerified: true, publishedPayloadBytesUnchanged: true, canonicalMathematicalAuditClaimed: false }));
