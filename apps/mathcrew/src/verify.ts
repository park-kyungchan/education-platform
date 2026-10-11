import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function pins(directory: string, prefix = ''): Promise<{ path: string; bytes: number; sha256: string }[]> {
  const result: { path: string; bytes: number; sha256: string }[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await pins(join(directory, entry.name), path + '/'));
    else {
      const bytes = await readFile(join(directory, entry.name));
      result.push({ path, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  return result.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function run(script: string) {
  const process = Bun.spawnSync([processExecPath, '--no-env-file', 'run', script], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  console.log(`$ bun --no-env-file run ${script}`);
  process.stdout.length && console.log(new TextDecoder().decode(process.stdout));
  process.stderr.length && console.error(new TextDecoder().decode(process.stderr));
  assert.equal(process.exitCode, 0, `${script} failed`);
}
const processExecPath = process.execPath;
run('build');
const first = await pins(join(root, 'dist'));
run('test');
run('check');
run('build');
const second = await pins(join(root, 'dist'));
assert.deepEqual(second, first, 'two builds must be byte-identical');
const expected = JSON.parse(await readFile(join(root, 'tests/fixtures/expected-dist.json'), 'utf8'));
assert.deepEqual(second, expected, 'V5 expected public output must match exactly');
console.log(JSON.stringify({ status: 'PASS', generation: 'V5', deterministicBuild: true, expectedOutputMatched: true, byteIdenticalToV4: false, dist: second, networkProviderCalls: false, listenerStarted: false, typeChecking: 'Bun syntax/import bundling only', browserAcceptance: 'Not performed by this command' }));
