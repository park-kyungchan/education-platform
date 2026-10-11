import { test, expect } from 'bun:test';
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// Explicit public source only. Exclude this regression from the synthetic
// checkout so verify runs the original tests without recursively spawning us.
const checkoutFiles = [
  '.github/workflows/ci.yml', '.gitignore', 'README.md', 'design-plan.ts',
  'package.json', 'public-vision.ts',
  'src/assets/fonts/NanumGothic-Regular.ttf', 'src/assets/fonts/font-source.json',
  'src/assets/fonts/nanum-gothic-license.txt', 'src/build.ts', 'src/check.ts',
  'src/content.ts', 'src/geometry-validation.ts', 'src/preview-handler.ts',
  'src/render.ts', 'src/spatial-validation.ts', 'src/spatial.ts',
  'src/static-assets.ts', 'src/styles.css', 'src/verify.ts',
  'src/data-snapshot.ts', 'src/development-sources.ts', 'src/development-snapshot.ts', 'tests/development.test.ts',
  'tests/fallback.test.ts', 'tests/fixtures/expected-dist.json',
  'tests/font-coverage.test.ts', 'tests/geometry-mutant.test.ts',
  'tests/spatial.test.ts', 'tests/vision.test.ts',
];

test('documented gates work in a space and Korean checkout without encoded sibling writes', async () => {
  const temporaryRoot = process.env.TMPDIR || tmpdir();
  const base = await mkdtemp(join(temporaryRoot, 'mathcrew-portability-'));
  const name = 'mathCrew public 한글';
  const checkout = join(base, name);
  const root = fileURLToPath(new URL('../', import.meta.url));
  try {
    for (const path of checkoutFiles) {
      const target = join(checkout, path);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(root, path), target);
    }
    for (const gate of ['build', 'check', 'verify']) {
      const result = Bun.spawnSync([process.execPath, '--no-env-file', 'run', gate], {
        cwd: checkout, stdout: 'pipe', stderr: 'pipe',
      });
      const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
      expect(result.exitCode, `${gate}: ${output}`).toBe(0);
      // Check after each gate, including build, which formerly wrote a sibling.
      expect((await readdir(base)).sort()).toEqual([name]);
      expect(await Bun.file(join(base, encodeURIComponent(name), 'dist/assets/fonts/NanumGothic-Regular.ttf')).exists()).toBe(false);
    }
    const expected = await Bun.file(join(checkout, 'tests/fixtures/expected-dist.json')).json();
    for (const row of expected) {
      const bytes = new Uint8Array(await Bun.file(join(checkout, 'dist', row.path)).arrayBuffer());
      expect(bytes.length).toBe(row.bytes);
      expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(row.sha256);
    }
  } finally {
    // Only the uniquely allocated temporary base is removed.
    await rm(base, { recursive: true, force: true });
  }
}, 30_000);
