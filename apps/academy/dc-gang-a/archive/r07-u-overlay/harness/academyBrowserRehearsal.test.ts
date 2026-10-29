import {describe,expect,test} from 'bun:test';
import {resolve} from 'node:path';
import {mkdtempSync,existsSync,readFileSync} from 'node:fs';
const repo=resolve(import.meta.dir,'../..');
const run=(args:string[])=>Bun.spawnSync({cmd:[process.execPath,'--no-env-file','harness/academy_browser_rehearsal.ts',...args],cwd:repo,env:{...process.env,HERMES_HOME:'/opt/data/profiles/dc-gang-a-dev'},stdout:'pipe',stderr:'pipe'});
describe('synthetic-only browser rehearsal admission',()=>{
 test('the default memory fixture implements the same read-snapshot port and boots the actual app',async()=>{
  const output=mkdtempSync('/opt/data/profiles/dc-gang-a-dev/cache/scratch/rails-memory-');
  const child=Bun.spawn({cmd:[process.execPath,'--no-env-file','harness/academy_browser_rehearsal.ts','--synthetic-only','--output-dir',output],cwd:repo,env:{...process.env,HERMES_HOME:'/opt/data/profiles/dc-gang-a-dev'},stdout:'pipe',stderr:'pipe'});
  try{
   for(let i=0;i<100&&!existsSync(output+'/endpoint.json')&&child.exitCode===null;i++)await Bun.sleep(20);
   expect(existsSync(output+'/endpoint.json')).toBe(true);
   const endpoint=JSON.parse(readFileSync(output+'/endpoint.json','utf8'));
   expect(endpoint.productionModified).toBe(false);expect(endpoint.teacherObservationEnabled).toBe(false);
   const response=await fetch(endpoint.origin+'/api/cohort');expect(response.status).toBe(200);expect((await response.json()).rowCount).toBe(2);
  }finally{child.kill('SIGTERM');await child.exited;}
 });
 test('advertises the opt-in synthetic PostgreSQL observation lane without making it default',()=>{
  const result=run(['--help']);expect(result.exitCode).toBe(0);
  const help=JSON.parse(new TextDecoder().decode(result.stdout));
  expect(help.teacherObservationOption).toBe('--teacher-observation-test-socket');
  expect(help.production).toBe(false);
 });
 test('refuses a production or foreign socket before opening PostgreSQL',()=>{
  const result=run(['--synthetic-only','--output-dir','/opt/data/profiles/dc-gang-a-dev/cache/scratch/denied-rehearsal','--teacher-observation-test-socket','/opt/data/profiles/dc-gang-a-dev/academy/socket']);
  expect(result.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toContain('synthetic_test_socket_required');
 });
});
