/** Consumer transport glue only. All Artifact/WorkContext semantics stay upstream. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export interface FilePin { path: string; sha256: string; gitBlobSha1?: string }
export interface PlatformPin {
  schemaVersion: 'agent-platform.consumer-pin/1'; repository: string; commit: string;
  scope: string; files: FilePin[]; installedOntologyFiles: FilePin[];
  importResolutionPins: Array<{ importer: string; specifier: string; expectedPath: string }>;
  authority: 'none'; nativePermissionGranted: false;
}
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')); }
export async function readPin(): Promise<PlatformPin> {
  return await readJson(resolve(moduleRoot, 'harness/agent-platform.lock.json')) as PlatformPin;
}
function inside(root: string, path: string) {
  const part = relative(root, path);
  return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}
export async function verifyFilePins(root: string, pins: FilePin[]): Promise<void> {
  for (const pin of pins) {
    const path = resolve(root, pin.path);
    if (!inside(root, path) || await realpath(path) !== path) throw Error(`Unsafe pinned path: ${pin.path}`);
    const bytes = await readFile(path);
    if (sha256(bytes) !== pin.sha256) throw Error(`Source drift: ${pin.path}`);
    if (pin.gitBlobSha1) {
      const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (blob !== pin.gitBlobSha1) throw Error(`Git blob mismatch: ${pin.path}`);
    }
  }
}
export async function verifyPlatform(options: { root?: string; snapshot?: boolean; installed?: boolean } = {}) {
  const pin = await readPin();
  const root = await realpath(options.root ?? process.env.AGENT_PLATFORM_ROOT ?? resolve(moduleRoot, '.harness-deps/agent-platform'));
  const snapshot = options.snapshot ?? process.env.AGENT_PLATFORM_SOURCE_MODE === 'pinned-snapshot';
  if (!snapshot) {
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (head !== pin.commit) throw Error(`Expected agent-platform ${pin.commit}; observed ${head}`);
    if (execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()) {
      throw Error('Tracked agent-platform source changes require review; this consumer does not reset them.');
    }
  }
  await verifyFilePins(root, pin.files);
  // Bun's resolver performs TS fallback for explicit .js and extensionless imports.
  // URL resolution alone returns the literal .js path and misses shadow modules.
  for (const edge of pin.importResolutionPins) {
    const expected = resolve(root, edge.expectedPath);
    if (!pin.files.some(file => file.path === edge.expectedPath)) throw Error('Unpinned import target');
    const actual = Bun.resolveSync(edge.specifier, dirname(resolve(root, edge.importer)));
    if (actual !== expected || await realpath(actual) !== expected) throw Error(`Import shadow: ${edge.importer} -> ${edge.specifier}`);
  }
  if (options.installed !== false) {
    // Validate the immutable package actually resolved by the canonical context reader.
    const contextSource = resolve(root, 'packages/work-continuity/src/context/source.ts');
    const installedEntry = Bun.resolveSync('@palantirkc/ontology', dirname(contextSource));
    const installedRoot = await realpath(resolve(dirname(installedEntry), '..'));
    await verifyFilePins(installedRoot, pin.installedOntologyFiles);
  }
  return { root, commit: pin.commit, mode: snapshot ? 'pinned-snapshot' : 'git-checkout', scope: pin.scope,
    fullNativeProviderClosureVerified: false, authority: 'none' as const, nativePermissionGranted: false as const };
}
export async function loadPlatform() {
  const source = await verifyPlatform();
  const ontology = await import(pathToFileURL(resolve(source.root, 'packages/ontology/src/validation.ts')).href);
  const continuity = await import(pathToFileURL(resolve(source.root, 'packages/work-continuity/src/context/validation.ts')).href);
  const contextSource = await import(pathToFileURL(resolve(source.root, 'packages/work-continuity/src/context/source.ts')).href);
  return { source, checkSources: contextSource.checkSources, localContextIo: contextSource.localContextIo, readExact: contextSource.readExact, validateArtifact: ontology.validateArtifact, validateReferences: ontology.validateReferences,
    validateCheckpoint: continuity.validateCheckpoint, validateWorkContextRequest: continuity.validateWorkContextRequest };
}
if (import.meta.main) console.log(JSON.stringify(await verifyPlatform({ installed: !process.argv.includes('--source-only') }), null, 2));
