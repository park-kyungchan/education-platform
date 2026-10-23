import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export async function verifySource(root = fileURLToPath(new URL('../', import.meta.url))) {
const pinLock = JSON.parse(await readFile(join(root,'harness/research-source.lock.json'),'utf8'));
for (const pin of pinLock.files) {
  const actual = createHash('sha256').update(await readFile(join(root,pin.path))).digest('hex');
  if(actual !== pin.sha256) throw Error(`Admitted source pin drift: ${pin.path}`);
}
const archive = join(root, 'source/archive');
const manifest = JSON.parse(await readFile(join(archive, 'FILES.sha256.json'), 'utf8')) as Record<string,string>;
const failures: string[] = [];
for (const [path, expected] of Object.entries(manifest)) {
  const actual = createHash('sha256').update(await readFile(join(archive, path))).digest('hex');
  if (actual !== expected) failures.push(`Source drift: ${path}`);
}
async function files(dir: string): Promise<string[]> { const out: string[] = []; for (const e of await readdir(dir, { withFileTypes: true })) out.push(...(e.isDirectory() ? await files(join(dir,e.name)) : [join(dir,e.name)])); return out; }
const actual = (await files(archive)).map(p => relative(archive, p)).sort();
const expected = [...Object.keys(manifest), 'FILES.sha256.json'].sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push('Archive file list drift');
const cap = join(root, 'source/capability-research/초3_105유형_근본능력_문헌근거보고서.md');
if (createHash('sha256').update(await readFile(cap)).digest('hex') !== 'b301ed6ffeecf137caef46f91d899927211fbbb6738a34788319cf415e2494d4') failures.push('Capability report drift');
if (failures.length) throw new Error(failures.join('\n'));
return {archiveFiles:actual.length,manifestEntries:Object.keys(manifest).length,admittedFiles:pinLock.files.length};
}
if(import.meta.main)console.log('PASS source integrity:',JSON.stringify(await verifySource()));
