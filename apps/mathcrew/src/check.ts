import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { copy, identity } from './content';
import { renderPage, pageFiles } from './render';
import { publicFiles, fontAssets } from './static-assets';
import { validateRenderedGeometry } from './geometry-validation';
import { validateSpatial } from './spatial-validation';
import { publicVision } from '../public-vision';
import { developmentSnapshot } from './development-snapshot';
import { validatePublicSnapshot, validateExternalLink } from './development-sources';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
assert.equal(Bun.version, '1.4.3');
assert.equal(identity.origin, publicVision.exactPublicTarget);
assert.equal(identity.productURL, publicVision.onlyPublicProductLink);
assert.deepEqual(Object.keys(copy.en).sort(), Object.keys(copy.ko).sort());
const sources = validatePublicSnapshot(developmentSnapshot).repositories;
assert(sources.length >= 1 && sources.length <= 6, 'operator-selected snapshot contains one to six source identities');
for (const language of ['en', 'ko'] as const) for (const page of ['home', 'privacy', 'site-use', '404'] as const) {
  const html = renderPage(page, language);
  const path = `dist/${language === 'ko' ? 'ko/' : ''}${pageFiles[page]}`;
  assert.equal(await Bun.file(new URL(path, root)).text(), html, `source emitted ${path}`);
  assert(!/<script|<form|<iframe|<input|<base\b/.test(html));
  assert(!/application-authored|subscription|payment|Bible|SPT/.test(html));
  for (const [, tag, href] of html.matchAll(/<(\w+)\b[^>]*?\b(?:href|src)="([^"]+)"/g)) {
    if (/^https?:/.test(href!)) validateExternalLink(tag!, href!, sources, identity.origin, identity.productURL);
    else assert(href!.startsWith('/') || href!.startsWith('#') || href === `mailto:${identity.email}`, 'rooted public resource/navigation');
  }
  if (page === 'home') { validateRenderedGeometry(html); validateSpatial(html); assert.equal([...html.matchAll(/class="source-row"/g)].length, sources.length); }
}
const css = await Bun.file(new URL('src/styles.css', root)).text();
assert(css.includes("src: url('/assets/fonts/NanumGothic-Regular.ttf')"));
assert(css.includes('[lang="ko"], [lang="ko"] * { font-family: var(--type); }'));
assert(css.includes('prefers-reduced-motion: reduce'));
assert(css.includes(':focus-visible'));
assert(!/@import|https?:\/\/|local\(/.test(css));
const provenance = await Bun.file(new URL('src/assets/fonts/font-source.json', root)).json();
const font = new Uint8Array(await Bun.file(new URL('src/assets/fonts/NanumGothic-Regular.ttf', root)).arrayBuffer());
assert.equal(createHash('sha256').update(font).digest('hex'), provenance.sha256);
assert.equal(font.length, provenance.bytes);
assert((await Bun.file(new URL('src/assets/fonts/nanum-gothic-license.txt', root)).text()).includes('SIL OPEN FONT LICENSE'));
for (const asset of fontAssets) assert.deepEqual(new Uint8Array(await Bun.file(new URL(`src/${asset}`, root)).arrayBuffer()), new Uint8Array(await Bun.file(new URL(`dist/${asset}`, root)).arrayBuffer()));
async function files(path: string, prefix = ''): Promise<string[]> { const out: string[] = []; for (const entry of await readdir(path, { withFileTypes: true })) { const name = prefix + entry.name; if (entry.isDirectory()) out.push(...await files(join(path, entry.name), name + '/')); else out.push(name); } return out.sort(); }
assert.deepEqual(await files(fileURLToPath(new URL('dist/', root))), [...publicFiles].sort());
// Parse/bundle all implementation modules without installing dependencies or starting a listener.
const bundled = await Bun.build({ entrypoints: ['src/build.ts', 'src/render.ts', 'src/development-sources.ts', 'src/development-snapshot.ts', 'src/preview-handler.ts', 'src/spatial-validation.ts', 'src/verify.ts'], target: 'bun', write: false });
assert(bundled.success, bundled.logs.map(String).join('\n'));
console.log(JSON.stringify({ status: 'PASS', pages: 8, publicFiles: publicFiles.length, checks: ['public semantics', 'source-emitted geometry', 'rooted routes', 'local font hash/license', 'publication allowlist', 'Bun syntax/import bundling'], typeChecking: 'No TypeScript type checker installed or claimed', browserAcceptance: 'Pending independent Lead review', network: false, listenerStarted: false }));
