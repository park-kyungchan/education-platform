/** Serialized focused source checks. No native socket, source service or subprocess MCP. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..'),owned='architecture/academy-query-integration/';
const output=owned+'observations/QRY-BOUNDARY-CHECKS-R1.json';
assert(!existsSync(resolve(root,output)),'immutable check output exists');
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const env={...process.env};delete env.DC_ACADEMY_TEST_SOCKET;
const records:any[]=[{id:'initial-boundary-compatibility-tests',command:['bun','test','./architecture/academy-query-integration/boundary-contracts.test.ts'],cwd:'.',exitCode:0,observedSummary:'4 pass / 0 fail /30 expectations; directly observed prior to this receipt, not rerun.'}];
const run=async(id:string,args:string[],cwd='.')=>{
  const startedAt=new Date().toISOString(),p=Bun.spawn(args,{cwd:resolve(root,cwd),env,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
  const record={id,args,cwd,startedAt,finishedAt:new Date().toISOString(),exitCode,stdoutSha256:sha(stdout),stderrSha256:sha(stderr),stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),stdoutTail:stdout.slice(-5000),stderrTail:stderr.slice(-13000)};
  records.push(record);console.log(JSON.stringify({id,exitCode,summary:(stdout+'\n'+stderr).slice(-700)}));return record;
};
await run('root-status',['bun','run','status']);
await run('root-actual-compiler',['bun','node_modules/typescript/bin/tsc','--version']);
await run('dc-actual-compiler',['bun','node_modules/typescript/bin/tsc','--version'],'apps/academy/dc-gang-a');
await run('exact-declarations-and-scoped-import-graph',['bun',owned+'boundary-inspect.ts']);
await run('owned-boundary-typecheck',['bun','node_modules/typescript/bin/tsc','--noEmit','-p',owned+'boundary-tsconfig.json']);
await run('dc-typecheck',['bun','run','typecheck'],'apps/academy/dc-gang-a');
await run('focused-maintained-read-protocol-tests',['bun','test',
  'tests/lms/academyReadProtocol.test.ts','tests/lms/academyReadIntegration.test.ts','tests/lms/academySourceAudit.test.ts',
  'tests/lms/itemAnswerBatch.test.ts','tests/lms/itemAnswerRead.test.ts','tests/lms/paperLineage.test.ts',
  'tests/lms/studentCourseRead.test.ts','tests/lms/lessonJournalTemplates.test.ts','tests/academy/teacherWorkspace.test.ts'], 'apps/academy/dc-gang-a');
await run('operational-contract-and-catalog-baseline-gap',['bun','test','tests/academy/operationalContract.test.ts','tests/lms/endpointCatalog.test.ts'],'apps/academy/dc-gang-a');
const pins=['package.json','bun.lock',...['dc-gang-a','gang-a','month-end-workbench'].flatMap(p=>['package.json','bun.lock'].map(f=>'apps/academy/'+p+'/'+f))];
const preservedPins=pins.map(path=>{const bytes=readFileSync(resolve(root,path)),p=Bun.spawnSync(['git','show','b9c954cb8f5bf9b0748bb5634b4951c5954e9a6b:'+path],{cwd:root});assert.equal(p.exitCode,0);assert.equal(sha(bytes),sha(p.stdout),'pin drift');return {path,sha256:sha(bytes),unchanged:true};});
const baseline=records.find(r=>r.id==='operational-contract-and-catalog-baseline-gap');
const expectedMissingRegistry=!existsSync(resolve(root,'apps/academy/dc-gang-a/research/backend-map/route-registry.json'));
const receipt={schema:'academy.qry-boundary-checks.v1',createdAt:new Date().toISOString(),sourceBase:'b9c954cb8f5bf9b0748bb5634b4951c5954e9a6b',nativeThreadId:process.env.CODEX_THREAD_ID??null,
  records,preservedPins,knownEnvironment:{missingRegistry:{path:'apps/academy/dc-gang-a/research/backend-map/route-registry.json',absent:expectedMissingRegistry,testExitCode:baseline.exitCode,baselineQualification:'Already documented by exact qualified DOM-01 query-boundary and QRY-01 result; no synthetic replacement installed.'},monthEndMcpDeclarations:'Known missing @modelcontextprotocol/client from QRY-01 receipt; no month-end source changed or typecheck repeated.'},
  notRun:['Whole241-source graph/suites','All-module bun run check aggregate (unchanged unrelated suites)','Database/socket/native authentication or Academy reads','Native MCP execution, browser/server launch, printing/sending, publication/activation'],
  effects:{gitMutation:0,privateOriginalReads:0,businessWrites:0,nativeActivation:0},
  focusedChecksPassed:records.filter(r=>r.id!=='operational-contract-and-catalog-baseline-gap').every(r=>r.exitCode===0),
  allExecutedChecksPassed:records.every(r=>r.exitCode===0)};
await Bun.write(resolve(root,output),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({output,focusedChecksPassed:receipt.focusedChecksPassed,allExecutedChecksPassed:receipt.allExecutedChecksPassed,knownAbsentRegistry:expectedMissingRegistry}));
if(!receipt.focusedChecksPassed)process.exitCode=1;
