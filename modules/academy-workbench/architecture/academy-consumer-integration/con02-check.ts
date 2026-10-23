/** Source-only bounded CON-02 checks; no private loaders or broad legacy suites. */
import {writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dir,'../..'),cwd=resolve(root,'tools/academy-mcp');
const commands=[
  [process.execPath,'node_modules/typescript/bin/tsc','--noEmit'],
  [process.execPath,'test','--preload','./tests/network-deny.ts','tests/teacher-report.test.ts','tests/teacher-tools-mcp.test.ts'],
];
const observations=[];
for(const command of commands){
  const child=Bun.spawn(command,{cwd,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  observations.push({command,cwd,exitCode,stdout,stderr});
}
const adoption=JSON.parse(await readFile(resolve(root,'work/academy-workbench/academy-consumer-integration-20261021/inputs/CON-BASELINES-ADOPTION-R1.json'),'utf8'));
const baselineHashes=[];
for(const file of adoption.content.files){
  const actual=createHash('sha256').update(await readFile(resolve(root,file.path))).digest('hex');
  baselineHashes.push({path:file.path,expected:file.afterSha256,actual,match:actual===file.afterSha256});
}
const receipt={schema:'academy.consumer-con02-checks.v1',createdAt:new Date().toISOString(),nativeThreadId:process.env.CODEX_THREAD_ID,
  runtime:{bun:Bun.version,node:process.version},observations,baselineHashes,
  privateOriginalsRead:false,network:'network-deny preload in tests and SDK fixture subprocesses',
  notRun:['broad legacy suites with private loaders','native/WSL/VPS production integration','actual authentication/source acquisition/printing/sending','new committed snapshot/transition: Root owns exact commit'],
};
await writeFile(resolve(import.meta.dir,'observations/CON-02-CHECKS-R1.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({commands:observations.map(r=>({exitCode:r.exitCode,command:r.command})),baselinesUnchanged:baselineHashes.every(row=>row.match)}));
if(observations.some(r=>r.exitCode!==0)||baselineHashes.some(row=>!row.match))process.exitCode=1;
