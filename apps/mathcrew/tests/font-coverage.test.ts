import { test, expect } from 'bun:test';
import { renderPage } from '../src/render';

// Directly inspect the exact local font's Unicode cmap. This is glyph-map
// coverage only: it does not accept browser rendering or replace screenshots.
test('exact bundled TTF has a nonzero glyph mapping for every Korean codepoint in all pages and controls', async () => {
  const bytes = Buffer.from(await Bun.file(new URL('../src/assets/fonts/NanumGothic-Regular.ttf', import.meta.url)).arrayBuffer());
  let cmap = -1;
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const table = 12 + i * 16;
    if (bytes.toString('ascii', table, table + 4) === 'cmap') cmap = bytes.readUInt32BE(table + 8);
  }
  expect(cmap).toBeGreaterThan(0);
  const unicodeSubtables: number[] = [];
  for (let i = 0; i < bytes.readUInt16BE(cmap + 2); i++) {
    const entry = cmap + 4 + i * 8;
    const platform = bytes.readUInt16BE(entry);
    const encoding = bytes.readUInt16BE(entry + 2);
    if (platform === 0 || (platform === 3 && [1, 10].includes(encoding))) unicodeSubtables.push(cmap + bytes.readUInt32BE(entry + 4));
  }
  function glyph(codepoint: number, table: number): number {
    const format = bytes.readUInt16BE(table);
    if (format === 12) {
      for (let i = 0; i < bytes.readUInt32BE(table + 12); i++) {
        const group = table + 16 + i * 12;
        const start = bytes.readUInt32BE(group), end = bytes.readUInt32BE(group + 4);
        if (codepoint >= start && codepoint <= end) return bytes.readUInt32BE(group + 8) + codepoint - start;
      }
    }
    if (format === 4 && codepoint <= 65535) {
      const count = bytes.readUInt16BE(table + 6) / 2;
      const ends = table + 14, starts = ends + count * 2 + 2, deltas = starts + count * 2, ranges = deltas + count * 2;
      for (let i = 0; i < count; i++) {
        const start = bytes.readUInt16BE(starts + i * 2), end = bytes.readUInt16BE(ends + i * 2);
        if (codepoint < start || codepoint > end) continue;
        const delta = bytes.readInt16BE(deltas + i * 2), range = bytes.readUInt16BE(ranges + i * 2);
        if (range === 0) return (codepoint + delta) & 65535;
        const value = bytes.readUInt16BE(ranges + i * 2 + range + (codepoint - start) * 2);
        return value === 0 ? 0 : (value + delta) & 65535;
      }
    }
    return 0;
  }
  const chars = new Set<string>();
  for (const language of ['en', 'ko'] as const) for (const page of ['home', 'privacy', 'site-use', '404'] as const) {
    for (const ch of renderPage(page, language)) if (/\p{Script=Hangul}/u.test(ch)) chars.add(ch);
  }
  expect(chars.size).toBeGreaterThan(100);
  const missing = [...chars].filter(ch => !unicodeSubtables.some(table => glyph(ch.codePointAt(0)!, table) > 0));
  expect(missing).toEqual([]);
  console.log(`Static cmap coverage: ${chars.size} unique Korean codepoints; browser glyph acceptance remains pending.`);
});
