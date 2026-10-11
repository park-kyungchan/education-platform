import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
type UiView = { name: string; viewId: string; currentFile: string; currentHtmlSha256: string };
type PayloadEnvelope = { encoding: string; decodedBytes: number; maxDecodedBytes: number; sha256: string; data: string };
export function decodeUi(html: string): unknown {
  const match = html.match(/<script type="application\/json" id="me-payload">([\s\S]*?)<\/script>/);
  if (!match?.[1]) throw new Error('UI payload missing');
  const e = JSON.parse(match[1]) as PayloadEnvelope;
  if (e.encoding !== 'gzip-base64' || e.decodedBytes > e.maxDecodedBytes) throw new Error('Invalid UI envelope');
  const bytes = Bun.gunzipSync(Buffer.from(e.data, 'base64'));
  if (bytes.length !== e.decodedBytes || createHash('sha256').update(bytes).digest('hex') !== e.sha256) throw new Error('UI projection digest mismatch');
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
if (import.meta.main) {
  const root = resolve(import.meta.dir,'..');
  const m = JSON.parse(readFileSync(resolve(root,'derived/ui/ui-source-manifest.json'),'utf8')) as { views: UiView[] };
  const out = resolve(root,'.generated/ui-projections'); mkdirSync(out,{ recursive:true });
  for (const v of m.views) {
    const html = readFileSync(resolve(root,'derived/ui',v.currentFile),'utf8');
    if (createHash('sha256').update(html).digest('hex') !== v.currentHtmlSha256) throw new Error(`HTML digest mismatch: ${v.name}`);
    writeFileSync(resolve(out,`${v.name}.json`),JSON.stringify({ kind:'DerivedUiProjection', canonicalWorkpack:false, viewId:v.viewId, sourceHtmlSha256:v.currentHtmlSha256, data:decodeUi(html) },null,2)+'\n');
  }
  console.log(`Extracted ${m.views.length} derived UI projections. These do not recover the missing canonical workpacks.`);
}
