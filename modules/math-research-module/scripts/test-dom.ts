import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(root + '.test-build', { recursive: true });
for (const name of ['entry', 'action-entry', 'research-entry']) {
  const result = await Bun.build({ entrypoints: [root + `tests/entries/${name}.tsx`], outdir: root + '.test-build', naming: '[name].[ext]', target: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': JSON.stringify('test') } });
  if (!result.success) throw new Error(result.logs.map(String).join('\n'));
}
for (const name of ['contexttest', 'actiontest', 'researchtest']) {
  const child = Bun.spawn(['node', root + `tests/dom/${name}.cjs`], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`DOM test failed: ${name}`);
}
