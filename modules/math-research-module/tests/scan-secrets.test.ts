import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanSources } from '../scripts/scan-secrets.ts';

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function fixture(){const root=await mkdtemp(join(tmpdir(),'math-source-scan-'));roots.push(root);await mkdir(join(root,'src'));return root;}
test('private toolchain symlinks are excluded while active source still scans',async()=>{
 const root=await fixture();await mkdir(join(root,'.private/runtime'),{recursive:true});
 await symlink(join(root,'src'),join(root,'.private/runtime/lib'));
 await writeFile(join(root,'src/clean.ts'),'export const source = true;');
 expect(await scanSources(root)).toEqual({failures:[],count:1});
});
test('an admitted source credential still fails without echoing its value',async()=>{
 const root=await fixture(),secret=['gh','p_', 'x'.repeat(35)].join('');
 await writeFile(join(root,'src/credential.ts'),secret);
 const result=await scanSources(root);expect(result.failures).toEqual(['Credential-like content: src/credential.ts']);
 expect(JSON.stringify(result)).not.toContain(secret);
});
test('an active source symlink is refused without following private content',async()=>{
 const root=await fixture();await mkdir(join(root,'.private'));await writeFile(join(root,'.private/retained.txt'),'PRIVATE_FIXTURE');
 await symlink(join(root,'.private/retained.txt'),join(root,'src/link.ts'));
 expect(await scanSources(root)).toEqual({failures:['Unsupported source file type: src/link.ts'],count:0});
});
test('forced tracked private output cannot bypass the source admission scan',async()=>{
 const root=await fixture();await mkdir(join(root,'.private'));await writeFile(join(root,'.private/not-admitted.txt'),'PRIVATE_FIXTURE');
 execFileSync('git',['init','-q',root]);execFileSync('git',['-C',root,'add','--','.private/not-admitted.txt']);
 expect(await scanSources(root)).toEqual({failures:['Tracked operational output is not admitted: .private/not-admitted.txt'],count:0});
});
