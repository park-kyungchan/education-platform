import {expect,test} from 'bun:test';
import {privatePackageRoutes,runIntegratedAcademyContext} from '../src/academy-context';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';

const packageRoute=(packageId:string)=>({packageId,sourceCommit:'a'.repeat(40),proposedDestinationRoot:'context/private-students/'+packageId,fileCount:1,bytes:10,manifestSha256:'b'.repeat(64)});
const manifest={schema:'education.private-context-integration/v1' as const,targetRepository:'park-kyungchan/education-platform',visibilityRequired:'private',packages:[packageRoute('2099-01-05'),packageRoute('2099-01-05-part2')]};
test('current public direction is distinct from the preserved historical admission',async()=>{
 const read=(path:string)=>Bun.file(resolve(import.meta.dir,'..',path)).json();
 const [policy,project,architecture,historical]=await Promise.all([
  read('architecture/repository-visibility-policy.json'),read('project.json'),
  read('architecture/academy-integration.json'),read('provenance/private-context-integration.json')
 ]);
 expect(policy).toMatchObject({repository:'park-kyungchan/education-platform',currentDirection:'public',historicalAdmission:{historicalFileCount:566,preserveOriginalBytesAndFields:true},boundaries:{credentialsOrSecretsDisclosureAuthorized:false,separatelyHeldOriginalGitHistoriesPublicationAuthorized:false,academyRuntimeOrStudentSourceMutationAuthorized:false}});
 expect(project.payload.details.visibility).toBe('public');
 expect(architecture).toMatchObject({visibilityRequired:'public',visibilityPolicy:'architecture/repository-visibility-policy.json'});
 expect(historical).toMatchObject({visibilityRequired:'private',publicAssetUseAllowed:false});
});
test('date selection retains every same-day package without treating the addendum as a replacement',()=>{
 const routes=privatePackageRoutes(manifest,'2099-01-05');expect(routes.map(r=>r.packageId)).toEqual(['2099-01-05','2099-01-05-part2']);
 expect(()=>privatePackageRoutes(manifest,'2099-01-06')).toThrow('not_retained');
});
test('discovery refuses unqualified destinations and path escapes without opening source bodies',()=>{
 expect(()=>privatePackageRoutes({...manifest,visibilityRequired:'public'})).toThrow('private_owner');
 expect(()=>privatePackageRoutes(manifest,'../../private')).toThrow('invalid_business_date');
 expect(()=>privatePackageRoutes({...manifest,packages:[{...packageRoute('2099-01-05'),proposedDestinationRoot:'../../private'}]})).toThrow('invalid_package_route');
});
test('integrated entry is small and points to retained originals without loading real records',async()=>{
 const entry=await runIntegratedAcademyContext(['entry']);expect(entry).toMatchObject({sourceBodiesLoaded:false,nativePermissionGranted:false,repository:'park-kyungchan/education-platform'});
 expect(entry).toMatchObject({classTimetable:'modules/academy-workbench/context/class-timetable/README.ko.md'});
 expect(entry).toMatchObject({operationalContextIntakeContract:'apps/academy/dc-gang-a/docs/operational-context-intake-contract.md'});
 expect(existsSync(resolve(import.meta.dir,'../apps/academy/dc-gang-a/docs/operational-context-intake-contract.md'))).toBe(true);
 expect(Buffer.byteLength(JSON.stringify(entry))).toBeLessThan(8192);
 await expect(runIntegratedAcademyContext(['entry','--student','arbitrary'])).rejects.toThrow('usage');
});
test('integrated workflow routing reuses bounded selection and preserves exclusions',async()=>{
 const plan=await runIntegratedAcademyContext(['reading-plan','--topic','academy.class-preparation']);expect(plan).toMatchObject({sourceBodiesLoaded:false});
 await expect(runIntegratedAcademyContext(['select','--topic','academy.parent-communication'])).rejects.toThrow('topic-outside-scope');
});
test('selected source resolution uses the integrated file while preserving original source identity',async()=>{
 const route=await runIntegratedAcademyContext(['resolve','--source','SRC-INTEGRATION-USER-20261023']);
 expect(route).toMatchObject({status:'original-bytes-retained',originalRepository:'education-platform',integratedPath:'work/education-platform/academy-repository-integration-20261023/inputs/AI-USER.json',sourceBodiesEmitted:false,nativePermissionGranted:false});
 await expect(runIntegratedAcademyContext(['resolve','--source','../../foreign'])).rejects.toThrow('unknown_source');
});
test('an unmatched date preserves archival discovery and never becomes a claim of no student activity',async()=>{
 const entry=await runIntegratedAcademyContext(['entry','--date','2099-01-06']);
 expect(entry).toMatchObject({privatePackages:[],sourceBodiesLoaded:false});
 expect((entry as {dateCoverage:string}).dateCoverage).toContain('unknown coverage');
});
test('the actual CLI selection stdout fits its requested UTF8 budget and reports the exact emitted size',async()=>{
 for(const budget of [4096,8192]){
  const child=Bun.spawn([process.execPath,'--no-env-file',resolve(import.meta.dir,'../scripts/academy-context.ts'),'select','--topic','academy.class-preparation','--max-bytes',String(budget)],{stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).arrayBuffer(),new Response(child.stderr).text(),child.exited]);
  expect({code,stderr}).toEqual({code:0,stderr:''});
  const selection=JSON.parse(new TextDecoder().decode(stdout));
  expect(stdout.byteLength).toBeLessThanOrEqual(budget);
  expect(selection.usedBytes).toBe(stdout.byteLength);
 }
});
