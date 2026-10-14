import {expect,spyOn,test} from 'bun:test';
import {createTeacherServerHandler} from '../../src/academy/server';
import type {TeacherApplication} from '../../src/academy/application';

const origin='https://teacher.example.invalid';
const endpoints=[
  {path:'/api/login',body:{username:'unknown-fixture',password:'synthetic-password'},admittedStatus:401},
  {path:'/api/password-recovery-request',body:{},admittedStatus:200},
  {path:'/api/password-recovery-session',body:{token:'x'.repeat(43)},admittedStatus:403},
] as const;
function fixture(){
  const handler=createTeacherServerHandler({app:{ownerId:'synthetic-owner'} as TeacherApplication,origin,
    sessionKey:'synthetic-session-key',identity:{actorId:'synthetic-teacher',username:'fixture',passwordHash:'unused-synthetic-hash'},
    invitationDigest:null,saveIdentity:async()=>{},passwordRecovery:{
      claim:async()=>{throw Error('password_recovery_denied');},status:async()=>{throw Error('password_recovery_denied');},
      complete:async()=>{throw Error('password_recovery_denied');},
    }});
  return (endpoint:typeof endpoints[number],client:string)=>handler(new Request(origin+endpoint.path,{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':client},body:JSON.stringify(endpoint.body)}));
}

test('expired authentication keys release shared capacity for unseen clients on every public endpoint',async()=>{
  const clock=spyOn(Date,'now').mockReturnValue(1_000_000),request=fixture();
  try{
    for(let i=0;i<2048;i++){
      const endpoint=endpoints[i%endpoints.length]!;
      expect((await request(endpoint,'synthetic-client-'+i)).status).toBe(endpoint.admittedStatus);
    }
    for(const endpoint of endpoints)expect((await request(endpoint,'unseen-before-expiry')).status).toBe(429);
    clock.mockReturnValue(1_899_999);
    expect((await request(endpoints[0],'still-unseen-before-expiry')).status).toBe(429);
    clock.mockReturnValue(1_900_000);
    for(const endpoint of endpoints)expect((await request(endpoint,'unseen-after-expiry')).status).toBe(endpoint.admittedStatus);
  }finally{clock.mockRestore();}
});

test('active per-client throttles remain separate for login and recovery and expire at fifteen minutes',async()=>{
  const clock=spyOn(Date,'now').mockReturnValue(2_000_000),request=fixture();
  try{
    for(const endpoint of endpoints){
      for(let i=0;i<5;i++)expect((await request(endpoint,'same-synthetic-client')).status).toBe(endpoint.admittedStatus);
      const blocked=await request(endpoint,'same-synthetic-client');expect(blocked.status).toBe(429);expect(blocked.headers.get('Retry-After')).toBe('900');
    }
    clock.mockReturnValue(2_900_000);
    for(const endpoint of endpoints)expect((await request(endpoint,'same-synthetic-client')).status).toBe(endpoint.admittedStatus);
  }finally{clock.mockRestore();}
});
