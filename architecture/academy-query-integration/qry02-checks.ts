/** Focused serialized checks; never run historical precommit-only inspectors at this HEAD. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..'),owned='architecture/academy-query-integration/';
const out=owned+'observations/QRY-02-CHECKS-R1.json';assert(!existsSync(resolve(root,out)),'immutable output exists');
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const env={...process.env};delete env.DC_ACADEMY_TEST_SOCKET;
const records=[];
const run=async(id:string,args:string[],cwd='.')=>{
  const startedAt=new Date().toISOString(),p=Bun.spawn(args,{cwd:resolve(root,cwd),env,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
  records.push({id,args,cwd,startedAt,finishedAt:new Date().toISOString(),exitCode,stdoutSha256:sha(stdout),stderrSha256:sha(stderr),stdoutTail:stdout.slice(-6000),stderrTail:stderr.slice(-12000)});
  console.log(JSON.stringify({id,exitCode,summary:(stdout+stderr).slice(-450)}));
};
await run('actual-compiler',['bun','node_modules/typescript/bin/tsc','--version']);
await run('dc-typecheck',['bun','run','typecheck'],'apps/academy/dc-gang-a');
await run('qry02-focused-typecheck',['bun','node_modules/typescript/bin/tsc','--noEmit','-p',owned+'qry02-tsconfig.json']);
await run('dc-production-query-adversarial-and-affected-consumers',['bun','test','tests/academy/retainedQuery.test.ts','tests/academy/teacherObservation.test.ts','tests/academy/preparationView.test.ts','tests/academy/teacherReadSnapshot.test.ts'],'apps/academy/dc-gang-a');
await run('month-end-actual-transport-limit-pagination',['bun','test','./'+owned+'qry02-month-end.test.ts']);
await run('month-end-web-typecheck',['bun','node_modules/typescript/bin/tsc','--noEmit','-p','apps/academy/month-end-web/tsconfig.json']);
await run('synthetic-production-http-measurements',['bun',owned+'qry02-measure.ts']);
const baseline='29510c7ee9a5f8e6fc68bb6dbe5cf320bb66fc95';
const pins=['package.json','bun.lock','architecture/source-map.json','apps/academy/run.ts',...['dc-gang-a','gang-a','month-end-workbench'].flatMap(p=>['package.json','bun.lock'].map(f=>'apps/academy/'+p+'/'+f))];
const preservedPins=pins.map(path=>{const before=Bun.spawnSync(['git','show',baseline+':'+path],{cwd:root});assert.equal(before.exitCode,0);const current=readFileSync(resolve(root,path));assert.equal(sha(current),sha(before.stdout));return {path,sha256:sha(current)};});
const build=await Bun.build({entrypoints:[resolve(root,'apps/academy/dc-gang-a/src/academy/web/client.ts'),resolve(root,'apps/academy/month-end-web/src/app.ts')],target:'browser',format:'esm'});
records.push({id:'actual-two-browser-entrypoints-memory-build',exitCode:build.success?0:1,bytes:build.outputs.reduce((n,o)=>n+o.size,0),outputFilesWritten:false,logs:build.logs.map(l=>l.message)} as any);
const receipt={schema:'academy.qry02-checks.v1',createdAt:new Date().toISOString(),sourceBase:baseline,nativeThreadId:process.env.CODEX_THREAD_ID,records,preservedPins,
  retainedGaps:['No database socket admitted; PostgreSQL tests stay skipped, existing47 DOM skips remain source-qualified only','Historical catalog/DOM input/provenance gaps retained; reserved provenance is root-owned','Month-end native MCP launch remains held and SDK declarations may remain missing; only isolated in-process provider tested','Legacy teacher GET routes remain unbounded compatibility endpoints; actual teacher web/CLI use bounded pages then reconstruct documents','Browser modelContext and CLI final whole-document serialization are separate from page budget; downstream production MCP packaging belongs to CON'],
  notRun:['Unchanged full DOM suites/whole241 graph','Historical precommit-only QRY-01/QRY-BOUNDARY inspectors','Full all-module aggregate checks','Native/session/private source or credential/config/service access'],passed:records.every(r=>r.exitCode===0),nativeEffects:0};
await Bun.write(resolve(root,out),JSON.stringify(receipt,null,2)+'\n');if(!receipt.passed)process.exitCode=1;
