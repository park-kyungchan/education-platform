/** Ignored physical import shadows in exclusive synthetic roots, never installed owners. */
import { afterEach, expect, test } from 'bun:test';
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { verifyCanonicalProjection, verifyOwnerReviewProjection } from '../scripts/canonical-projection.ts';
const moduleRoot=resolve(import.meta.dir,'..'),roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function fixture() {
 const proof=await verifyOwnerReviewProjection(),root=await mkdtemp(resolve(tmpdir(),'math-importer-closure-'));roots.push(root);
 const paths=new Set(['.gitignore','project.json','bun.lock','harness/agent-platform.lock.json','harness/common-ci-provider.json','ci/generated/canonical-api.manifest.json','ci/generated/native-review.manifest.json',proof.core.manifest.generated.path,proof.core.manifest.fixture.path,proof.manifest.generated.path,...proof.core.manifest.generationInputs.map((p:any)=>p.path),...proof.manifest.generationInputs.map((p:any)=>p.path)]);
 for(const path of paths as Set<string>){const target=resolve(root,path);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(moduleRoot,path),target);}
 for(const [name,directory]of proof.core.externalRoots){const target=resolve(root,'node_modules',name);await mkdir(dirname(target),{recursive:true});await cp(directory,target,{recursive:true,dereference:false});}
 execFileSync('git',['init','-q',root]);return root;
}
async function child(root:string,source:string) {
 const process=Bun.spawn([globalThis.process.execPath,'--no-env-file','-e',source],{cwd:root,stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(process.stdout).text(),new Response(process.stderr).text(),process.exited]);
 expect(code).toBe(0);expect(stderr).toBe('');expect(stdout).toContain('SHADOW_REFUSED');
 await expect(access(resolve(root,'SHADOW_EXECUTED'))).rejects.toThrow();
}
for(const location of ['ci/generated','ci'])test(`ignored ${location}/node_modules cannot replace either generated bundle dependency`,async()=>{
 const root=await fixture(),directory=resolve(root,location,'node_modules/ajv/dist');await mkdir(directory,{recursive:true});
 await writeFile(resolve(directory,'2020.js'),`require('node:fs').writeFileSync(${JSON.stringify(resolve(root,'SHADOW_EXECUTED'))},'unexpected');module.exports=class {addFormat(){return this}compile(){return Object.assign(()=>true,{errors:null})}};`);
 await writeFile(resolve(directory,'../package.json'),JSON.stringify({name:'ajv',version:'8.20.0',main:'dist/2020.js'}));
 execFileSync('git',['-C',root,'check-ignore','-q',resolve(directory,'2020.js')]);
 for(const verify of [verifyCanonicalProjection,verifyOwnerReviewProjection])await expect(verify(root)).rejects.toThrow('physical lookup shadow');
 await child(root,`const helpers=await import('./scripts/canonical-projection.ts');for(const loader of ['loadCanonicalProjection','loadOwnerReviewProjection']){try{await helpers[loader]();process.exit(91);}catch(error){if(!String(error).includes('physical lookup shadow'))throw error;}}console.log('SHADOW_REFUSED');`);
});
test('dangling ignored dependency lookup is refused even when resolution falls through',async()=>{
 const root=await fixture(),directory=resolve(root,'ci/generated/node_modules');await mkdir(directory,{recursive:true});await symlink(resolve(root,'absent-package'),resolve(directory,'ajv'));
 await expect(verifyCanonicalProjection(root)).rejects.toThrow('physical lookup shadow');await expect(verifyOwnerReviewProjection(root)).rejects.toThrow('physical lookup shadow');
});
test('already admitted bundles refuse a later physical shadow without resolver or module cache clearing',async()=>{
 const root=await fixture();
 await child(root,`const helpers=await import('./scripts/canonical-projection.ts');await helpers.loadCanonicalProjection();await helpers.loadOwnerReviewProjection();const fs=await import('node:fs/promises');await fs.mkdir('./ci/generated/node_modules/fast-uri',{recursive:true});await fs.writeFile('./ci/generated/node_modules/fast-uri/package.json','{}');for(const loader of ['loadCanonicalProjection','loadOwnerReviewProjection']){try{await helpers[loader]();process.exit(91);}catch(error){if(!String(error).includes('physical lookup shadow'))throw error;}}console.log('SHADOW_REFUSED');`);
});
for(const bundle of ['canonical-api','native-review'])test(`${bundle} post-import check refuses an ignored lookup inserted after its initial check`,async()=>{
 const root=await fixture(),loader=bundle==='canonical-api'?'loadCanonicalProjection':'loadOwnerReviewProjection';
 // The process-local test plugin inserts a lookup during module load; it returns
 // the exact original source bytes and never changes an installed source file.
 const source=`const fs=await import('node:fs/promises');Bun.plugin({name:'finite-import-window-probe',setup(build){build.onLoad({filter:/\\/ci\\/generated\\/${bundle}\\.js$/},async(args)=>{await fs.mkdir('./ci/generated/node_modules/fast-uri',{recursive:true});await fs.writeFile('./ci/generated/node_modules/fast-uri/package.json','{}');return {contents:await fs.readFile(args.path,'utf8'),loader:'js'};});}});const helpers=await import('./scripts/canonical-projection.ts');try{await helpers.${loader}();process.exit(91);}catch(error){if(!String(error).includes('physical lookup shadow'))throw error;}console.log('SHADOW_REFUSED');`;
 await child(root,source);
});
