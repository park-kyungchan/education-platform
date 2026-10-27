import { describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {createHash} from 'node:crypto';
import { createAuthSecrets } from '../../src/academy/auth';
import { TeacherAuthStore,ownerCursorLeaseFor,type NativeOwnerCursorBinding,type NativeOwnerCursorLease } from '../../src/academy/teacherAuthStore';

function fixture(){
  const directory=mkdtempSync(join(process.env.TMPDIR??tmpdir(), 'teacher-auth-test-'));
  const file=join(directory,'web-auth.json');
  const initial={schemaVersion:1 as const,sessionKey:createAuthSecrets().sessionKey,invitationDigest:null,identity:{actorId:'fixture-teacher',username:'fixture',passwordHash:'synthetic-old-hash'}};
  writeFileSync(file,JSON.stringify(initial),{mode:0o600});
  return {directory,file,initial,store:new TeacherAuthStore(file)};
}
describe('lease-private cursor codec over fictional owner files',()=>{
 test('A0 consume/register contenders fail before mutation under the same lease, then setup occurs once',async()=>{
  const f=fixture();try{
   writeFileSync(f.file,JSON.stringify({...f.initial,identity:null,invitationDigest:'synthetic-invitation-digest'}),{mode:0o600});
   const before=readFileSync(f.file);
   await f.store.withOutputLease(async()=>{expect(()=>f.store.consumeInvitation('synthetic-invitation-digest')).toThrow('private_auth_lock_required');expect(readFileSync(f.file)).toEqual(before);});
   expect(readFileSync(f.file)).toEqual(before);f.store.consumeInvitation('synthetic-invitation-digest');
   const consumed=readFileSync(f.file);
   await f.store.withOutputLease(async()=>{expect(()=>f.store.registerIdentity(f.initial.identity)).toThrow('private_auth_lock_required');expect(readFileSync(f.file)).toEqual(consumed);});
   expect(readFileSync(f.file)).toEqual(consumed);f.store.registerIdentity(f.initial.identity);
   expect(f.store.read().identity).toEqual(f.initial.identity);expect(()=>f.store.consumeInvitation('synthetic-invitation-digest')).toThrow('setup_not_admitted');
  }finally{rmSync(f.directory,{recursive:true});}
 });
 const context={registrySha256:'a'.repeat(64),processNonce:'fictional-incarnation',interfaceBinding:'b'.repeat(64),consumerProfile:'CURRENT_1_1',consumerProfileDigest:'c'.repeat(64)};
 const value:NativeOwnerCursorBinding={domain:'native-read-continuation/v3',requestDigest:'d'.repeat(64),scopeBinding:'e'.repeat(64),principalBinding:'f'.repeat(64),registrySha256:context.registrySha256,readRevision:'read:fictional',policyRevision:'policy:fictional',asOf:'2026-10-23T00:00:00.000Z',interfaceBinding:context.interfaceBinding,readAdmissionId:'fictional-page-1',outputAdmissionId:'fictional-page-1',recipientBinding:'0'.repeat(64),pageSize:1,sealedPosition:'1',expiresAt:'2026-10-23T00:15:00.000Z',integrityProofHandle:'academy-native-owner-aes256gcm/v1',consumerProfile:'CURRENT_1_1',consumerProfileDigest:context.consumerProfileDigest};
 test('fresh nonce, exact18 authenticated record and no plaintext; escaped capability expires with lease',async()=>{
  const f=fixture();let escaped:NativeOwnerCursorLease|undefined;
  try{
   expect(()=>ownerCursorLeaseFor(f.initial,context,()=>true)).toThrow();
   await f.store.withOutputLease(async state=>{
    const codec=ownerCursorLeaseFor(state,context,()=>true);escaped=codec;
    const one=codec.seal(value),two=codec.seal(value);expect(one).not.toBe(two);expect(one.startsWith('nrc3.')).toBe(true);expect(one.includes('fictional')).toBe(false);expect(codec.open(one)).toEqual(value);
    expect(one.split('.').map(x=>x.length).filter((_,n)=>n===1||n===3)).toEqual([16,22]);
   });
   expect(()=>escaped!.seal(value)).toThrow();expect(existsSync(f.file+'.lock')).toBe(false);
  }finally{rmSync(f.directory,{recursive:true});}
 });
 test('tamper, noncanonical base64, lengths, huge token, closed record and unsafe position fail without diagnostics',async()=>{
  const f=fixture();try{await f.store.withOutputLease(async state=>{
   const codec=ownerCursorLeaseFor(state,context,()=>true),token=codec.seal(value),parts=token.split('.');
   const changed=parts.slice();changed[2]=(changed[2]![0]==='A'?'B':'A')+changed[2]!.slice(1);
   for(const malformed of [changed.join('.'),token+'=',token+'.extra',token.replace('nrc3.','nrc2.'),'nrc3.a.b.c','x'.repeat(8193),token+'\n'])expect(()=>codec.open(malformed)).toThrow('opaque_cursor_refused');
   for(const position of ['-1','01','1.0','1e2','9007199254740992'])expect(()=>codec.seal({...value,sealedPosition:position})).toThrow();
   expect(()=>codec.seal({...value,extra:true} as NativeOwnerCursorBinding)).toThrow();expect(()=>codec.seal({...value,outputAdmissionId:'different-page'})).toThrow();
  });}finally{rmSync(f.directory,{recursive:true});}
 });
 test('incarnation, profile, interface, owner-key and current-authorization binding cannot be reused',async()=>{
  const a=fixture(),b=fixture();let token='';try{
   await a.store.withOutputLease(async state=>{let active=true;const c=ownerCursorLeaseFor(state,context,()=>active);token=c.seal(value);active=false;expect(()=>c.open(token)).toThrow();});
   for(const delta of [{processNonce:'restarted'},{interfaceBinding:'1'.repeat(64)},{consumerProfileDigest:'2'.repeat(64)},{consumerProfile:'OLD_SECTION_1_0'}])await a.store.withOutputLease(async state=>{expect(()=>ownerCursorLeaseFor(state,{...context,...delta},()=>true).open(token)).toThrow();});
   await b.store.withOutputLease(async state=>{expect(()=>ownerCursorLeaseFor(state,context,()=>true).open(token)).toThrow();});
  }finally{rmSync(a.directory,{recursive:true});rmSync(b.directory,{recursive:true});}
 });
});
describe('coordinated identity-only probe on private toy authentication',()=>{
 const B={actorId:'fictional-B',username:'fictional-b',passwordHash:'fictional-b-hash'};
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 test('preserves key, every nonidentity field and exact noncanonical original bytes across separate swap and restore',()=>{
  const f=fixture();try{
   const state={...f.initial,extension:{keep:['unchanged',17]},passwordRecovery:null};
   const original=Buffer.from('  '+JSON.stringify(state,null,2)+'\r\n');writeFileSync(f.file,original);
   const custody=f.store.substituteCoordinatedIdentityOnly({expectedAuthSha256:hash(original),assertOccurrence:()=>{}},B);
   const {identity:_old,...before}=state,{identity,...after}=f.store.read() as typeof state;
   expect(identity).toEqual(B);expect(after).toEqual(before);expect(custody.originalRaw).toEqual(original);
   f.store.restoreCoordinatedIdentityOnly({expectedAuthSha256:custody.substitutedSha256,assertOccurrence:()=>{}},custody);
   expect(readFileSync(f.file)).toEqual(original);expect(existsSync(f.file+'.lock')).toBe(false);
  }finally{rmSync(f.directory,{recursive:true});}
 });
 test('output lease excludes both probe writers; busy cannot overwrite auth or remove the lease lock',async()=>{
  const f=fixture();try{
   const original=readFileSync(f.file),occ={expectedAuthSha256:hash(original),assertOccurrence:()=>{}};
   await f.store.withOutputLease(async()=>{expect(()=>f.store.substituteCoordinatedIdentityOnly(occ,B)).toThrow();expect(readFileSync(f.file)).toEqual(original);expect(existsSync(f.file+'.lock')).toBe(true);});
   const custody=f.store.substituteCoordinatedIdentityOnly(occ,B),swapped=readFileSync(f.file);
   await f.store.withOutputLease(async()=>{expect(()=>f.store.restoreCoordinatedIdentityOnly({expectedAuthSha256:hash(swapped),assertOccurrence:()=>{}},custody)).toThrow();expect(readFileSync(f.file)).toEqual(swapped);});
  }finally{rmSync(f.directory,{recursive:true});}
 });
 test('hash drift, same actor, invalid B and expired occurrence leave exact original bytes unchanged',()=>{
  const f=fixture();try{
   const original=readFileSync(f.file),occ={expectedAuthSha256:hash(original),assertOccurrence:()=>{}};
   expect(()=>f.store.substituteCoordinatedIdentityOnly({...occ,expectedAuthSha256:'0'.repeat(64)},B)).toThrow('product_auth_changed');
   expect(()=>f.store.substituteCoordinatedIdentityOnly(occ,f.initial.identity)).toThrow('distinct_registered_identity_required');
   expect(()=>f.store.substituteCoordinatedIdentityOnly(occ,{...B,passwordHash:''})).toThrow('genuine_b_identity_required');
   let checks=0;expect(()=>f.store.substituteCoordinatedIdentityOnly({...occ,assertOccurrence:()=>{if(++checks===2)throw Error('expired');}},B)).toThrow('expired');
   expect(readFileSync(f.file)).toEqual(original);expect(existsSync(f.file+'.lock')).toBe(false);
  }finally{rmSync(f.directory,{recursive:true});}
 });
 test('restore refuses corrupt custody and a changed session key, never reconstructing A',()=>{
  const f=fixture();try{
   const original=readFileSync(f.file),custody=f.store.substituteCoordinatedIdentityOnly({expectedAuthSha256:hash(original),assertOccurrence:()=>{}},B),swapped=readFileSync(f.file);
   expect(()=>f.store.restoreCoordinatedIdentityOnly({expectedAuthSha256:hash(swapped),assertOccurrence:()=>{}},{...custody,originalRaw:Buffer.from('{}')})).toThrow('exact_original_auth_bytes_required');
   writeFileSync(f.file,JSON.stringify({...f.store.read(),sessionKey:'different-key'}));const changed=readFileSync(f.file);
   expect(()=>f.store.restoreCoordinatedIdentityOnly({expectedAuthSha256:hash(changed),assertOccurrence:()=>{}},custody)).toThrow();expect(readFileSync(f.file)).toEqual(changed);
  }finally{rmSync(f.directory,{recursive:true});}
 });
 test('private symlink and permissive file safeguards apply to the new writer',()=>{
  const f=fixture();try{
   const original=readFileSync(f.file),occ={expectedAuthSha256:hash(original),assertOccurrence:()=>{}};
   chmodSync(f.file,0o644);expect(()=>f.store.substituteCoordinatedIdentityOnly(occ,B)).toThrow('private_auth_file_required');chmodSync(f.file,0o600);
   const link=join(f.directory,'alias.json');symlinkSync(f.file,link);expect(()=>new TeacherAuthStore(link).substituteCoordinatedIdentityOnly(occ,B)).toThrow();expect(readFileSync(f.file)).toEqual(original);
  }finally{rmSync(f.directory,{recursive:true});}
 });
});
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
describe('same-file output lease',()=>{
  test('holds the lease across awaited use with the current verified state and leaves auth bytes unchanged',async ()=>{
    const f=fixture();
    try{
      const before=readFileSync(f.file,'utf8');
      const result=await f.store.withOutputLease(async state=>{
        expect(state).toEqual(f.initial);
        expect(existsSync(f.file+'.lock')).toBe(true);
        expect(()=>f.store.prepareRecovery(1000)).toThrow();
        return 'prepared';
      });
      expect(result).toBe('prepared');
      expect(existsSync(f.file+'.lock')).toBe(false);
      expect(readFileSync(f.file,'utf8')).toBe(before);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('busy lease and writer fail explicitly with no replay, then the writer succeeds once after release',async ()=>{
    const f=fixture();
    try{
      let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
      let firstUses=0,secondUses=0;
      const first=f.store.withOutputLease(async ()=>{firstUses++;await gate;return 'first';});
      await expect(f.store.withOutputLease(async ()=>{secondUses++;return 'second';})).rejects.toThrow();
      expect(()=>f.store.prepareRecovery(1000)).toThrow();
      release();
      await expect(first).resolves.toBe('first');
      expect(firstUses).toBe(1);expect(secondUses).toBe(0);
      expect(existsSync(f.file+'.lock')).toBe(false);
      expect(f.store.prepareRecovery(1000).expiresAt).toBe(1900);
      expect(existsSync(f.file+'.lock')).toBe(false);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('synchronous recheck rejects a state rotated during awaited use and still cleans the exact lease',async ()=>{
    const f=fixture();
    try{
      await expect(f.store.withOutputLease(async ()=>{
        writeFileSync(f.file,JSON.stringify({...f.initial,sessionKey:createAuthSecrets().sessionKey})+'\n',{mode:0o600});
        return 'stale';
      })).rejects.toThrow('product_auth_changed');
      expect(existsSync(f.file+'.lock')).toBe(false);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('callback failure propagates, auth bytes stay unchanged and the lease is cleaned',async ()=>{
    const f=fixture();
    try{
      const before=readFileSync(f.file,'utf8');
      await expect(f.store.withOutputLease(async ()=>{throw Error('synthetic_commit_failure');})).rejects.toThrow('synthetic_commit_failure');
      expect(readFileSync(f.file,'utf8')).toBe(before);
      expect(existsSync(f.file+'.lock')).toBe(false);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('replacement lock is preserved and release fails closed on identity mismatch',async ()=>{
    const f=fixture();
    try{
      const before=readFileSync(f.file,'utf8');
      await expect(f.store.withOutputLease(async ()=>{
        unlinkSync(f.file+'.lock');
        writeFileSync(f.file+'.lock','foreign-replacement',{mode:0o600});
        return 'prepared';
      })).rejects.toThrow('private_auth_lock_required');
      expect(readFileSync(f.file+'.lock','utf8')).toBe('foreign-replacement');
      expect(readFileSync(f.file,'utf8')).toBe(before);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('disappeared lock fails closed without unlinking or recreating a pathname',async ()=>{
    const f=fixture();
    try{
      const before=readFileSync(f.file,'utf8');
      await expect(f.store.withOutputLease(async ()=>{
        unlinkSync(f.file+'.lock');
        return 'prepared';
      })).rejects.toThrow('private_auth_lock_required');
      expect(existsSync(f.file+'.lock')).toBe(false);
      expect(readFileSync(f.file,'utf8')).toBe(before);
    }finally{rmSync(f.directory,{recursive:true});}
  });
  test('foreign or symlinked lock fails closed and is never removed as owned cleanup',async ()=>{
    const f=fixture();
    try{
      const before=readFileSync(f.file,'utf8');
      writeFileSync(f.file+'.lock','foreign-lock',{mode:0o600});
      await expect(f.store.withOutputLease(async ()=>'never')).rejects.toThrow();
      expect(readFileSync(f.file+'.lock','utf8')).toBe('foreign-lock');
      rmSync(f.file+'.lock');
      symlinkSync(f.file,f.file+'.lock');
      await expect(f.store.withOutputLease(async ()=>'never')).rejects.toThrow();
      expect(existsSync(f.file+'.lock')).toBe(true);
      expect(readFileSync(f.file,'utf8')).toBe(before);
    }finally{rmSync(f.directory,{recursive:true});}
  });
});

test('coordinated identity publication rejects an oversized successor before changing exact toy bytes',()=>{
 const f=fixture();try{
  const before=readFileSync(f.file),hash=createHash('sha256').update(before).digest('hex');
  expect(()=>f.store.substituteCoordinatedIdentityOnly({expectedAuthSha256:hash,assertOccurrence:()=>{}},{actorId:'distinct-B',username:'fictional-B',passwordHash:'x'.repeat(20001)})).toThrow('private_auth_file_bound');
  expect(readFileSync(f.file)).toEqual(before);expect(readdirSync(f.directory)).toEqual(['web-auth.json']);
 }finally{rmSync(f.directory,{recursive:true,force:true});}
});
test('a Root occurrence revoked at publication retains original toy bytes and cleans only its own temporary lock',()=>{
 const f=fixture();try{
  const before=readFileSync(f.file),hash=createHash('sha256').update(before).digest('hex');
  const assertOccurrence=()=>{if(readdirSync(f.directory).some(name=>name.endsWith('.new')))throw Error('occurrence_expired');};
  expect(()=>f.store.substituteCoordinatedIdentityOnly({expectedAuthSha256:hash,assertOccurrence},{actorId:'distinct-B',username:'fictional-B',passwordHash:'fictional-hash'})).toThrow('occurrence_expired');
  expect(readFileSync(f.file)).toEqual(before);expect(readdirSync(f.directory)).toEqual(['web-auth.json']);
 }finally{rmSync(f.directory,{recursive:true,force:true});}
});
