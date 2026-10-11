import {describe,expect,test} from 'bun:test';
import {mkdtempSync,existsSync,readFileSync} from 'node:fs';
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
describe.skipIf(!socket)('exact clinic synthetic native rehearsal fixture',()=>{
  test('existing owned fixture serves exact assigned work and actual protected clinic storage without production effects',async()=>{
    const output=mkdtempSync('/opt/data/profiles/dc-gang-a-dev/cache/scratch/clinic-rehearsal-');
    const server=Bun.spawn({cmd:[process.execPath,'--no-env-file','harness/academy_browser_rehearsal.ts','--synthetic-only','--output-dir',output,'--teacher-observation-test-socket',socket!],cwd:process.cwd(),env:{...process.env,HERMES_HOME:'/opt/data/profiles/dc-gang-a-dev'},stdout:'pipe',stderr:'pipe'});
    try{
      for(let i=0;i<100&&!existsSync(output+'/endpoint.json');i++)await Bun.sleep(20);
      if(!existsSync(output+'/endpoint.json')){server.kill('SIGTERM');await server.exited;throw Error('fixture_start_failed:'+await new Response(server.stderr).text());}
      const endpoint=JSON.parse(readFileSync(output+'/endpoint.json','utf8'));
      expect(endpoint.teacherClinicEnabled).toBe(true);
      const scene=await (await fetch(endpoint.origin+'/api/student?id=fixture-screen-student-A&date=2090-01-02')).json();
      expect(scene.workContext.data.sourceResults).toHaveLength(2);
      expect(scene.workContext.data.sourceResults.every((row:{sectionBinding:string;teacherCompletion:string})=>row.sectionBinding==='unknown'&&row.teacherCompletion==='not_inferred')).toBe(true);
      const work=scene.workContext.data.exactWork.assignments[0],attempt=work.attempts[0];
      const input={studentId:scene.student.id,assignmentRevisionId:work.record.revisionId,attemptEntityId:attempt.record.entityId,attemptRevisionId:attempt.record.revisionId,assignedItemId:attempt.items[0].item.assignedItemId,effectiveDate:'2090-01-02',expectedRevisionId:null,expectedPolicyRevision:scene.workContext.logic.policyRevision,idempotencyKey:'fixture-rehearsal-clinic',reportedAt:new Date().toISOString(),decision:'completed',inspection:{writtenSolution:true,correctionExplanation:true},note:'Invented rehearsal inspection'};
      const response=await fetch(endpoint.origin+'/api/teacher-clinic',{method:'POST',headers:{Origin:endpoint.origin,'Content-Type':'application/json','X-Teacher-Owner':scene.teacherScope.ownerId,'X-Teacher-Actor':scene.teacherScope.actorId},body:JSON.stringify(input)});expect(response.status).toBe(200);
      const receipt=await response.json();expect(receipt.record.payload.assignedItemId).toBe(input.assignedItemId);
      const readback=await (await fetch(endpoint.origin+'/qa/clinic-readback')).json();expect(readback.syntheticOnly).toBe(true);expect(readback.histories).toHaveLength(1);expect(readback.histories[0].records[0].revisionId).toBe(receipt.revisionId);
      expect(endpoint.productionModified).toBe(false);expect(readback.officialSaved).toBe(false);expect(readback.parentSent).toBe(false);
    }finally{server.kill('SIGTERM');await server.exited;}
  });
});
