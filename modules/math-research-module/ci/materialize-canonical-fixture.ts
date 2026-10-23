/** Exclusive generated test dependency only; never a clone or native provider. */
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { verifyCanonicalProjection } from '../scripts/canonical-projection.ts';
export async function materializeCanonicalTestFixture() {
 const proof=await verifyCanonicalProjection();
 const root=await mkdtemp(resolve(tmpdir(),'math-canonical-test-inputs-'));
 try {
  for(const input of proof.fixture.inputs) {
   const path=resolve(root,input.kind==='source'?input.path:'node_modules/@palantirkc/ontology/'+input.path);
   if(!path.startsWith(root+'/'))throw Error('Generated test fixture path escaped');
   await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,Buffer.from(input.base64,'base64'),{flag:'wx',mode:0o400});
  }
  for(const [name,directory]of proof.externalRoots)await symlink(directory,resolve(root,'node_modules',name));
  return {root,qualification:'generated-test-inputs-not-clone-or-native-provider',cleanup:()=>rm(root,{recursive:true,force:true})};
 } catch(error) {await rm(root,{recursive:true,force:true});throw error;}
}
