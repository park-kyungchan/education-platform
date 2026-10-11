import {test, expect} from 'bun:test';
import {existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {canonicalNames, inventoryCanonical, writableProbe} from '../scripts/validate-runtime.ts';
const root = resolve(import.meta.dir, '..');
test('runtime commands use the project compiler through Bun without startup instructions', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {scripts: Record<string, string>};
  expect(pkg.scripts.typecheck).toBe('bun ./node_modules/typescript/bin/tsc --noEmit');
  expect(pkg.scripts.validate).not.toContain('scripts/validate-export.ts');
  expect(existsSync(resolve(root, 'AGENTS.md'))).toBe(false);
  expect(existsSync(resolve(root, 'scripts/cloud/START_SKILL.md'))).toBe(false);
});
test('historical absence and later canonical presence are separate', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'math-runtime-fixture-'));
  try {
    mkdirSync(join(fixture, 'canonical'));
    writeFileSync(join(fixture, 'canonical/required-sources.json'), JSON.stringify({files: canonicalNames.map(name => ({name}))}));
    expect(inventoryCanonical(fixture).every(item => item.status === 'absent')).toBe(true);
    for (const name of canonicalNames) writeFileSync(join(fixture, 'canonical', name), JSON.stringify({unverified: true}));
    const result = inventoryCanonical(fixture);
    expect(result).toHaveLength(5);
    expect(result.every(item => item.status === 'present-unverified')).toBe(true);
    expect(result.every(item => item.canonicalVerified === false)).toBe(true);
  } finally { rmSync(fixture, {recursive: true, force: true}); }
});
test('a declared checksum match never promotes an input to verified canonical', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'math-runtime-pin-fixture-'));
  try {
    mkdirSync(join(fixture, 'canonical'));
    const bytes = Buffer.from('unverified bytes');
    const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
    writeFileSync(join(fixture, 'canonical/required-sources.json'), JSON.stringify({files: [{name: 'domain-01.json', workpackSha256: hash}]}));
    writeFileSync(join(fixture, 'canonical/domain-01.json'), bytes);
    const record = inventoryCanonical(fixture)[0]!;
    expect(record.status).toBe('present-unverified');
    expect('matchesDeclaredChecksum' in record && record.matchesDeclaredChecksum).toBe(true);
    expect(record.canonicalVerified).toBe(false);
  } finally { rmSync(fixture, {recursive: true, force: true}); }
});

test('writability checks the actual nested projection location', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'math-runtime-output-fixture-'));
  try {
    mkdirSync(join(fixture, '.generated'));
    const target = join(fixture, '.generated/ui-projections');
    writeFileSync(target, 'an existing file cannot be a projection directory');
    expect(writableProbe(target).writable).toBe(false);
  } finally { rmSync(fixture, {recursive: true, force: true}); }
});
test('symlinked output or cache directories retain writable checks', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'math-runtime-symlink-fixture-'));
  try {
    const actual = join(fixture, 'actual-cache');
    mkdirSync(actual);
    const alias = join(fixture, 'cache-link');
    symlinkSync(actual, alias, 'dir');
    expect(writableProbe(alias).writable).toBe(true);
  } finally { rmSync(fixture, {recursive: true, force: true}); }
});
