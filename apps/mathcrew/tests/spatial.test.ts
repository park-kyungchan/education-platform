import { expect, test } from 'bun:test';
import { renderPage } from '../src/render';
import { validateSpatial } from '../src/spatial-validation';
import { publicFiles } from '../src/static-assets';
import { handlePreview } from '../src/preview-handler';

test('actual spatial SVG is precise; displaced vertex and polygon mutants fail', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = renderPage('home', language);
    validateSpatial(html);
    const vertex = html.replace('data-space="1,0.5,0" cx="415"', 'data-space="1,0.5,0" cx="425"');
    expect(vertex).not.toBe(html);
    expect(() => validateSpatial(vertex)).toThrow('actual vertex projection');
    const polygon = html.replace('points="415,483', 'points="425,483');
    expect(polygon).not.toBe(html);
    expect(() => validateSpatial(polygon)).toThrow('polygon follows actual vertices');
  }
});

test('every generated page matches source rendering and public files route correctly', async () => {
  for (const language of ['en', 'ko'] as const) for (const [page, filename] of [['home', 'index.html'], ['privacy', 'privacy.html'], ['site-use', 'site-use.html'], ['404', '404.html']] as const) {
    const path = `${language === 'ko' ? 'ko/' : ''}${filename}`;
    const html = await Bun.file(new URL(`../dist/${path}`, import.meta.url)).text();
    expect(html).toBe(renderPage(page, language));
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(match[1]);
    for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) for (const id of match[1]!.split(' ')) expect(ids).toContain(id);
  }
  for (const filename of publicFiles) {
    const r = await handlePreview(new Request(`https://kcpalantir.tech/${filename}`));
    expect(r.status).toBe(200);
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const head = await handlePreview(new Request(`https://kcpalantir.tech/${filename}`, { method: 'HEAD' }));
    expect(await head.text()).toBe('');
  }
  expect((await handlePreview(new Request('https://kcpalantir.tech/ko'))).headers.get('Location')).toBe('/ko/');
  for (const path of ['/public-vision.ts', '/src/content.ts', '/result.json', '/source-manifest.json', '/evidence/synthetic-log.txt', '/private/synthetic-record.ts', '/assets/fonts/font-source.json']) expect((await handlePreview(new Request(`https://kcpalantir.tech${path}`))).status).toBe(404);
  expect((await handlePreview(new Request('https://kcpalantir.tech/', { method: 'POST' }))).status).toBe(405);
});
