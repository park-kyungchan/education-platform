import {describe,expect,test} from 'bun:test';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
describe.skipIf(!socket)('synthetic PostgreSQL browser rehearsal',()=>{
 test('uses the actual HTTP/Application/store and reads exact append-only observation history',async()=>{
  const output=mkdtempSync('/opt/data/profiles/dc-gang-a-dev/cache/scratch/observation-rehearsal-');
  const server=Bun.spawn({cmd:[process.execPath,'--no-env-file','harness/academy_browser_rehearsal.ts','--synthetic-only','--output-dir',output,'--teacher-observation-test-socket',socket!],cwd:resolve(import.meta.dir,'../..'),env:{...process.env,HERMES_HOME:'/opt/data/profiles/dc-gang-a-dev'},stdout:'pipe',stderr:'pipe'});
  try{
   for(let i=0;i<100&&!existsSync(output+'/endpoint.json');i++)await Bun.sleep(20);
   if(!existsSync(output+'/endpoint.json')){server.kill('SIGTERM');await server.exited;throw Error('synthetic_rehearsal_start_failed: '+await new Response(server.stderr).text());}
   const endpoint=JSON.parse(readFileSync(output+'/endpoint.json','utf8'));
   expect(endpoint.store).toBe('synthetic_test_postgres');expect(endpoint.teacherObservationEnabled).toBe(true);
   const read=(path:string)=>fetch(endpoint.origin+path);
   const lesson=(await (await read('/api/class?date=2090-01-02')).json()).rows.find((row:{occurrence:{recordKey:string}})=>row.occurrence.recordKey==='41001');
   const input={studentId:lesson.studentId,occurrence:lesson.occurrence,basisRevisionId:lesson.revisionId,expectedRevisionId:null,idempotencyKey:'fixture-rehearsal-original',reportedAt:new Date().toISOString(),text:'Invented browser rehearsal original'};
   const scene=await (await read('/api/student?id='+encodeURIComponent(lesson.studentId)+'&date=2090-01-02')).json();
   const save=()=>fetch(endpoint.origin+'/api/teacher-observation',{method:'POST',headers:{Origin:endpoint.origin,'Content-Type':'application/json','X-Teacher-Owner':scene.teacherScope.ownerId,'X-Teacher-Actor':scene.teacherScope.actorId},body:JSON.stringify(input)});
   const first=await save();expect(first.status).toBe(200);const receipt=await first.json();
   expect(receipt.record.payload.text).toBe(input.text);expect(receipt.officialSaved).toBe(false);expect(receipt.parentSent).toBe(false);
   input.expectedRevisionId=receipt.revisionId;input.idempotencyKey='fixture-rehearsal-correction';input.text='Invented browser rehearsal correction';
   expect((await save()).status).toBe(200);
   const readback=await (await read('/qa/observation-readback')).json();
   expect(readback.syntheticOnly).toBe(true);expect(readback.observationPostCount).toBe(2);
   expect(readback.histories).toHaveLength(1);
   expect(readback.histories[0].records.map((row:{payload:{text:string}})=>row.payload.text)).toEqual(['Invented browser rehearsal original','Invented browser rehearsal correction']);
   expect(readback.officialSaved).toBe(false);expect(readback.parentSent).toBe(false);
  }finally{server.kill('SIGTERM');await server.exited;}
 });
});
