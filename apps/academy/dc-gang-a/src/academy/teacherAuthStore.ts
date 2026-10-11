import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { LoginIdentity } from './server';
import { createAuthSecrets, secretDigest } from './auth';

export interface PasswordRecoveryGrant {
  readonly id:string; readonly digest:string; readonly expiresAt:number;
  readonly identityDigest:string; readonly state:'available'|'claimed';
}
export interface ProductAuthState {
  readonly schemaVersion:1; readonly sessionKey:string; readonly invitationDigest:string|null;
  readonly identity:LoginIdentity|null; readonly passwordRecovery?:PasswordRecoveryGrant|null;
}
function identityDigest(identity:LoginIdentity):string{return secretDigest(JSON.stringify(identity));}
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
  private update<T>(change:(state:ProductAuthState)=>{state:ProductAuthState;result:T}):T {
    const parent=lstatSync(dirname(this.file));
    if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0||parent.uid!==process.getuid!())throw Error('private_auth_directory_required');
    const lock=this.file+'.lock',temporary=this.file+'.'+randomUUID()+'.new';
    const fd=openSync(lock,'wx',0o600);
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
      closeSync(fd);unlinkSync(lock);
      try{unlinkSync(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    }
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
