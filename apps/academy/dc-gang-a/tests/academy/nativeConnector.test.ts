import { describe, expect, spyOn, test } from 'bun:test';
import { nativeBookAcquirer } from '../../src/academy/nativeConnector';
import * as connector from '../../src/academy/nativeConnector';
import {directScope,directWitness} from './directSourceFixture';
test('native area consumer forwards only supported owned literal read scopes and exposes no credentials',async()=>{
 expect(typeof connector.createNativeDirectReadAcquirer).toBe('function');let calls=0;
 const request={family:'student_course' as const,teacherLabel:directScope.teacherLabel,studentKey:'91001',studentName:directScope.studentNames[0]!};
 const source=connector.createNativeDirectReadAcquirer({...directScope,username:'fixture-user'},async input=>{calls++;expect(input).toEqual({username:'fixture-user',read:request});return {schemaVersion:1,observedAt:'2025-01-03T00:00:00Z',authentication:directWitness().authentication,source:{schemaVersion:1,family:'student_course',status:'observed',records:[],dailyResults:[],dayRecords:[],studentCourseScope:{teacherLabel:request.teacherLabel,studentKey:request.studentKey,studentName:request.studentName},studentCourses:[],observedAt:'2025-01-03T00:00:00Z',coverage:'observed_rows_not_all_assignments_or_pagination',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false},academyWrites:0,parentSends:0};});
 expect((await source.acquire(request)).status).toBe('observed');
 await expect(source.acquire({...request,studentName:'Foreign'})).rejects.toThrow('scope');
 await expect(source.acquire({...request,studentKey:'091001'})).rejects.toThrow('invalid');expect(calls).toBe(1);await source.close();
});
test('configured direct consumer verifies principal/subject witnesses and retains direct provenance',async()=>{
 expect(typeof connector.createNativeDirectBookAcquirer).toBe('function');
 let calls=0;const witness=directWitness();
 const source=connector.createNativeDirectBookAcquirer({...directScope,username:'fixture-user'},async request=>{calls++;expect(request).toEqual({username:'fixture-user',discover:directScope});return witness;});
 expect(calls).toBe(0);expect(source.connection().acquisition.lastObservedAt).toBeNull();
 expect(await source.acquire(directScope)).toEqual({status:'observed',data:witness.books});
 expect(source.connection().acquisition).toMatchObject({scope:'registered_course_book_only',authentication:'fresh_per_explicit_request',lastObservedAt:witness.books.observedAt,browserFallback:false});
 expect(calls).toBe(1);
});
test('foreign or malformed direct scopes refuse before the receiver and a missing identifier never authenticates',async()=>{
 let calls=0;const receiver=async()=>{calls++;return directWitness();};
 const source=connector.createNativeDirectBookAcquirer({...directScope,username:'fixture-user'},receiver);
 for(const patch of [{teacherKey:' 99001'},{collegeKey:'88002'},{teacherLabel:'Foreign Teacher'},{studentNames:['Foreign Learner']},{studentNames:['Invented Learner','Invented Learner']},{extra:'unadmitted'}])await expect(source.acquire({...directScope,...patch})).rejects.toThrow();
 const blocked=connector.createNativeDirectBookAcquirer({...directScope,username:null},receiver);
 expect(await blocked.acquire(directScope)).toEqual({status:'blocked',reason:'native_http_identifier_required'});expect(calls).toBe(0);
});
test('direct authentication does not excuse foreign subject, provenance, mutation or envelope drift',async()=>{
 const mutations=[
  (v:ReturnType<typeof directWitness>)=>{v.authentication.principalKey='99002';},
  (v:ReturnType<typeof directWitness>)=>{v.books.students[0]!.name='Foreign Learner';},
  (v:ReturnType<typeof directWitness>)=>{v.books.source='native_browser_managed_auth';},
  (v:ReturnType<typeof directWitness>)=>{v.books.academyMutations=1;},
  (v:ReturnType<typeof directWitness>)=>{Object.assign(v,{source:{foreign:'different operation'}});},
  (v:ReturnType<typeof directWitness>)=>{Object.assign(v,{unexpected:'different response'});},
 ];
 for(const mutate of mutations){const value=directWitness();mutate(value);const source=connector.createNativeDirectBookAcquirer({...directScope,username:'fixture-user'},async()=>value);await expect(source.acquire(directScope)).rejects.toThrow();expect(source.connection().acquisition.lastObservedAt).toBeNull();}
});
test('unverified native cancellation remains uncertain rather than admitting a new acquisition',async()=>{
 const source=connector.createNativeDirectBookAcquirer({...directScope,username:'fixture-user'},async()=>{throw Error('source_group_termination_unverified');});
 expect(await source.acquire(directScope)).toEqual({status:'uncertain',reason:'source_group_termination_unverified'});
});
test('source runtime shutdown drains its receiver and refuses subsequent dispatch',async()=>{
 let entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve);
 const source=connector.createNativeDirectBookAcquirer({...directScope,username:'fixture-user'},async(_input,signal)=>new Promise((_resolve,reject)=>{entered();signal.addEventListener('abort',()=>reject(Error('direct_source_cancelled')),{once:true});}));
 const flight=source.acquire(directScope);await started;
 expect(typeof source.close).toBe('function');await source.close();
 expect(await flight).toEqual({status:'blocked',reason:'direct_source_cancelled'});
 expect(await source.acquire(directScope)).toEqual({status:'blocked',reason:'source_runtime_closed'});
});
describe('native source connector scope',()=>{
  test('refuses empty source scope before native transport or credential use',async()=>{
    await expect(nativeBookAcquirer({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001',studentNames:[]})).rejects.toThrow('invalid_source_scope');
  });
  test('a valid request blocks unqualified direct authentication without launching the retired browser bridge',async()=>{
    const prior=process.env.HERMES_HOME;
    process.env.HERMES_HOME='/opt/data/profiles/dc-gang-a-dev';
    const spawn=spyOn(Bun,'spawn').mockImplementation(()=>{throw Error('unexpected_native_process');});
    try{
      const result=await nativeBookAcquirer({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001',studentNames:['Invented Learner']});
      expect(result).toEqual({status:'blocked',reason:'direct_http_authentication_not_qualified'});
      expect(spawn).not.toHaveBeenCalled();
    }finally{
      spawn.mockRestore();
      if(prior===undefined)delete process.env.HERMES_HOME;else process.env.HERMES_HOME=prior;
    }
  });
});
