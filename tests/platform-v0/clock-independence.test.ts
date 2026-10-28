import { expect, test } from 'bun:test';

// Change the wall clock only in a disposable child, preserving other root tests.
test('platform V0 synthetic read remains valid after its fixed grant expiry on the wall clock', async () => {
  const fixtureUrl = new URL('./synthetic-read.mts', import.meta.url).href;
  const program = `
    import { fixture, ctx, request } from ${JSON.stringify(fixtureUrl)};
    Date.now = () => Date.parse('2035-11-01T00:00:00.000Z');
    const result = await fixture().service.typedRead(ctx, request());
    console.log(JSON.stringify({ kind: result.kind, studentKeys: result.items.flatMap(item => item.kind === 'OBJECT' && item.record.identity.objectType === 'Student' ? [item.record.identity.nativeKey] : []) }));
  `;
  const child = Bun.spawn([process.execPath, '--no-env-file', '--eval', program], { stdout: 'pipe', stderr: 'pipe' });
  const [exit, stdout] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect(exit).toBe(0);
  expect(JSON.parse(stdout)).toEqual({ kind: 'OK', studentKeys: ['student-a'] });
}, 30_000);
