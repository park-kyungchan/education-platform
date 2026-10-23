import { afterEach, expect, test } from 'bun:test';
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { verifyCanonicalProjection, verifyOwnerReviewProjection } from '../scripts/canonical-projection.ts';
const moduleRoot=resolve(import.meta.dir,'..'),roots:string[]=[];
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function fixture() {
 const proof=await verifyCanonicalProjection(),root=await mkdtemp(resolve(tmpdir(),'math-projection-proof-'));roots.push(root);
 const paths=['harness/agent-platform.lock.json','bun.lock','ci/generated/canonical-api.manifest.json',proof.manifest.generated.path,proof.manifest.fixture.path,...proof.manifest.generationInputs.map((p:any)=>p.path),'project.json','harness/common-ci-provider.json','ci/generated/native-review.manifest.json','ci/generated/native-review.js','ci/native-review.entry.ts','ci/native-review.ts'];
 for(const path of paths){const target=resolve(root,path);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(moduleRoot,path),target);}
 for(const [name,directory]of proof.externalRoots){const target=resolve(root,'node_modules',name);await mkdir(dirname(target),{recursive:true});await cp(directory,target,{recursive:true,dereference:false});}
 return root;
}
test('exact finite bundle fixture proves canonical inputs without claiming a clone',async()=>{
 const root=await fixture(),proof=await verifyCanonicalProjection(root);
 expect(proof.fixture.inputs).toHaveLength(55);expect(proof.source.mode).toBe('compiled-canonical-ci-projection');expect(proof.source.fullNativeProviderClosureVerified).toBe(false);
});
test('generated executable drift is refused before code import',async()=>{
 const root=await fixture(),path=resolve(root,'ci/generated/canonical-api.js');
 await writeFile(path,(await readFile(path,'utf8'))+'\nthrow Error("UNREVIEWED_CODE_EXECUTED");\n');
 await expect(verifyCanonicalProjection(root)).rejects.toThrow('Generated canonical projection drift');
});
test('nested external dependency shadow cannot silently replace the frozen dependency',async()=>{
 const root=await fixture(),path=resolve(root,'node_modules/ajv/node_modules/fast-uri/package.json');await mkdir(dirname(path),{recursive:true});
 await writeFile(path,JSON.stringify({name:'fast-uri',version:'unreviewed'}));
 await expect(verifyCanonicalProjection(root)).rejects.toThrow('External dependency file set drift');
});
test('repinned generated fixture cannot substitute a source path before materialization',async()=>{
 const root=await fixture(),path=resolve(root,'ci/generated/canonical-test-inputs.json'),manifestPath=resolve(root,'ci/generated/canonical-api.manifest.json');
 const input=JSON.parse(await readFile(path,'utf8'));input.inputs[0].path='../escape';const bytes=JSON.stringify(input);await writeFile(path,bytes);
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));manifest.fixture.sha256=hash(bytes);await writeFile(manifestPath,JSON.stringify(manifest));
 await expect(verifyCanonicalProjection(root)).rejects.toThrow('Canonical test fixture source drift');
});
test('external lock drift is refused even when installed package bytes remain unchanged',async()=>{
 const root=await fixture(),path=resolve(root,'bun.lock');const lock=Bun.JSONC.parse(await readFile(path,'utf8')) as any;
 lock.packages['fast-uri'][0]='fast-uri@unreviewed';await writeFile(path,JSON.stringify(lock));
 await expect(verifyCanonicalProjection(root)).rejects.toThrow('External dependency lock drift');
});

test('generated owner review executable drift is refused before import',async()=>{
 const root=await fixture(),path=resolve(root,'ci/generated/native-review.js');
 await writeFile(path,(await readFile(path,'utf8'))+'\nthrow Error("UNREVIEWED_REVIEW_EXECUTED");\n');
 await expect(verifyOwnerReviewProjection(root)).rejects.toThrow('Generated owner review bytes drift');
});
test('Math review policy substitution is refused before import',async()=>{
 const root=await fixture(),path=resolve(root,'harness/common-ci-provider.json'),provider=JSON.parse(await readFile(path,'utf8'));
 provider.policy.publisher.login='foreign-publisher';await writeFile(path,JSON.stringify(provider));
 await expect(verifyOwnerReviewProjection(root)).rejects.toThrow('Owner review projection policy drift');
});
