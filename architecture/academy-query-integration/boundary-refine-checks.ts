/** Follow up only the changed focused test/config; preserve every earlier failure. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..'),owned='architecture/academy-query-integration/';
const output=owned+'observations/QRY-BOUNDARY-CHECKS-R2.json';
assert(!existsSync(resolve(root,output)),'immutable output exists');
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const first=JSON.parse(readFileSync(resolve(root,owned+'observations/QRY-BOUNDARY-CHECKS-R1.json'),'utf8'));
const records=[];
for(const [id,args] of [
  ['boundary-typecheck-matching-dc-options',['bun','node_modules/typescript/bin/tsc','--noEmit','-p',owned+'boundary-tsconfig.json']],
  ['updated-compatibility-and-explicit-catalog-consumer',['bun','test','./'+owned+'boundary-contracts.test.ts']],
] as const){
  const startedAt=new Date().toISOString(),p=Bun.spawn([...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
  records.push({id,args,startedAt,exitCode,stdout,stderr,stdoutSha256:sha(stdout),stderrSha256:sha(stderr)});
  console.log(JSON.stringify({id,exitCode,summary:(stdout+stderr).slice(-700)}));
}
const baselineFiles=['src/lms/lmsRouteRegistry.ts','src/lms/backendSourceEvidence.ts','tests/lms/academyReadProtocol.test.ts','tests/lms/endpointCatalog.test.ts','tests/academy/operationalContract.test.ts'];
const baselineFilePins=baselineFiles.map(part=>{
  const path='apps/academy/dc-gang-a/'+part,current=readFileSync(resolve(root,path));
  const base=Bun.spawnSync(['git','show','b9c954cb8f5bf9b0748bb5634b4951c5954e9a6b:'+path],{cwd:root});
  assert.equal(base.exitCode,0);assert.equal(sha(current),sha(base.stdout));return {path,sha256:sha(current),unchangedFromAdmittedBase:true};
});
const absent=['research/backend-map/route-registry.json','docs/academy-dom-source-evidence.json'].map(part=>{
  const path='apps/academy/dc-gang-a/'+part;assert(!existsSync(resolve(root,path)));
  const p=Bun.spawnSync(['git','cat-file','-e','b9c954cb8f5bf9b0748bb5634b4951c5954e9a6b:'+path],{cwd:root});
  assert.notEqual(p.exitCode,0);return {path,absentLocally:true,absentInAdmittedGitTree:true};
});
const unchangedProductSource=JSON.parse(readFileSync(resolve(root,owned+'observations/QRY-BOUNDARY-SOURCE-GRAPH-R1.json'),'utf8')).selectedFiles.map((row:{path:string;sha256:string})=>{assert.equal(sha(readFileSync(resolve(root,row.path))),row.sha256);return row;});
const receipt={schema:'academy.qry-boundary-checks-refinement.v1',createdAt:new Date().toISOString(),sourceBase:'b9c954cb8f5bf9b0748bb5634b4951c5954e9a6b',nativeThreadId:process.env.CODEX_THREAD_ID??null,
  supersedesNoRecord:true,priorReceipt:{path:owned+'observations/QRY-BOUNDARY-CHECKS-R1.json',sha256:sha(readFileSync(resolve(root,owned+'observations/QRY-BOUNDARY-CHECKS-R1.json')))},
  correction:'New boundary typecheck extends existing DC compiler options rather than imposing root noUncheckedIndexedAccess on unchanged DC source. Native config, DC/root tsconfig, packages and locks unchanged. Initial stricter diagnostics retained.',
  records,retainedPriorPasses:first.records.filter((r:{exitCode:number})=>r.exitCode===0),
  priorTestResults:{maintainedReadProtocolsAndWorkspace:{pass:56,skip:7,fail:1,onlyFailure:'whole-catalog coverage exposes scoped preparation without promoting unknown operations',cause:'Absent canonical route-registry.json'},operationalContractAndCatalog:{pass:25,fail:13,causes:'11 absent canonical registry /2 absent docs/academy-dom-source-evidence.json'}},
  baselineFilePins,absent,unchangedProductSource,
  verificationDisposition:'Exact source/export/import-boundary compatibility and DC typecheck qualify the delivered extraction. Full canonical catalog data-driven behavior remains unverified because baseline source inputs are absent; no overall all-tests-pass claim.',
  boundedNeedForFullCatalogVerification:'Source owner must separately supply authorized code/spec registry and DOM evidence JSON at the two exact missing paths; no live/private retrieval or synthesized replacement authorized/performed.',
  monthEndSdkDeclarationGap:'Retained QRY-01 limitation; no month-end implementation changed or native launch admitted.',
  passed:records.every(r=>r.exitCode===0),allExecutedTestsPassed:false,gitMutations:0,nativeActivation:false,teacherAcceptance:false};
await Bun.write(resolve(root,output),JSON.stringify(receipt,null,2)+'\n');
if(!receipt.passed)process.exitCode=1;
