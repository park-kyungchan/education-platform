import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const manifest = JSON.parse(readFileSync(join(root, 'docs/runtime-exposure-manifest.json'), 'utf8'));

function registeredTools(): string[] {
  const names = new Set<string>();
  for (const f of readdirSync(join(root, 'src')).filter((x) => x.endsWith('.ts'))) {
    const text = readFileSync(join(root, 'src', f), 'utf8');
    for (const m of text.matchAll(/registerTool\('([a-z0-9_]+)'/g)) names.add(m[1]);
  }
  return [...names].sort();
}

describe('runtime exposure manifest (P2)', () => {
  test('manifest matches registered tools exactly', () => {
    const declared = manifest.tools.map((t: { name: string }) => t.name).sort();
    expect(declared).toEqual(registeredTools());
  });
  test('all declared tools are read class and open', () => {
    for (const t of manifest.tools) {
      expect(t.class).toBe('read');
      expect(t.exposure).toBe('open');
    }
    expect(manifest.closedUntilAttribution).toEqual([]);
  });
});
