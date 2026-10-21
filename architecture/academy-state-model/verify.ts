/** Bounded source/synthetic verification, serialized. No DB/socket, server, printing, or browser launch. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..');
const output='architecture/academy-state-model/observations/DOM-01-CHECKS-R1.json';
if(await Bun.file(resolve(root,output)).exists())throw Error('immutable_check_receipt_exists');
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const records:object[]=[
 {id:'initial-root-status',command:['bun','run','status'],exitCode:0,summary:'Source metadata read; no runtime or production acceptance.'},
 {id:'initial-root-check',command:['bun','run','check'],exitCode:1,summary:"Before dependency setup: Cannot find module '@palantirkc/ontology'; aggregate stopped before checks. Original failure retained."},
 {id:'initial-nine-file-tests',cwd:'apps/academy/dc-gang-a',exitCode:1,summary:'Before module dependency setup: 29 pass, 6 fail/6 import errors, 71 expectations; missing zod/jsdom. No PostgreSQL socket admitted.'},
 {id:'initial-gang-frozen-setup',cwd:'apps/academy/gang-a',command:['bun','install','--frozen-lockfile','--ignore-scripts'],exitCode:1,summary:'Sandbox EROFS on temporary directory; exact retry with approved escalation passed. Root/DC/month-end frozen ignore-scripts installs subsequently passed.'},
];
const env={...process.env};delete env.DC_ACADEMY_TEST_SOCKET;
const run=async(id:string,args:string[],cwd='.')=>{
 const startedAt=new Date().toISOString();
 const p=Bun.spawn(args,{cwd:resolve(root,cwd),env,stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 const row={id,command:args,cwd,startedAt,finishedAt:new Date().toISOString(),exitCode,stdoutSha256:sha(stdout),stderrSha256:sha(stderr),stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),stdoutTail:stdout.slice(-3000),stderrTail:stderr.slice(-6000)};
 records.push(row);console.log(JSON.stringify({id,exitCode,stdoutTail:stdout.slice(-300),stderrTail:stderr.slice(-350)}));
};
const pins=['package.json','bun.lock','releases/palantirkc-ontology-0.2.0.tgz',...['dc-gang-a','gang-a','month-end-workbench'].flatMap(p=>['package.json','bun.lock'].map(n=>'apps/academy/'+p+'/'+n))];
const preservedPins=pins.map(path=>{
 const bytes=readFileSync(resolve(root,path)),base=Bun.spawnSync(['git','show','4bdef2c77cb9a537cecf806ba16054646147dbc5:'+path],{cwd:root});
 if(base.exitCode||sha(base.stdout)!==sha(bytes))throw Error('dependency_pin_changed:'+path);
 return {path,sha256:sha(bytes),unchangedFromInitialSource:true};
});
await run('bun-version',['bun','--version']);
await run('root-compiler-version',['bun','node_modules/typescript/bin/tsc','--version']);
await run('dc-compiler-version',['bun','node_modules/typescript/bin/tsc','--version'],'apps/academy/dc-gang-a');
await run('root-typecheck',['bun','run','typecheck']);
await run('root-integration-tests',['bun','test','./tests']);
await run('root-import-verification',['bun','run','verify:imports']);
await run('dom01-typecheck',['bun','node_modules/typescript/bin/tsc','--noEmit','-p','architecture/academy-state-model/tsconfig.json']);
await run('dom01-selection-and-preservation-tests',['bun','test','./architecture/academy-state-model/selection.test.ts']);
await run('exact-source-metadata-verification',['bun','architecture/academy-state-model/inspect-source.ts']);
await run('dc-bounded-maintained-tests',['bun','test','tests/academy/preparationHistory.test.ts','tests/academy/teacherWorkContext.test.ts','tests/academy/learningWork.test.ts','tests/academy/teacherWorkspace.test.ts','tests/academy/teacherClinicReviewBlockers.test.ts','tests/academy/teacherReadSnapshot.test.ts','tests/academy/preparationView.test.ts','tests/academy/teacherObservation.test.ts','tests/academy/operationalContract.test.ts','tests/academy/teacherClinic.test.ts','tests/lms/endpointCatalog.test.ts'],'apps/academy/dc-gang-a');
await run('dc-typecheck',['bun','run','typecheck'],'apps/academy/dc-gang-a');
await run('month-end-workbench-check',['bun','run','check'],'apps/academy/month-end-workbench');
await run('month-end-web-typecheck',['bun','../../../node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.json'],'apps/academy/month-end-web');
await run('month-end-web-tests',['bun','run','test'],'apps/academy/month-end-web');
const browserBuild=await Bun.build({entrypoints:[resolve(root,'apps/academy/month-end-web/src/app.ts')],target:'browser',format:'iife'});
records.push({id:'month-end-web-memory-build',success:browserBuild.success,artifactCount:browserBuild.outputs.length,bytes:browserBuild.outputs.reduce((n,a)=>n+a.size,0),logs:browserBuild.logs.map(log=>log.message),outputFilesWritten:false});
console.log(JSON.stringify({id:'month-end-web-memory-build',success:browserBuild.success}));
await Bun.write(resolve(root,output),JSON.stringify({schema:'academy.dom01-checks.v1',scope:'source-selection-and-existing-synthetic-behavior',sourceCommit:'4bdef2c77cb9a537cecf806ba16054646147dbc5',syntheticSocketAdmitted:false,records,preservedPins,notRun:['PostgreSQL-dependent tests (explicitly skipped without a socket)','Native Academy reads/writes, printing/distribution and teacher acceptance','Full month-end-web package check/build writes dist assets outside allowed artifact paths; equivalent typecheck/test and in-memory browser bundle run separately','Full aggregate module check after root dependency restoration; DOM-01 changes architecture/Work only and retains initial aggregate failure'],effects:{native:0,sourceBusinessWrites:0,parentSends:0,publication:0}},null,2)+'\n');
