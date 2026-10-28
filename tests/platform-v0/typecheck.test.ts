import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

// The imported academy module owns its compiler settings. Keep its TypeScript
// closure out of the root harness's different noUncheckedIndexedAccess policy.
test('platform V0 contracts typecheck with the owning academy module settings', async () => {
  const compiler = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));
  const config = fileURLToPath(new URL('./tsconfig.json', import.meta.url));
  const child = Bun.spawn([process.execPath, compiler, '--noEmit', '-p', config], {
    stdout: 'pipe', stderr: 'pipe', env: { ...process.env, BUN_ENV: 'test' },
  });
  const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (exit !== 0) throw Error(`platform_v0_typecheck_failed@tests/platform-v0/typecheck.test.ts:13\n${stdout}${stderr}`);
  expect(exit).toBe(0);
}, 30_000);
