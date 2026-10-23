import { mkdir, readFile, lstat, symlink, realpath, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { moduleRoot, readPin, sha256, verifyFilePins, verifyPlatform, type PlatformPin } from '../scripts/agent-platform.ts';
import { verifyProjection } from './verify-projection.ts';

export function decodeDependencyArchive(archive: Uint8Array, pin: PlatformPin) {
  if (archive.length > 1048576) throw Error('Dependency archive exceeds bound.');
  const bytes = gunzipSync(archive, { maxOutputLength: 2097152 });
  const bundle = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (bundle.schema !== 'academy.generated-dependency-source.v1' || bundle.owner !== 'park-kyungchan/agent-platform' || bundle.commit !== pin.commit || bundle.generatedDependencyCopy !== true || bundle.independentlyMaintainedImplementation !== false || !Array.isArray(bundle.files) || bundle.files.length !== 17) throw Error('Invalid dependency cache identity/count.');
  const members = new Map<string, Buffer>();
  for (let i = 0; i < pin.files.length; i++) {
    const row = bundle.files[i], expected = pin.files[i]!;
    if (!row || Object.keys(row).sort().join(',') !== 'bytesBase64,path' || row.path !== expected.path || members.has(row.path) || !/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(row.path) || row.path.split('/').some((part: string) => part === '.' || part === '..') || typeof row.bytesBase64 !== 'string' || row.bytesBase64.length > 1048576 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(row.bytesBase64)) throw Error('Unsafe or unexpected dependency member.');
    const content = Buffer.from(row.bytesBase64, 'base64');
    if (content.length > 786432 || sha256(content) !== expected.sha256) throw Error('Dependency cache hash mismatch before extraction.');
    members.set(row.path, content);
  }
  return members;
}

export async function restoreDependency() {
  await verifyProjection();
  const pin = await readPin(), root = resolve(moduleRoot, '.harness-deps/agent-platform');
  const members = decodeDependencyArchive(await readFile(resolve(moduleRoot, 'ci/generated/agent-platform-ffba-source.json.gz')), pin);
  // A preexisting root is inspected, never overwritten or repaired by extraction.
  let exists = true;
  try { if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) throw Error('Dependency root must be an exact regular directory.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') exists = false; else throw error; }
  if (!exists) {
    await mkdir(dirname(root), { recursive: true });
    if (await realpath(dirname(root)) !== dirname(root)) throw Error('Dependency parent must be exact; symlink ancestors are not extraction targets.');
    await mkdir(root); // Exclusive creation; concurrent custody is an error.
    for (const [path, content] of members) {
      const target = resolve(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, { flag: 'wx' });
    }
  }
  await verifyFilePins(root, pin.files);
  await verifyPlatform({ root, snapshot: true, installed: false });
  return { root, status: 'pass', sourceFileCount: 17, mode: 'pinned-snapshot', generatedDependencyCopy: true, independentlyMaintainedImplementation: false, nativePermissionGranted: false };
}

if (import.meta.main) {
  const source = await restoreDependency();
  const installRoot = resolve(moduleRoot, 'ci/dependency-install');
  if (await realpath(installRoot) !== installRoot) throw Error('Frozen install root must be canonical.');
  try { const target = resolve(installRoot, 'node_modules'); if (!(await lstat(target)).isDirectory() || await realpath(target) !== target) throw Error('Frozen install cannot replace a foreign dependency link.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const install = Bun.spawn([process.execPath, 'install', '--frozen-lockfile', '--ignore-scripts'], { cwd: resolve(moduleRoot, 'ci/dependency-install'), stdout: 'inherit', stderr: 'inherit' });
  if (await install.exited !== 0) throw Error('Frozen public dependency install failed; canonical source remains unchanged.');
  const link = resolve(source.root, 'node_modules'), target = resolve(moduleRoot, 'ci/dependency-install/node_modules');
  try { await lstat(link); if (await realpath(link) !== await realpath(target)) throw Error('Existing dependency resolution is retained; select a fresh reviewed checkout.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') await symlink(target, link, 'dir'); else throw error; }
  // Resolver caches populated before install are not evidence of the fresh import graph.
  const verify = Bun.spawn([process.execPath, resolve(moduleRoot, 'scripts/agent-platform.ts')], {
    cwd: moduleRoot, env: { ...process.env, AGENT_PLATFORM_ROOT: source.root, AGENT_PLATFORM_SOURCE_MODE: 'pinned-snapshot' }, stdout: 'inherit', stderr: 'inherit' });
  if (await verify.exited !== 0) throw Error('Fresh installed canonical dependency readback failed.');
}
