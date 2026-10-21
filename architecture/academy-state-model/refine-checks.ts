/** Follow-up checks preserve R1, including its failed setup/import/typecheck attempts. */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..'),path=resolve(root,'work/education-platform/academy-state-model-20261021/checks/DOM-01-CHECKS-R2.json');
if(await Bun.file(path).exists())throw Error('immutable_check_receipt_exists');
const env={...process.env};delete env.DC_ACADEMY_TEST_SOCKET;
const rows:object[]=[];
const run=async(id:string,args:string[],cwd='.')=>{
 const p=Bun.spawn(args,{cwd:resolve(root,cwd),env,stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 rows.push({id,command:args,cwd,exitCode,stdout,stderr});console.log(JSON.stringify({id,exitCode,tail:(stdout+stderr).slice(-500)}));
};
await run('dom01-typecheck-repaired',['bun','node_modules/typescript/bin/tsc','--noEmit','-p','architecture/academy-state-model/tsconfig.json']);
await run('dom01-source-preservation-tests-final',['bun','test','./architecture/academy-state-model/selection.test.ts']);
await run('dc-maintained-query-state-tests',['bun','test','tests/academy/preparationHistory.test.ts','tests/academy/teacherWorkContext.test.ts','tests/academy/learningWork.test.ts','tests/academy/teacherWorkspace.test.ts','tests/academy/teacherClinicReviewBlockers.test.ts','tests/academy/teacherReadSnapshot.test.ts','tests/academy/preparationView.test.ts','tests/academy/teacherObservation.test.ts','tests/academy/operationalContract.test.ts','tests/academy/teacherClinic.test.ts'],'apps/academy/dc-gang-a');
await run('endpoint-catalog-gap-reproduction',['bun','test','tests/lms/endpointCatalog.test.ts','-t','preserves every canonical evidence field'],'apps/academy/dc-gang-a');
await run('month-end-application-http-launch-safety',['bun','test','tests/application.test.ts','tests/server.test.ts','tests/integrations/launch-safety.test.ts'],'apps/academy/month-end-workbench');
await run('month-end-pinned-projection',['bun','scripts/verify-projection.ts'],'apps/academy/month-end-workbench');
const baseline=await Bun.file(resolve(root,'work/education-platform/academy-state-model-20261021/checks/DOM-01-CHECKS-R1.json')).text();
await Bun.write(path,JSON.stringify({schema:'academy.dom01-checks.v2',createdAt:new Date().toISOString(),priorReceipt:{path:'work/education-platform/academy-state-model-20261021/checks/DOM-01-CHECKS-R1.json',sha256:createHash('sha256').update(baseline).digest('hex')},changesSinceR1:['Corrected owned test literal-array type and removed unsupported Bun BuildConfig write property; no-outdir Bun.build is memory-only.','DOM-01 compiler config now uses the same strict indexed-access behavior as the maintained DC/module configs; no product compiler config changed.'],rows,gaps:['Initial root aggregate check missing ontology before allowed frozen setup; root integration afterward still lacks examples/clinic-workbench zod dependency.','All13 endpointCatalog test failures share absent maintained research/backend-map/route-registry.json; isolated reproduction retained.','Month-end full check:49pass/1fail because external academy-workbench/tools/academy-mcp/src/item-labels.ts is absent. No foreign source or fallback implementation was substituted.','PostgreSQL-dependent39tests are skipped without a socket. Native registration/adoption, teacher acceptance, printing and distribution remain unverified.'],runtimeEffects:0},null,2)+'\n');
