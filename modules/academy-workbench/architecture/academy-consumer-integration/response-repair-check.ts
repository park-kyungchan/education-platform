/** One author-phase check: no native stdio startup retry and no private original loader. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dir,'../..'),cwd=resolve(root,'tools/academy-mcp');
const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
const commands=[
  [process.execPath,'node_modules/typescript/bin/tsc','--noEmit'],
  [process.execPath,'test','--preload','./tests/network-deny.ts','tests/teacher-report.test.ts','tests/teacher-response-contract.test.ts'],
];
const observations=[];
for(const command of commands){
  const child=Bun.spawn(command,{cwd,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  observations.push({command,cwd,exitCode,stdout,stderr});
}
const work=resolve(root,'work/academy-workbench/academy-consumer-integration-20261021');
const baseline=JSON.parse(await readFile(resolve(work,'inputs/CON-BASELINES-ADOPTION-R1.json'),'utf8'));
const baselineReadback=[];
for(const file of baseline.content.files){const actual=hash(await readFile(resolve(root,file.path)));baselineReadback.push({path:file.path,expected:file.afterSha256,actual,match:actual===file.afterSha256});}
const source=JSON.parse(await readFile(resolve(work,'inputs/CON-02-ADMISSION-R1.json'),'utf8')).content.canonicalSourceBinding;
const canonicalReadback=[];
for(const file of source.files){const actual=hash(await readFile(resolve(source.repositoryRoot,file.path)));canonicalReadback.push({path:file.path,expected:file.sha256,actual,match:actual===file.sha256});}
const receipt={schema:'academy.consumer-response-repair-author-check.v1',createdAt:new Date().toISOString(),nativeThreadId:process.env.CODEX_THREAD_ID,
  runtime:{bun:Bun.version,node:process.version},observations,baselineReadback,canonicalReadback,
  notRun:['Root exact changed-source production stdio control: expected after writer idle','native/real authentication/data/activation/adoption','broad legacy suites loading private originals'],
  taskDisposition:'running/pending; author-phase failures are observations, never a completed failed Task Verification',
  frameBoundary:'512KiB applies to serialized CallToolResult; actual JSONRPC frame overhead is independently measured without a universal frame cap claim',
  network:'deny preload retained for all author tests',privateOriginalsRead:false,stdioStartupAttempts:0};
await writeFile(resolve(import.meta.dir,'observations/CON-RESPONSE-REPAIR-CHECKS-R1.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({commands:observations.map(r=>({command:r.command,exitCode:r.exitCode})),baseline23Unchanged:baselineReadback.every(r=>r.match),canonicalClosureUnchanged:canonicalReadback.every(r=>r.match),taskState:'running/pending'}));
if(observations.some(r=>r.exitCode!==0)||baselineReadback.some(r=>!r.match)||canonicalReadback.some(r=>!r.match))process.exitCode=1;
