/** DOM-02 source checks only. Serial execution; no Git writes, installation, native source or DB socket. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..'),work='work/education-platform/academy-state-model-20261021';
const output=process.argv[2]??'architecture/academy-state-model/observations/DOM-02-CHECKS-R1.json';
if(!/^architecture\/academy-state-model\/observations\/DOM-02-CHECKS-R[1-9][0-9]*\.json$/.test(output))throw Error('owned_observation_path_required');
if(await Bun.file(resolve(root,output)).exists())throw Error('immutable_observation_exists');
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const git=(args:string[])=>{const result=Bun.spawnSync(['git',...args],{cwd:root});if(result.exitCode)throw Error('read_only_git_failed');return result.stdout.toString().trim();};
const initialHead='fabce64cb5338101328900644462b98fa8209be9',implementationBase='3adb273aa1125aa8d6beff7dc51a4c5076710d9f';
if(git(['rev-parse','HEAD'])!==initialHead)throw Error('operator_source_head_changed');
const env={...process.env};delete env.DC_ACADEMY_TEST_SOCKET;
const checks:object[]=[{id:'initial-dom02-dc-typecheck',exitCode:1,meaning:'Retained first implementation check failure. Fixed owned TypeScript narrowing/implicit parameter annotations; no runtime policy or compiler flag bypass.',findings:['postgresStore.ts: implicit any for old assignment predicate','teacherWorkspace.ts: mutable AcademyRecord property lost narrowing inside item callback; implicit item parameter']}];
async function run(id:string,args:string[],cwd='.'){
 const startedAt=new Date().toISOString(),p=Bun.spawn(args,{cwd:resolve(root,cwd),env,stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 const metrics={pass:Number(stderr.match(/(\d+) pass\b/)?.[1]??0),fail:Number(stderr.match(/(\d+) fail\b/)?.[1]??0),skip:Number(stderr.match(/(\d+) skip\b/)?.[1]??0),expectations:Number(stderr.match(/(\d+) expect\(\) calls/)?.[1]??0)};
 checks.push({id,args,cwd,startedAt,finishedAt:new Date().toISOString(),exitCode,metrics,stdoutSha256:hash(stdout),stderrSha256:hash(stderr),stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),stdoutTail:stdout.slice(-5000),stderrTail:stderr.slice(-20000)});
 console.log(JSON.stringify({id,exitCode,metrics,tail:(stdout+stderr).slice(-500)}));
}
await run('root-source-status',['bun','run','status']);
await run('compiler-version',['bun','node_modules/typescript/bin/tsc','--version']);
await run('dc-compiler-version',['bun','node_modules/typescript/bin/tsc','--version'],'apps/academy/dc-gang-a');
await run('root-typecheck',['bun','run','typecheck']);
await run('dc-typecheck',['bun','run','typecheck'],'apps/academy/dc-gang-a');
await run('dom02-test-typecheck',['bun','node_modules/typescript/bin/tsc','--noEmit','-p','architecture/academy-state-model/tsconfig.dom02.json']);
await run('dom02-adversarial-tests',['bun','test','tests/academy/learningWorkRefinements.test.ts'],'apps/academy/dc-gang-a');
const maintained=['learningWork','teacherWorkspace','teacherWorkspaceEditor','teacherClinic','teacherClinicUi','teacherClinicReviewBlockers','teacherWorkContext','teacherReadSnapshot','preparationHistory','preparationView','learningWorkView','application','sourceEvidence'];
await run('maintained-affected-consumers',['bun','test',...maintained.map(name=>'tests/academy/'+name+'.test.ts')],'apps/academy/dc-gang-a');
await run('root-import-provenance',['bun','run','verify:imports']);
await run('whitespace-diff',['git','diff','--check']);
const browser=await Bun.build({entrypoints:[resolve(root,'apps/academy/dc-gang-a/src/academy/web/client.ts')],target:'browser',format:'iife'});
checks.push({id:'teacher-web-memory-build',success:browser.success,artifacts:browser.outputs.length,bytes:browser.outputs.reduce((n,row)=>n+row.size,0),logs:browser.logs.map(log=>log.message),outputFilesWritten:false});
console.log(JSON.stringify({id:'teacher-web-memory-build',success:browser.success}));
const pins=['package.json','bun.lock','releases/palantirkc-ontology-0.2.0.tgz','architecture/source-map.json','apps/academy/run.ts','provenance/imported-files.json','provenance/adaptations.json','apps/academy/dc-gang-a/package.json','apps/academy/dc-gang-a/bun.lock','apps/academy/gang-a/package.json','apps/academy/gang-a/bun.lock'];
const preservedPins=pins.map(path=>{const bytes=readFileSync(resolve(root,path)),prior=Bun.spawnSync(['git','show',initialHead+':'+path],{cwd:root});if(prior.exitCode||hash(bytes)!==hash(prior.stdout))throw Error('reserved_pin_changed:'+path);return {path,sha256:hash(bytes)};});
const adoption=await Bun.file(resolve(root,work+'/inputs/DOM-QRY-BOUNDARY-ADOPTION-R1.json')).json();
const neutralLeaves=adoption.content.files.filter((row:{path:string})=>row.path.startsWith('apps/academy/dc-gang-a/src/contracts/')).map((row:{path:string;afterSha256:string})=>{const actual=hash(readFileSync(resolve(root,row.path)));if(actual!==row.afterSha256)throw Error('qualified_neutral_leaf_changed:'+row.path);return {path:row.path,sha256:actual,qualifiedProducerBytesPreserved:true};});
const preservedInputs=[];for await(const path of new Bun.Glob(work+'/inputs/*.json').scan(root)){const actual=hash(readFileSync(resolve(root,path))),prior=Bun.spawnSync(['git','show',initialHead+':'+path],{cwd:root});if(prior.exitCode||actual!==hash(prior.stdout))throw Error('existing_input_changed:'+path);preservedInputs.push({path,sha256:actual});}
const imported=await Bun.file(resolve(root,'provenance/imported-files.json')).json(),adaptations=await Bun.file(resolve(root,'provenance/adaptations.json')).json(),importGaps=[];
for(const file of imported.files){const path=file.module+'/'+file.path,adaptation=adaptations.files.find((row:{path:string})=>row.path===path),expected=adaptation?.integrationSha256??file.sha256,current=hash(readFileSync(resolve(root,path)));if(current===expected)continue;const previous=Bun.spawnSync(['git','show',initialHead+':'+path],{cwd:root}),previousHash=previous.exitCode?null:hash(previous.stdout);importGaps.push({path,expectedSha256:expected,startingHeadSha256:previousHash,preparedSha256:current,classification:previousHash===current?'preexisting_starting_head_gap':'DOM02_source_change_requires_root_owned_provenance_reconciliation'});}
await Bun.write(resolve(root,output),JSON.stringify({schema:'academy.dom02-source-checks.v1',createdAt:new Date().toISOString(),sourceHead:initialHead,implementationBase,actualCodexThreadId:process.env.CODEX_THREAD_ID,checks,preservedPins,neutralLeaves,preservedInputs,importGaps,knownLimits:['No isolated synthetic PostgreSQL socket supplied; DB/CAS/transaction tests remain explicit skips. Pure guard and real application/snapshot composition are tested.','DOM-01 inventory/Inputs are historical at their exact source; its precommit inspector was not rerun.','Baseline missing external MCP source and route-registry checks are preserved in DOM-01 observations; no foreign source, lock or manifest is substituted.','No full aggregate module check or native/browser activation. Source-memory browser build does not establish native WebMCP or teacher acceptance.','Root owns source checkpoint commit, canonical exact snapshot/semantic transition and any shared provenance reconciliation.'],effects:{gitStageOrCommit:0,install:0,dbSocketAdmitted:false,nativeSourceReads:0,privateOriginals:0,printing:0,sending:0,nativeActivation:0}},null,2)+'\n');
