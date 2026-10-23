import type { TrustedTeacherContext } from './contracts/teacherOperations';
import type { SourceRefreshStore } from './ports/sourceRefreshStore';
import type { SourceDiscoveryRequest } from './nativeBookSource';
import { normalizeCohortDiscovery } from './sourceBridge';
import {readInputRecord} from '../contracts/readInputRecord';
import {planSourceAreas,type SourceAreaTask} from './sourceSynchronization';
export type Acquisition = {status:'blocked';reason:string}|{status:'uncertain';reason:string}|{status:'observed';data:unknown};
export type SourceAcquirer=(request:SourceDiscoveryRequest)=>Promise<Acquisition>;
export type SourceAreaAcquirer=(request:SourceAreaTask['request'])=>Promise<Acquisition>;
export interface SourceRuntime {ownerId:string;teacherLabel:string;teacherKey:string;collegeKey:string}
export class SourceRefreshCoordinator {
  constructor(readonly store:SourceRefreshStore,readonly config:SourceRuntime,readonly acquire:SourceAcquirer,readonly readArea?:SourceAreaAcquirer){}
  async result(actor:TrustedTeacherContext,requestId:string){
    if(actor.ownerId!==this.config.ownerId||actor.role!=='teacher')throw Error('owner_scope_conflict');
    return this.store.sourceRequestResult(actor.ownerId,actor.actorId,requestId);
  }
  async pending(actor:TrustedTeacherContext){
    if(actor.ownerId!==this.config.ownerId||actor.role!=='teacher')throw Error('owner_scope_conflict');
    return this.store.pendingSourceRequest(actor.ownerId,actor.actorId);
  }
  async history(actor:TrustedTeacherContext,cursor:string|null=null){
    if(actor.ownerId!==this.config.ownerId||actor.role!=='teacher')throw Error('owner_scope_conflict');
    return this.store.sourceRequestHistory(actor.ownerId,actor.actorId,cursor);
  }
  async refresh(actor:TrustedTeacherContext,studentId:string|null,requestId:string=crypto.randomUUID(),date?:string){
    if(actor.ownerId!==this.config.ownerId||actor.role!=='teacher')throw Error('owner_scope_conflict');
    const roster=await this.store.students(this.config.ownerId);
    const selected=studentId===null?roster:roster.filter(student=>student.id===studentId);
    if(selected.length===0)throw Error('student_scope_conflict');
    const sync=date!==undefined&&this.readArea?{date,tasks:planSourceAreas(this.config,selected,(await Promise.all(selected.map(student=>this.store.current(actor.ownerId,student.id)))).flat(),date)}:undefined;
    const admission=await this.store.admitSourceRequest(actor.ownerId,actor.actorId,studentId,requestId,sync);
    if(!admission.created)return {...await this.result(actor,admission.receipt.requestId),coalesced:admission.receipt.requestId!==requestId};
    let baseApplied=false;
    try{
    const request:SourceDiscoveryRequest={teacherLabel:this.config.teacherLabel,teacherKey:this.config.teacherKey,collegeKey:this.config.collegeKey,studentNames:selected.map(student=>student.displayName)};
    const acquisition=await this.acquire(request);
    if(acquisition.status==='uncertain')return {...await this.result(actor,requestId),reason:acquisition.reason};
    if(acquisition.status==='blocked'){
      await this.store.finishSourceRequest(actor.ownerId,actor.actorId,requestId,'blocked',acquisition.reason);
      return this.result(actor,requestId);
    }
    if(readInputRecord(acquisition.data).source!=='direct_http_api')throw Error('source_transport_not_admitted');
    const normalized=normalizeCohortDiscovery(acquisition.data,request.studentNames);
    if(normalized.ownerId!==this.config.ownerId)throw Error('source_owner_drift');
    for(const student of normalized.students){
      const expected=selected.find(row=>row.displayName===student.registration.displayName);
      if(!expected||expected.id!==student.registration.id||expected.sourceKey.literalKey!==student.registration.sourceKey.literalKey)throw Error('source_student_binding_conflict');
    }
    const base=await this.store.applySourceRefresh(normalized,actor.actorId,requestId);
    if(!sync||!('commands' in base)||!base.commands)return base;
    baseApplied=true;
    let credentialRefused=false;
    for(const task of sync.tasks){
      let outcome:Acquisition;
      try{outcome=credentialRefused?{status:'blocked',reason:'prior_source_authentication_refusal'}:await this.readArea!(task.request);}catch(error){const code=error instanceof Error?error.message:'';outcome={status:'blocked',reason:/^[a-z][a-z0-9_]{1,100}$/.test(code)?code:'source_area_failed'};}
      if(outcome.status==='uncertain')return {...await this.result(actor,requestId),reason:outcome.reason};
      if(outcome.status==='blocked'&&/auth|login|credential|secret|principal|source_runtime_closed/.test(outcome.reason))credentialRefused=true;
      let saved;
      try{saved=await this.store.applySourceArea(actor.ownerId,actor.actorId,requestId,task.id,outcome);}
      catch(error){const code=error instanceof Error?error.message:'';if(/auth|login|credential|secret|principal/.test(code))credentialRefused=true;saved=await this.store.applySourceArea(actor.ownerId,actor.actorId,requestId,task.id,{status:'failed',reason:/^[a-z][a-z0-9_]{1,100}$/.test(code)?code:'source_area_failed'});}
      if(saved.status==='pending')return this.result(actor,requestId);
    }
    return await this.store.finishSourceAreas(actor.ownerId,actor.actorId,requestId);
    }catch(error){
      if(sync&&baseApplied)return this.result(actor,requestId);
      // applySourceRefresh only throws on a proven callback rollback; commit/readback uncertainty stays pending.
      await this.store.finishSourceRequest(actor.ownerId,actor.actorId,requestId,'failed','source_refresh_failed');
      throw error;
    }
  }
}
