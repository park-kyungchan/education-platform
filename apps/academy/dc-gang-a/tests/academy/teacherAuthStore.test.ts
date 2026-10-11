import { describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuthSecrets } from '../../src/academy/auth';
import { TeacherAuthStore } from '../../src/academy/teacherAuthStore';

function fixture(){
  const directory=mkdtempSync(join(process.env.TMPDIR??tmpdir(), 'teacher-auth-test-'));
  const file=join(directory,'web-auth.json');
  const initial={schemaVersion:1 as const,sessionKey:createAuthSecrets().sessionKey,invitationDigest:null,identity:{actorId:'fixture-teacher',username:'fixture',passwordHash:'synthetic-old-hash'}};
  writeFileSync(file,JSON.stringify(initial),{mode:0o600});
  return {directory,file,initial,store:new TeacherAuthStore(file)};
}
describe('owner-qualified teacher password recovery persistence',()=>{
  test('the selected runtime uses recovery qualification rather than creating authentication or migrating schema',()=>{
    const source=readFileSync(new URL('../../src/academy/main.ts',import.meta.url),'utf8');
    expect(source).toContain('authStore.readExistingIdentity()');
    expect(source).toContain('await store.assertRuntimeReady()');
    expect(source).not.toContain('createAuthSecrets');
    expect(source).not.toContain('store.migrate()');
    expect(source).not.toContain('writeFileSync');
  });
  test('runtime recovery requires the existing identity without creating or replacing authentication',()=>{
    const f=fixture();
    try{
      const before=readFileSync(f.file,'utf8');
      expect(f.store.readExistingIdentity()).toEqual(f.initial);
      expect(readFileSync(f.file,'utf8')).toBe(before);
      writeFileSync(f.file,JSON.stringify({...f.initial,identity:null}));
      expect(()=>f.store.readExistingIdentity()).toThrow('existing_teacher_identity_required');
      expect(f.store.read().identity).toBeNull();
      rmSync(f.file);
      expect(()=>f.store.readExistingIdentity()).toThrow('existing_teacher_authentication_required');
      expect(existsSync(f.file)).toBe(false);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('issues a new expiring grant without changing teacher identity or existing authentication',()=>{
    const f=fixture();
    try{
      const result=f.store.prepareRecovery(1000);
      const state=f.store.read();
      expect(state.identity).toEqual(f.initial.identity);
      expect(state.sessionKey).toBe(f.initial.sessionKey);
      expect(state.invitationDigest).toBeNull();
      expect(result.expiresAt).toBe(1900);
      expect(state.passwordRecovery).toMatchObject({id:result.id,state:'available',expiresAt:1900});
      expect(readFileSync(f.file,'utf8')).not.toContain(result.token);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('claims once and replaces only the password while revoking old signed sessions',()=>{
    const f=fixture();
    try{
      const ticket=f.store.prepareRecovery(1000);
      expect(f.store.claimRecovery(ticket.token,1001)).toMatchObject({id:ticket.id,expiresAt:1900});
      expect(()=>f.store.claimRecovery(ticket.token,1002)).toThrow('password_recovery_denied');
      const next=f.store.completeRecovery(ticket.id,'synthetic-new-hash',1003);
      expect(next.identity).toEqual({...f.initial.identity,passwordHash:'synthetic-new-hash'});
      expect(next.sessionKey).not.toBe(f.initial.sessionKey);
      expect(f.store.read().passwordRecovery).toBeNull();
      expect(()=>f.store.completeRecovery(ticket.id,'synthetic-new-hash',1004)).toThrow('password_recovery_denied');
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('expired, wrong and superseded tickets leave current authentication unchanged',()=>{
    const f=fixture();
    try{
      const expired=f.store.prepareRecovery(1000);
      expect(()=>f.store.claimRecovery(expired.token,1900)).toThrow('password_recovery_denied');
      const active=f.store.prepareRecovery(2000);
      expect(()=>f.store.claimRecovery(expired.token,2001)).toThrow('password_recovery_denied');
      expect(()=>f.store.claimRecovery('x'.repeat(43),2001)).toThrow('password_recovery_denied');
      expect(f.store.read().identity).toEqual(f.initial.identity);
      expect(f.store.claimRecovery(active.token,2002).id).toBe(active.id);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('unsafe file permissions and an existing writer lock fail closed without changing the password',()=>{
    const f=fixture();
    try{
      chmodSync(f.file,0o644);expect(()=>f.store.read()).toThrow('private_auth_file_required');chmodSync(f.file,0o600);
      writeFileSync(f.file+'.lock','synthetic-owned-lock',{mode:0o600});
      expect(()=>f.store.prepareRecovery()).toThrow();
      expect(f.store.read().identity).toEqual(f.initial.identity);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('the original one-use setup writer remains compatible and cannot replace a teacher',()=>{
    const f=fixture();
    try{
      writeFileSync(f.file,JSON.stringify({...f.initial,identity:null,invitationDigest:'synthetic-invitation-digest'}));
      f.store.consumeInvitation('synthetic-invitation-digest');
      expect(()=>f.store.consumeInvitation('synthetic-invitation-digest')).toThrow('setup_not_admitted');
      f.store.registerIdentity(f.initial.identity);
      expect(f.store.read().identity).toEqual(f.initial.identity);
      expect(()=>f.store.registerIdentity({...f.initial.identity,actorId:'foreign-fixture'})).toThrow('teacher_already_registered');
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('the existing setup writer cannot replace an already registered teacher',()=>{
    const f=fixture();
    try{
      expect(()=>f.store.registerIdentity({...f.initial.identity,actorId:'foreign-fixture'})).toThrow('teacher_already_registered');
      expect(f.store.read().identity).toEqual(f.initial.identity);
    }finally{rmSync(f.directory,{recursive:true});}
  });
});
