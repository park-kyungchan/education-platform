import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {applyJournalHttpAction} from '../../../../../apps/academy/dc-gang-a/src/lms/lessonJournalHttp.ts';
import {NativeDailyRecordBackend} from '../src/native-dailyrecord-backend.ts';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {createDailyRecordWorkflow,signAuthorization,textDigest,type DailyRecordAuthorization,type DailyRecordWorkflow} from '../src/dailyrecord-workflow.ts';
import type {DailyRecordContext,DailyRecordField} from '../src/dailyrecord-context.ts';
import {learningPolicy,safeguard} from './dailyrecord-fixture.ts';

// Purpose-built fictional identities, keys and records; never sampled from runtime data.
export const nativeScope={sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',studentId:'77001',lessonDate:'2040-01-04'};
const admission={teacherId:'99001',teacherLabel:'Invented Teacher',date:'2040-01-04',students:[{studentId:'77001',displayName:'Invented Student'}],sourceBundleSha256:'b'.repeat(64)};
const target={studentName:'Invented Student',date:'2040-01-04',groupId:'3',teacherKey:'99001',studentKey:'77001',courseKey:'5',recordKey:'13',membershipKey:'8'};
const prior={...target,date:'2040-01-02',recordKey:'12'};
const wireDigest='a'.repeat(64);
export const initialFields={progress:'- 기존 진도 문안',homework:'- 기존 숙제 문안',lessonMemo:'기존 안내',attendance:'Y',dailyTestAssessment:'0',previousHomeworkAssessment:'3'};

export function keypair(){
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  return {publicPem:publicKey.export({type:'spki',format:'pem'}) as string,privatePem:privateKey.export({type:'pkcs8',format:'pem'}) as string};
}
export function registry<T extends 'actor'|'issuer'>(kind:T,principals:{id:string;publicPem:string;status?:'active'|'revoked'}[]){
  return {schemaVersion:kind==='actor'?'academy.dailyrecord-actor-registry/1' as const:'academy.dailyrecord-authorization-issuers/1' as const,
    principals:principals.map(p=>({id:p.id,publicKeySpkiPem:p.publicPem,status:p.status??'active'}))};
}
export const policyPins={learningPolicy:{bundleSha256:learningPolicy.bundleSha256,configSha256:learningPolicy.configSha256,catalogSha256:learningPolicy.catalogSha256},
  parentSafeguard:{policySha256:safeguard.policySha256,safeguardSourceSha256:safeguard.safeguardSourceSha256}};
export function workflowContext(fields:Partial<Record<DailyRecordField,string>>):DailyRecordContext{
  return {schemaVersion:'academy.dailyrecord-user-context/1',purpose:'Save one fictional student lesson record.',currentRequestRef:'synthetic-request-1',
    scope:{...nativeScope},selectedFields:Object.keys(fields) as DailyRecordField[],memoAnswer:{kind:'no_addition',requestRef:'synthetic-memo-answer'},
    facts:Object.entries(fields).map(([field,text])=>({ref:'user-fact:'+field,field:field as DailyRecordField,text:text!.replace(/^- /,''),origin:'user_supplied' as const,requiredFragments:[],questionCounts:[],deadlines:[],stageClaims:[]}))};
}
export function proposals(fields:Partial<Record<DailyRecordField,string>>){
  return Object.entries(fields).map(([field,value])=>({field:field as DailyRecordField,value:value!,factRefs:['user-fact:'+field],decision:{kind:'replace' as const,requestRef:'synthetic-request-1'}}));
}
export function authorizationFor(issuerPrivatePem:string,input:{authorizationId?:string;actors:string[];reviewDigests:string[];
  actions:{field:DailyRecordField;before:string;after:string}[];requestRef?:string;now?:number;policy?:DailyRecordAuthorization['reviewPolicy']}){
  const now=input.now??Date.now();
  return signAuthorization(issuerPrivatePem,{schemaVersion:'academy.dailyrecord-save-authorization/1',authorizationId:input.authorizationId??'authz-'+randomUUID(),
    issuerId:'owner-issuer',issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+3600000).toISOString(),
    userEvent:{eventRef:'synthetic-user-event-1',channel:'synthetic-teacher-chat',observedAt:new Date(now-1000).toISOString(),textSha256:textDigest('fictional save instruction')},
    requestRef:input.requestRef??'synthetic-request-1',authorizedActors:input.actors,reviewPolicy:input.policy??policyPins,basedOnReviewDigests:input.reviewDigests,
    actions:input.actions.map(a=>({scope:{...nativeScope},...a})),parentTransmission:'not_authorized'});
}

/**
 * File-backed fictional academy source shared by every process of one test.
 * Only the HTTP source is synthetic: writes go through the real owner
 * journal client (`applyJournalHttpAction`) and the real native backend.
 * Injection marker files in the base directory model transport and
 * readback failures; `events.txt` records metadata only.
 */
export class FileSource {
  constructor(readonly base:string,readonly onWrite:()=>void=()=>{}){if(!existsSync(this.path))this.write(initialFields);}
  get path(){return resolve(this.base,'source.json');}
  #has(name:string){return existsSync(resolve(this.base,name));}
  #event(line:string){writeFileSync(resolve(this.base,'events.txt'),line+'\n',{flag:'a'});}
  read():Record<string,string>{return JSON.parse(readFileSync(this.path,'utf8'));}
  write(fields:Record<string,string>){const temporary=this.path+'.'+randomUUID();writeFileSync(temporary,JSON.stringify(fields));renameSync(temporary,this.path);}
  port(){
    const source=this;let readbackArmed=false;
    const state=()=>{
      if(readbackArmed&&source.#has('inject-readback-failure'))throw Error('synthetic_readback_unavailable');
      if(source.#has('inject-source-read-failure'))throw Error('synthetic_source_unavailable');
      const fields=source.read();
      return {target:{...target},fields,previousRecordKey:'12',previousDate:prior.date,wireDigest};
    };
    const row=(t:typeof target)=>{const fields=source.read();return {...t,fields:{progress:fields.progress,homework:fields.homework,lessonMemo:fields.lessonMemo,attendance:fields.attendance}};};
    return {
      authenticate:async()=>{},
      discoverDayRecordGroups:async()=>({groups:[{groupId:'3'}]}),
      execute:async(input:{date:string})=>({dayRecords:[row(input.date===target.date?target:prior)]}),
      journalState:async()=>state(),
      applyJournalAction:async(action:any,approval:{consumeApproval:(a:any)=>Promise<any>})=>{
        readbackArmed=false;
        return applyJournalHttpAction(action,{consumeApproval:a=>approval.consumeApproval(a),read:async()=>state(),
          write:async a=>{
            source.#event('write:'+a.field);source.onWrite();
            if(source.#has('inject-slow-write'))await new Promise(r=>setTimeout(r,400));
            if(source.#has('inject-lost-write-'+a.field)){source.#event('lost:'+a.field);throw Error('synthetic_transport_reset');}
            const fields=source.read();fields[a.field]=a.after;source.write(fields);
            if(source.#has('inject-crash-after-write'))process.exit(70);
            readbackArmed=true;
            if(source.#has('inject-transport-error-after-write'))throw Error('synthetic_transport_reset_after_write');
          }});
      },
      close:()=>{},
    };
  }
}
export function nativeWorkflowService(base:string,workflow:DailyRecordWorkflow|null,onWrite?:()=>void){
  const source=new FileSource(base,onWrite);
  const backend=new NativeDailyRecordBackend(source.port() as never,admission,()=>({username:'fictional',password:'fictional'}));
  return {source,workflow,service:new DailyRecordService(backend,safeguard,Date.now,learningPolicy,backend,workflow)};
}
export function workflowService(base:string,input:{storeDir:string;actorRegistry:unknown;issuerRegistry:unknown}){
  return nativeWorkflowService(base,createDailyRecordWorkflow({storeDir:input.storeDir,actorRegistry:input.actorRegistry as never,issuerRegistry:input.issuerRegistry as never}));
}
