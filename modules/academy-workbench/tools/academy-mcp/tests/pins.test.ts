import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { repoRoot } from '../src/paths.ts';
import { digest } from '../src/pagination.ts';
import { loadSavedContext } from '../src/saved-context.ts';
import { syntheticInputs } from './fixtures.ts';

async function fixture(run: (root: string, auditText: string) => Promise<void>) {
  const base = resolve(repoRoot, '.local/academy-mcp/tmp');
  await mkdir(base, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(resolve(base, 'source-pin-test-'));
  try {
    const input = syntheticInputs(), auditText = JSON.stringify(input.audit), lessonText = JSON.stringify(input.lesson);
    const files = [
      { path: 'private/student-audit-20261014/audit.json', text: auditText },
      { path: 'private/lesson-20261014/overlay.json', text: lessonText },
    ];
    await mkdir(resolve(root, 'tools/academy-mcp/architecture'), { recursive: true });
    await mkdir(resolve(root, 'private/student-audit-20261014'), { recursive: true });
    await mkdir(resolve(root, 'private/lesson-20261014'), { recursive: true });
    for (const file of files) await writeFile(resolve(root, file.path), file.text, { mode: 0o600 });
    await writeFile(resolve(root, 'tools/academy-mcp/architecture/source-pins.json'), JSON.stringify({ files: files.map(file => ({ path: file.path, sha256: digest(file.text) })) }), { mode: 0o600 });
    await run(root, auditText);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('pinned loader accepts exact bytes and refuses a changed preserved input', async () => {
  await fixture(async (root, auditText) => {
    const context = await loadSavedContext(root);
    expect(context.query({ query: { kind: 'roster' } }).records).toHaveLength(5);
    await writeFile(resolve(root, 'private/student-audit-20261014/audit.json'), auditText + ' ');
    await expect(loadSavedContext(root)).rejects.toThrow('pinned_input_changed');
  });
});
test('pinned loader refuses a symlink instead of following a substituted source', async () => {
  await fixture(async (root, auditText) => {
    const source = resolve(root, 'private/student-audit-20261014/audit.json');
    const substitute = resolve(root, 'substitute.json');
    await writeFile(substitute, auditText, { mode: 0o600 });
    await rm(source);
    await symlink(substitute, source);
    await expect(loadSavedContext(root)).rejects.toThrow('pinned_input_file_invalid');
  });
});
