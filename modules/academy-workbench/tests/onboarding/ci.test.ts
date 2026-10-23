import { afterEach, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { moduleRoot, readPin } from '../../scripts/agent-platform.ts';
import { decodeDependencyArchive } from '../../ci/restore-dependency.ts';
import { verifyProjection } from '../../ci/verify-projection.ts';
import { runV2ReviewGate } from '../../ci/require-v2-receipt.ts';
const originalFetch = globalThis.fetch, originalEnv = { ...process.env };
afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...originalEnv }; });
test('finite generated dependency archive has exactly the immutable canonical source denominator', async () => {
  const archive = await readFile(resolve(moduleRoot, 'ci/generated/agent-platform-ffba-source.json.gz')), pin = await readPin();
  expect((await verifyProjection()).status).toBe('pass');
  expect([...decodeDependencyArchive(archive, pin).keys()]).toEqual(pin.files.map(row => row.path));
  const original = JSON.parse(gunzipSync(archive).toString());
  for (const mutate of [
    (value: any) => value.files.push({ path: 'private/session.json', bytesBase64: 'e30=' }),
    (value: any) => value.files[0].path = '../outside',
    (value: any) => value.files[0].bytesBase64 = 'c3ludGhldGljLWRyaWZ0',
    (value: any) => value.files[0].type = 'symlink',
  ]) { const value = structuredClone(original); mutate(value); expect(() => decodeDependencyArchive(gzipSync(JSON.stringify(value)), pin)).toThrow(); }
});
test('Academy V2 policy checks the actual canonical response and restores fetch on failure', async () => {
  const head = 'a'.repeat(40), receiptCommit = 'b'.repeat(40);
  process.env.GITHUB_REPOSITORY = 'example/academy'; process.env.REVIEW_HEAD_SHA = head; process.env.GITHUB_TOKEN = 'synthetic-test-token';
  let schema = 'native-independent-review.v1';
  globalThis.fetch = (async () => {
    const bytes = Buffer.from(JSON.stringify({ schema }));
    const value = { type: 'file', encoding: 'base64', size: bytes.length, content: bytes.toString('base64') };
    return new Response(JSON.stringify(value), { status: 200 });
  }) as unknown as typeof fetch;
  const transport = globalThis.fetch;
  const gate = async () => { await fetch(`https://api.github.com/repos/example/academy/contents/native-reviews/${head}.json?ref=${receiptCommit}`); };
  await expect(runV2ReviewGate(gate)).rejects.toThrow('requires'); expect(globalThis.fetch).toBe(transport);
  schema = 'native-independent-review.v2'; await runV2ReviewGate(gate); expect(globalThis.fetch).toBe(transport);
  await expect(runV2ReviewGate(async () => {})).rejects.toThrow('did not consume');
  await expect(runV2ReviewGate(async () => { await gate(); throw Error('canonical-rejected-authorship'); })).rejects.toThrow('canonical-rejected-authorship');
  expect(globalThis.fetch).toBe(transport);
});
