import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TeacherAuthStore } from '../../src/academy/teacherAuthStore';
import { createAuthSecrets, signTeacherSession } from '../../src/academy/auth';
import { createTeacherServerHandler } from '../../src/academy/server';
import type { TeacherApplication } from '../../src/academy/application';
import { teacherPage } from '../../src/academy/web/page';

const origin='https://teacher.example.invalid';
async function fixture(){
  const directory=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'teacher-recovery-http-'));
  const file=join(directory,'web-auth.json');
  const initial={schemaVersion:1 as const,sessionKey:createAuthSecrets().sessionKey,invitationDigest:null,identity:{actorId:'fixture-teacher',username:'fixture',passwordHash:await Bun.password.hash('synthetic-old-password-2090')}};
  writeFileSync(file,JSON.stringify(initial),{mode:0o600});
  const store=new TeacherAuthStore(file);
  const handler=createTeacherServerHandler({app:{ownerId:'fixture-owner'} as TeacherApplication,origin,...initial,
    saveIdentity:async()=>{},currentAuthentication:()=>store.read(),
    passwordRecovery:{claim:async token=>store.claimRecovery(token),status:async id=>store.recoveryStatus(id),complete:async(id,hash)=>store.completeRecovery(id,hash)}});
  const request=(path:string,body:unknown,cookie='',requestOrigin=origin)=>new Request(origin+path,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  return {directory,initial,store,handler,request};
}
describe('teacher password recovery HTTP boundary (no academy or DB effects)',()=>{
  test('offers the human recovery entry and two new-password fields without claiming email delivery',()=>{
    expect(teacherPage).toContain('id="forgot-password"');
    expect(teacherPage).toContain('href="/reset"');
    expect(teacherPage).toContain('id="reset-password"');
    expect(teacherPage).toContain('id="reset-password-confirm"');
    expect(teacherPage.match(/autocomplete="new-password"/g)).toHaveLength(2);
  });
  test('an old-password login already in flight cannot acquire a post-reset session',async()=>{
    const f=await fixture();
    try{
      const pending=f.handler(f.request('/api/login',{username:'fixture',password:'synthetic-old-password-2090'}));
      const ticket=f.store.prepareRecovery();f.store.claimRecovery(ticket.token);
      f.store.completeRecovery(ticket.id,'synthetic-rotated-hash-before-body-read');
      expect((await pending).status).toBe(401);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('public recovery refuses CSRF, arbitrary fields, short passwords and teacher-only cookies',async()=>{
    const f=await fixture();
    try{
      const ticket=f.store.prepareRecovery();
      expect((await f.handler(f.request('/api/password-recovery-session',{token:ticket.token},'', 'https://foreign.example.invalid'))).status).toBe(403);
      const begun=await f.handler(f.request('/api/password-recovery-session',{token:ticket.token}));
      const cookie=begun.headers.get('Set-Cookie')!.split(';')[0]!;
      expect((await f.handler(f.request('/api/password-reset',{password:'synthetic-new-password-2090',actorId:'foreign-fixture'},cookie))).status).toBe(400);
      expect((await f.handler(f.request('/api/password-reset',{password:'short'},cookie))).status).toBe(400);
      const teacherCookie='dc_teacher='+signTeacherSession(f.initial.sessionKey,'fixture-owner','fixture-teacher');
      expect((await f.handler(f.request('/api/password-reset',{password:'synthetic-new-password-2090'},teacherCookie))).status).toBe(403);
      expect(f.store.read().identity).toEqual(f.initial.identity);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('invalid recovery tickets are rate limited without consuming the owner ticket',async()=>{
    const f=await fixture();
    try{
      const ticket=f.store.prepareRecovery();let response:Response|null=null;
      for(let i=0;i<6;i++)response=await f.handler(f.request('/api/password-recovery-session',{token:'x'.repeat(43)}));
      expect(response!.status).toBe(429);expect(f.store.read().passwordRecovery?.state).toBe('available');
      expect(f.store.claimRecovery(ticket.token).id).toBe(ticket.id);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('the requesting browser cannot reset until its exact public request reference is owner approved',async()=>{
    const f=await fixture();
    try{
      const requested=await f.handler(f.request('/api/password-recovery-request',{}));
      expect(requested.status).toBe(200);
      const {requestRef,expiresAt}=await requested.json() as {requestRef:string;expiresAt:number};
      const cookie=requested.headers.get('Set-Cookie')!.split(';')[0]!;
      const foreign=await f.handler(f.request('/api/password-recovery-request',{}));
      const foreignCookie=foreign.headers.get('Set-Cookie')!.split(';')[0]!;
      const status=()=>f.handler(new Request(origin+'/api/password-recovery-status',{headers:{Cookie:cookie}}));
      expect((await status()).status).toBe(403);
      f.store.approveBrowserRecovery(requestRef,expiresAt);
      expect((await f.handler(new Request(origin+'/api/password-recovery-status',{headers:{Cookie:foreignCookie}}))).status).toBe(403);
      expect((await status()).status).toBe(200);
      const reset=await f.handler(f.request('/api/password-reset',{password:'synthetic-new-browser-password-2090'},cookie));
      expect(reset.status).toBe(200);
      expect(f.store.read().identity?.actorId).toBe('fixture-teacher');
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('exchanges the owner ticket for a recovery-only grant, resets the password and requires a new login',async()=>{
    const f=await fixture();
    try{
      const ticket=f.store.prepareRecovery();
      const begun=await f.handler(f.request('/api/password-recovery-session',{token:ticket.token}));
      expect(begun.status).toBe(200);
      const cookie=begun.headers.get('Set-Cookie')!.split(';')[0]!;
      expect(cookie).toStartWith('dc_password_recovery=');
      const reload=await f.handler(new Request(origin+'/api/password-recovery-status',{headers:{Cookie:cookie}}));
      expect(reload.status).toBe(200);
      expect(await reload.json()).toMatchObject({status:'password_recovery_admitted',username:'fixture'});
      expect((await f.handler(new Request(origin+'/api/cohort',{headers:{Cookie:cookie}}))).status).toBe(401);
      const oldCookie='dc_teacher='+signTeacherSession(f.initial.sessionKey,'fixture-owner','fixture-teacher');
      const reset=await f.handler(f.request('/api/password-reset',{password:'synthetic-new-password-2090'},cookie));
      expect(reset.status).toBe(200);
      expect(reset.headers.get('Set-Cookie')).toContain('Max-Age=0');
      expect(f.store.read().identity).toMatchObject({actorId:'fixture-teacher',username:'fixture'});
      expect(await Bun.password.verify('synthetic-new-password-2090',f.store.read().identity!.passwordHash)).toBe(true);
      expect((await f.handler(new Request(origin+'/api/cohort',{headers:{Cookie:oldCookie}}))).status).toBe(401);
      expect((await f.handler(f.request('/api/login',{username:'fixture',password:'synthetic-old-password-2090'}))).status).toBe(401);
      expect((await f.handler(f.request('/api/login',{username:'fixture',password:'synthetic-new-password-2090'}))).status).toBe(200);
      expect((await f.handler(f.request('/api/password-reset',{password:'synthetic-other-password-2090'},cookie))).status).toBe(403);
    }finally{rmSync(f.directory,{recursive:true});}
  });
});
