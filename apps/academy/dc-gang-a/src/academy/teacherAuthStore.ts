import {nativeProtocolBounds} from './contracts/teacherOperations';
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {canonicalJson,assertInstant} from '../learning/model';
import type { LoginIdentity } from './server';
import { createAuthSecrets, secretDigest } from './auth';

/** Complete encoded owner cursor, in bytes (native-read entry v5 bindingRules). */
export const NATIVE_CURSOR_MAX_BYTES=8192;
export interface PasswordRecoveryGrant {
  readonly id:string; readonly digest:string; readonly expiresAt:number;
  readonly identityDigest:string; readonly state:'available'|'claimed';
}
export interface ProductAuthState {
  readonly schemaVersion:1; readonly sessionKey:string; readonly invitationDigest:string|null;
  readonly identity:LoginIdentity|null; readonly passwordRecovery?:PasswordRecoveryGrant|null;
}
function identityDigest(identity:LoginIdentity):string{return secretDigest(JSON.stringify(identity));}
const activeOutputStates=new WeakSet<object>();
const cursorKeys=['domain','requestDigest','scopeBinding','principalBinding','registrySha256','readRevision','policyRevision','asOf','interfaceBinding','readAdmissionId','outputAdmissionId','recipientBinding','pageSize','sealedPosition','expiresAt','integrityProofHandle','consumerProfile','consumerProfileDigest'] as const;
export interface NativeOwnerCursorBinding {
 readonly domain:'native-read-continuation/v3';readonly requestDigest:string;readonly scopeBinding:string;readonly principalBinding:string;readonly registrySha256:string;
 readonly readRevision:string;readonly policyRevision:string;readonly asOf:string;readonly interfaceBinding:string;readonly readAdmissionId:string;readonly outputAdmissionId:string;readonly recipientBinding:string;
 readonly pageSize:number;readonly sealedPosition:string;readonly expiresAt:string;readonly integrityProofHandle:'academy-native-owner-aes256gcm/v1';readonly consumerProfile:'CURRENT_1_1'|'OLD_SECTION_1_0';readonly consumerProfileDigest:string;
}
export interface NativeOwnerCursorLease {seal(binding:NativeOwnerCursorBinding):string;open(token:string):NativeOwnerCursorBinding;assertCurrent():void}
export interface NativeOwnerCursorContext {readonly registrySha256:string;readonly processNonce:string;readonly interfaceBinding:string;readonly consumerProfile:string;readonly consumerProfileDigest:string}
/** Internal owner capability, usable only while THIS real output lease is live.
 * No key accessor, caller signer, public route, or persistent token state. */
export function ownerCursorLeaseFor(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>,context:NativeOwnerCursorContext,current:()=>boolean):NativeOwnerCursorLease {
 const codec='academy-native-owner-aes256gcm/v1',domain='native-read-continuation/v3';
 const fail=():never=>{throw Error('opaque_cursor_refused');};
 const assertCurrent=()=>{if(!activeOutputStates.has(state)||!state.identity||!current())fail();};
 assertCurrent();
 for(const h of [context.registrySha256,context.interfaceBinding,context.consumerProfileDigest])if(!/^[a-f0-9]{64}$/.test(h))fail();
 if(!context.processNonce||!['CURRENT_1_1','OLD_SECTION_1_0'].includes(context.consumerProfile))fail();
 const aad=Buffer.from(canonicalJson({tokenDomain:domain,codecVersion:codec,...context}));
 const key=()=>createHmac('sha256',Buffer.from(state.sessionKey,'utf8')).update(canonicalJson({domain:'academy-owner-token-key/v1',purpose:domain,registrySha256:context.registrySha256,processNonce:context.processNonce})).digest();
 const binding=(value:unknown):NativeOwnerCursorBinding=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return fail();const x=value as Record<string,unknown>;
  if(Object.keys(x).length!==cursorKeys.length||cursorKeys.some(k=>!Object.hasOwn(x,k)))return fail();
  for(const k of cursorKeys)if(k!=='pageSize'&&(typeof x[k]!=='string'||!(x[k] as string).length))return fail();
  for(const k of ['requestDigest','scopeBinding','principalBinding','registrySha256','interfaceBinding','recipientBinding','consumerProfileDigest'])if(!/^[a-f0-9]{64}$/.test(x[k] as string))return fail();
  if(x.domain!==domain||x.integrityProofHandle!==codec||x.registrySha256!==context.registrySha256||x.interfaceBinding!==context.interfaceBinding||x.consumerProfile!==context.consumerProfile||x.consumerProfileDigest!==context.consumerProfileDigest)return fail();
  if(!Number.isSafeInteger(x.pageSize)||Number(x.pageSize)<nativeProtocolBounds.pageSize.min||Number(x.pageSize)>nativeProtocolBounds.pageSize.max||! /^(0|[1-9][0-9]*)$/.test(x.sealedPosition as string)||!Number.isSafeInteger(Number(x.sealedPosition)))return fail();
  if(x.readAdmissionId!==x.outputAdmissionId)return fail();
  try{assertInstant(x.asOf as string);assertInstant(x.expiresAt as string);}catch{return fail();}
  return x as unknown as NativeOwnerCursorBinding;
 };
 const decode=(value:string,length?:number):Buffer=>{
  if(!/^[A-Za-z0-9_-]+$/.test(value))return fail();const bytes=Buffer.from(value,'base64url');
  if(bytes.toString('base64url')!==value||length!==undefined&&bytes.length!==length)return fail();return bytes;
 };
 return Object.freeze({assertCurrent,
  seal(value:NativeOwnerCursorBinding){assertCurrent();const x=binding(value),nonce=randomBytes(12),k=key();
   try{const cipher=createCipheriv('aes-256-gcm',k,nonce,{authTagLength:16});cipher.setAAD(aad);const encrypted=Buffer.concat([cipher.update(Buffer.from(canonicalJson(x))),cipher.final()]);const token=['nrc3',nonce.toString('base64url'),encrypted.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');if(Buffer.byteLength(token)>NATIVE_CURSOR_MAX_BYTES)return fail();assertCurrent();return token;}finally{k.fill(0);}
  },
  open(token:string){assertCurrent();if(typeof token!=='string'||Buffer.byteLength(token,'utf8')>NATIVE_CURSOR_MAX_BYTES)return fail();const parts=token.split('.');if(parts.length!==4||parts[0]!=='nrc3'||parts[1]!.length!==16||parts[3]!.length!==22)return fail();
   const nonce=decode(parts[1]!,12),encrypted=decode(parts[2]!),tag=decode(parts[3]!,16),k=key();let plain:Buffer|undefined;
   try{const decipher=createDecipheriv('aes-256-gcm',k,nonce,{authTagLength:16});decipher.setAAD(aad);decipher.setAuthTag(tag);const unauthenticated=decipher.update(encrypted);try{plain=Buffer.concat([unauthenticated,decipher.final()]);}finally{unauthenticated.fill(0);}
    const text=new TextDecoder('utf-8',{fatal:true}).decode(plain),x=binding(JSON.parse(text));if(canonicalJson(x)!==text)return fail();assertCurrent();return x;
   }catch{return fail();}finally{k.fill(0);plain?.fill(0);}
  }
 });
}
/** Source-only seam. The native caller must validate its separately sealed
 * Root occurrence immediately before each mutation; this interface grants no
 * authority. Original bytes are private RAM/anonymous-pipe material only. */
export interface CoordinatedIdentityOccurrence {
  readonly expectedAuthSha256:string;
  readonly assertOccurrence:()=>void;
}
export interface CoordinatedIdentityCustody {
  readonly originalRaw:Buffer; readonly originalSha256:string;
  readonly substitutedSha256:string;
}
/** Private product authentication only; not a native Session store or student-history writer. */
export class TeacherAuthStore {
  constructor(readonly file:string){}
  private snapshot():{state:ProductAuthState;serialized:string} {
    const fd=openSync(this.file,constants.O_RDONLY|constants.O_NOFOLLOW);
    let serialized:string;
    try{
      const stat=fstatSync(fd);
      if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o077)!==0||stat.uid!==process.getuid!()||stat.size>20000)throw Error('private_auth_file_required');
      serialized=readFileSync(fd,'utf8');
    }finally{closeSync(fd);}
    const state=JSON.parse(serialized) as ProductAuthState;
    if(state.schemaVersion!==1||typeof state.sessionKey!=='string'||!state.sessionKey||!(state.invitationDigest===null||typeof state.invitationDigest==='string'))throw Error('invalid_product_auth_state');
    if(state.identity!==null&&(!state.identity||typeof state.identity.actorId!=='string'||!state.identity.actorId||typeof state.identity.username!=='string'||!state.identity.username||typeof state.identity.passwordHash!=='string'||!state.identity.passwordHash))throw Error('invalid_product_auth_identity');
    if(state.passwordRecovery){const g=state.passwordRecovery;if(typeof g.id!=='string'||!g.id||!Number.isSafeInteger(g.expiresAt)||!/^[a-f0-9]{64}$/.test(g.digest)||!/^[a-f0-9]{64}$/.test(g.identityDigest)||!['available','claimed'].includes(g.state))throw Error('invalid_password_recovery_grant');}
    return {state,serialized};
  }
  read():ProductAuthState{return this.snapshot().state;}
  /** Existing-site recovery cannot bootstrap a missing or unregistered identity. */
  readExistingIdentity():ProductAuthState {
    let state:ProductAuthState;
    try{state=this.read();}
    catch(error){
      if((error as NodeJS.ErrnoException).code==='ENOENT')throw Error('existing_teacher_authentication_required');
      throw error;
    }
    if(!state.identity)throw Error('existing_teacher_identity_required');
    return state;
  }
  private acquirePrivateLock():{lock:string;fd:number;dev:number;ino:number} {
    const parent=lstatSync(dirname(this.file));
    if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0||parent.uid!==process.getuid!())throw Error('private_auth_directory_required');
    const lock=this.file+'.lock';
    let fd:number;
    try{fd=openSync(lock,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
    catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw Error('private_auth_lock_required');throw error;}
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o077)!==0||stat.uid!==process.getuid!()){
      let verified=false;
      try{const pathname=lstatSync(lock);verified=!pathname.isSymbolicLink()&&pathname.dev===stat.dev&&pathname.ino===stat.ino;}catch{verified=false;}
      try{closeSync(fd);}finally{if(verified)unlinkSync(lock);}
      throw Error('private_auth_lock_required');
    }
    return {lock,fd,dev:stat.dev,ino:stat.ino};
  }
  private releasePrivateLock(lock:string,fd:number,dev:number,ino:number):void {
    let verified=false;
    try{const pathname=lstatSync(lock);verified=pathname.isFile()&&!pathname.isSymbolicLink()&&pathname.dev===dev&&pathname.ino===ino&&pathname.nlink===1;}catch{verified=false;}
    try{closeSync(fd);}finally{
      if(!verified)throw Error('private_auth_lock_required');
      unlinkSync(lock);
    }
  }
  private update<T>(change:(state:ProductAuthState)=>{state:ProductAuthState;result:T}):T {
    const {lock,fd,dev,ino}=this.acquirePrivateLock();
    const temporary=this.file+'.'+randomUUID()+'.new';
    try{
      const {state:before,serialized:original}=this.snapshot();
      const {state,result}=change(before);
      const next=openSync(temporary,'wx',0o600);
      try{writeFileSync(next,JSON.stringify(state)+'\n');fsyncSync(next);}finally{closeSync(next);}
      if(this.snapshot().serialized!==original)throw Error('product_auth_changed');
      renameSync(temporary,this.file);
      const directory=openSync(dirname(this.file),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
      return result;
    }finally{
      try{this.releasePrivateLock(lock,fd,dev,ino);}
      finally{try{unlinkSync(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
    }
  }
  /** Ephemeral output lease on the shared private lock; never writes auth state bytes. */
  async withOutputLease<T>(use:(state:Readonly<ProductAuthState>)=>Promise<T>):Promise<T> {
    const {lock,fd,dev,ino}=this.acquirePrivateLock();
    try{
      const {state,serialized}=this.snapshot();
      activeOutputStates.add(state);
      try{const result=await use(state);
       if(this.snapshot().serialized!==serialized)throw Error('product_auth_changed');
       return result;
      }finally{activeOutputStates.delete(state);}
    }finally{this.releasePrivateLock(lock,fd,dev,ino);}
  }
  private coordinatedIdentityWrite<T>(occurrence:CoordinatedIdentityOccurrence,change:(raw:Buffer,state:ProductAuthState)=>{raw:Buffer;result:T}):T {
    if(!/^[a-f0-9]{64}$/.test(occurrence.expectedAuthSha256))throw Error('exact_auth_probe_occurrence_required');
    occurrence.assertOccurrence();
    const lock=this.acquirePrivateLock(),temporary=this.file+'.'+randomUUID()+'.new';
    let temporaryIdentity:{dev:number;ino:number}|null=null;
    try{
      this.snapshot(); // Retain all existing private file and state validation.
      const fd=openSync(this.file,constants.O_RDONLY|constants.O_NOFOLLOW);
      let original:Buffer;
      try{const s=fstatSync(fd);if(!s.isFile()||s.nlink!==1||(s.mode&0o077)!==0||s.uid!==process.getuid!()||s.size>20000)throw Error('private_auth_file_required');original=readFileSync(fd);}finally{closeSync(fd);}
      const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
      if(digest(original)!==occurrence.expectedAuthSha256)throw Error('product_auth_changed');
      const {raw,result}=change(original,JSON.parse(original.toString('utf8')) as ProductAuthState);
      if(raw.length>20000)throw Error('private_auth_file_bound');
      occurrence.assertOccurrence();
      const next=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
      try{const s=fstatSync(next);temporaryIdentity={dev:s.dev,ino:s.ino};if(!s.isFile()||s.nlink!==1||(s.mode&0o777)!==0o600||s.uid!==process.getuid!())throw Error('private_auth_file_required');writeFileSync(next,raw);fsyncSync(next);}finally{closeSync(next);}
      if(digest(Buffer.from(this.snapshot().serialized))!==occurrence.expectedAuthSha256)throw Error('product_auth_changed');
      occurrence.assertOccurrence();renameSync(temporary,this.file);temporaryIdentity=null;
      const dir=openSync(dirname(this.file),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(dir);}finally{closeSync(dir);}
      return result;
    }finally{
      try{if(temporaryIdentity){const s=lstatSync(temporary);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.dev!==temporaryIdentity.dev||s.ino!==temporaryIdentity.ino)throw Error('private_auth_temporary_ownership_required');unlinkSync(temporary);}}
      finally{this.releasePrivateLock(lock.lock,lock.fd,lock.dev,lock.ino);}
    }
  }
  /** Genuine B identity comes only from successful B0 native setup/login custody.
   * A session key, invitation/recovery and every nonidentity field stay intact. */
  substituteCoordinatedIdentityOnly(occurrence:CoordinatedIdentityOccurrence,genuineB:Readonly<LoginIdentity>):CoordinatedIdentityCustody {
    if(!genuineB||Object.keys(genuineB).some(k=>!['actorId','username','passwordHash'].includes(k))||['actorId','username','passwordHash'].some(k=>typeof genuineB[k as keyof LoginIdentity]!=='string'||!genuineB[k as keyof LoginIdentity]))throw Error('genuine_b_identity_required');
    return this.coordinatedIdentityWrite(occurrence,(original,state)=>{
      if(!state.identity||state.identity.actorId===genuineB.actorId)throw Error('distinct_registered_identity_required');
      const raw=Buffer.from(JSON.stringify({...state,identity:{...genuineB}})+'\n');
      return {raw,result:{originalRaw:Buffer.from(original),originalSha256:createHash('sha256').update(original).digest('hex'),substitutedSha256:createHash('sha256').update(raw).digest('hex')}};
    });
  }
  restoreCoordinatedIdentityOnly(occurrence:CoordinatedIdentityOccurrence,custody:CoordinatedIdentityCustody):void {
    if(occurrence.expectedAuthSha256!==custody.substitutedSha256||createHash('sha256').update(custody.originalRaw).digest('hex')!==custody.originalSha256)throw Error('exact_original_auth_bytes_required');
    this.coordinatedIdentityWrite(occurrence,(_current,state)=>{
      const original=JSON.parse(custody.originalRaw.toString('utf8')) as ProductAuthState;
      const {identity:_a,...a}=original,{identity:_b,...b}=state;
      if(!original.identity||JSON.stringify(a)!==JSON.stringify(b))throw Error('auth_nonidentity_changed');
      return {raw:Buffer.from(custody.originalRaw),result:undefined};
    });
  }
  prepareRecovery(now=Math.floor(Date.now()/1000)) {
    if(!Number.isSafeInteger(now)||now<0)throw Error('invalid_recovery_clock');
    return this.update(state=>{
      if(!state.identity)throw Error('teacher_identity_required');
      const token=randomBytes(32).toString('base64url'),id=randomUUID(),expiresAt=now+900;
      return {state:{...state,passwordRecovery:{id,digest:secretDigest(token),expiresAt,identityDigest:identityDigest(state.identity),state:'available'}},result:{token,id,expiresAt}};
    });
  }
  approveBrowserRecovery(requestRef:string,expiresAt:number,now=Math.floor(Date.now()/1000)) {
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestRef)||!Number.isSafeInteger(now)||!Number.isSafeInteger(expiresAt)||expiresAt<=now||expiresAt>now+900)throw Error('invalid_browser_recovery_request');
    return this.update(state=>{
      if(!state.identity)throw Error('teacher_identity_required');
      return {state:{...state,passwordRecovery:{id:requestRef,digest:secretDigest(randomBytes(32).toString('base64url')),expiresAt,identityDigest:identityDigest(state.identity),state:'claimed'}},result:{id:requestRef,expiresAt}};
    });
  }
  consumeInvitation(expectedDigest:string) {
    return this.update(state=>{
      if(state.identity||!expectedDigest||state.invitationDigest!==expectedDigest)throw Error('setup_not_admitted');
      return {state:{...state,invitationDigest:null},result:undefined};
    });
  }
  registerIdentity(identity:LoginIdentity) {
    return this.update(state=>{
      if(state.identity)throw Error('teacher_already_registered');
      return {state:{...state,identity,invitationDigest:null,passwordRecovery:null},result:undefined};
    });
  }
  private grant(state:ProductAuthState,id:string|undefined,phase:'available'|'claimed',now:number):PasswordRecoveryGrant {
    const grant=state.passwordRecovery;
    if(!Number.isSafeInteger(now)||!state.identity||!grant||grant.state!==phase||grant.expiresAt<=now||grant.identityDigest!==identityDigest(state.identity)||(id!==undefined&&grant.id!==id))throw Error('password_recovery_denied');
    return grant;
  }
  claimRecovery(token:string,now=Math.floor(Date.now()/1000)) {
    return this.update(state=>{
      const grant=this.grant(state,undefined,'available',now);
      if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||!timingSafeEqual(Buffer.from(secretDigest(token),'hex'),Buffer.from(grant.digest,'hex')))throw Error('password_recovery_denied');
      return {state:{...state,passwordRecovery:{...grant,state:'claimed'}},result:{id:grant.id,expiresAt:grant.expiresAt}};
    });
  }
  recoveryStatus(id:string,now=Math.floor(Date.now()/1000)) {
    const grant=this.grant(this.read(),id,'claimed',now);
    return {id:grant.id,expiresAt:grant.expiresAt};
  }
  completeRecovery(id:string,passwordHash:string,now=Math.floor(Date.now()/1000)) {
    return this.update(state=>{
      this.grant(state,id,'claimed',now);
      if(typeof passwordHash!=='string'||!passwordHash||passwordHash.length>1024)throw Error('invalid_password_hash');
      const identity={...state.identity!,passwordHash},sessionKey=createAuthSecrets().sessionKey;
      return {state:{...state,identity,sessionKey,passwordRecovery:null},result:{identity,sessionKey}};
    });
  }
}
