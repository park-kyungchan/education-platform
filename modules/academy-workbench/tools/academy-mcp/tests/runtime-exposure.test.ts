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

// Hermes dc-gang-a-dev profile toolset names observed 2026-10-26 (config.yaml
// platform/known toolsets; names only). Academy tools must not collide (P6).
const HERMES_TOOLSETS = ['browser','clarify','code_execution','computer_use','connections','context_engine','cronjob','delegation','discord','discord_admin','file','image_gen','kanban','memory','project','session_search','skills','spotify','stt','terminal','todo','tts','video','video_gen','vision','web','x_search','yuanbao','a2a','native_task_controls'];
const HERMES_MCP_SERVERS = ['cloudflare','vercel','github'];

describe('runtime exposure manifest (P2)', () => {
  test('no collision with Hermes toolsets or MCP server names', () => {
    for (const t of manifest.tools) {
      expect(HERMES_TOOLSETS).not.toContain(t.name);
      expect(HERMES_MCP_SERVERS).not.toContain(t.name);
    }
  });
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
