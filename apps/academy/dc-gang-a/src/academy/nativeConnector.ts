import { createAcademyReadPlan,readLiteralKey, readLiteralName, type ScopedAcademyReadPlan } from '../lms/academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';
import {assertExactKeys,canonicalJson,assertInstant} from '../learning/model';
import {normalizeCohortDiscovery} from './sourceBridge';
import {runNativeDirectDiscovery,runNativeDirectRead} from './nativeDirectSource';
import {createAcademySourceAudit} from '../lms/academySourceAudit';
import type { SourceDiscoveryRequest } from './nativeBookSource';
import type { Acquisition } from './refresh';

import {academyConnectionStatus,type AcademySourceConnection} from './academyConnectionStatus';
export {academyConnectionStatus,type AcademySourceConnection} from './academyConnectionStatus';

/** Retains the exported seam, not the retired automatic native-browser executor. */
export async function nativeBookAcquirer(input:SourceDiscoveryRequest):Promise<Acquisition>{
  if(!Array.isArray(input.studentNames)||input.studentNames.length<1||input.studentNames.length>64||new Set(input.studentNames).size!==input.studentNames.length)throw Error('invalid_source_scope');
  readLiteralName(input.teacherLabel);readLiteralKey(input.teacherKey);readLiteralKey(input.collegeKey);input.studentNames.forEach(readLiteralName);
  if(process.env.HERMES_HOME!=='/opt/data/profiles/dc-gang-a-dev')throw Error('active_profile_required');
  return {status:'blocked',reason:academyConnectionStatus.acquisition.reason};
}

export interface DirectBookRuntime extends SourceDiscoveryRequest {username:string|null}
export function createNativeDirectReadAcquirer(config:DirectBookRuntime,receiver:(input:{username:string;read:ScopedAcademyReadPlan['request']},signal:AbortSignal)=>Promise<unknown>=(input,signal)=>runNativeDirectRead(input,undefined,signal)){
  const selected=copyDirectRuntime(config),lifetime=new AbortController(),flights=new Set<Promise<unknown>>();
  const acquire=async(input:ScopedAcademyReadPlan['request']):Promise<Acquisition>=>{
    if(lifetime.signal.aborted)return {status:'blocked',reason:'source_runtime_closed'};
    const plan=createAcademyReadPlan(input);
    if(plan.family!=='student_course'&&plan.family!=='day_record'&&plan.family!=='textbook'&&plan.family!=='daily_zero')throw Error('source_area_not_connected');
    const names=plan.family==='day_record'?plan.request.studentNames:plan.family==='daily_zero'?plan.request.targets.map(target=>target.studentName):[plan.request.studentName];
    if(plan.request.teacherLabel!==selected.teacherLabel||names.some(name=>!selected.studentNames.includes(name)))throw Error('source_principal_or_subject_scope_conflict');
    if(!selected.username)return {status:'blocked',reason:'native_http_identifier_required'};
    let value:unknown;
    try{
      const flight=receiver({username:selected.username,read:structuredClone(plan.request)},lifetime.signal);flights.add(flight);
      try{value=await flight;}finally{flights.delete(flight);}
    }catch(error){
      const code=error instanceof Error?error.message:'';
      if(['source_group_termination_failed','source_group_termination_unverified'].includes(code))return {status:'uncertain',reason:code};
      return {status:'blocked',reason:/^[a-z][a-z0-9_]{1,100}$/.test(code)?code:'direct_http_consumer_failed'};
    }
    canonicalJson(value);const result=readInputRecord(value),auth=readInputRecord(result.authentication),source=readInputRecord(result.source);
    assertExactKeys(result,['schemaVersion','observedAt','authentication','source','academyWrites','parentSends']);assertExactKeys(auth,['state','transport','principalKey','collegeKey']);
    if(result.schemaVersion!==1||result.academyWrites!==0||result.parentSends!==0||auth.state!=='authenticated'||auth.transport!=='direct_http_api'||auth.principalKey!==selected.teacherKey||auth.collegeKey!==selected.collegeKey||source.family!==plan.family)throw Error('direct_source_witness_conflict');
    createAcademySourceAudit(source);
    if(source.status!=='observed')return {status:'blocked',reason:'source_area_not_observed'};
    return {status:'observed',data:value};
  };
  return {acquire,close:async()=>{lifetime.abort();await Promise.allSettled([...flights]);}};
}
function copyDirectRuntime(config:DirectBookRuntime){
  readLiteralName(config.teacherLabel);readLiteralKey(config.teacherKey);readLiteralKey(config.collegeKey);
  if(!Array.isArray(config.studentNames)||!config.studentNames.length||config.studentNames.length>64||new Set(config.studentNames).size!==config.studentNames.length)throw Error('invalid_source_scope');
  config.studentNames.forEach(readLiteralName);if(config.username!==null)readLiteralName(config.username);
  return structuredClone(config);
}
/** Availability describes a configured consumer, not authenticated source health or permission. */
export function createNativeDirectBookAcquirer(config:DirectBookRuntime,receiver:(input:{username:string;discover:SourceDiscoveryRequest},signal:AbortSignal)=>Promise<unknown>=(input,signal)=>runNativeDirectDiscovery(input,undefined,signal)){
  const selected=copyDirectRuntime(config);let lastObservedAt:string|null=null;
  const lifetime=new AbortController(),flights=new Set<Promise<unknown>>();
  const connection=():AcademySourceConnection=>({schemaVersion:1,retainedQuery:'available',officialJournalSave:'not_implemented',parentSend:'teacher_owned',acquisition:{transport:'direct_http_api',state:selected.username?'available':'blocked',reason:selected.username?'explicit_scoped_read_only':'native_http_identifier_required',browserFallback:false,scope:'registered_course_book_only',authentication:'fresh_per_explicit_request',lastObservedAt}});
  const acquire=async(input:SourceDiscoveryRequest):Promise<Acquisition>=>{
    if(lifetime.signal.aborted)return {status:'blocked',reason:'source_runtime_closed'};
    canonicalJson(input);assertExactKeys(input,['teacherLabel','teacherKey','collegeKey','studentNames']);
    readLiteralName(input.teacherLabel);readLiteralKey(input.teacherKey);readLiteralKey(input.collegeKey);
    if(input.teacherLabel!==selected.teacherLabel||input.teacherKey!==selected.teacherKey||input.collegeKey!==selected.collegeKey||!Array.isArray(input.studentNames)||!input.studentNames.length||input.studentNames.length>64||new Set(input.studentNames).size!==input.studentNames.length||input.studentNames.some(name=>!selected.studentNames.includes(name)))throw Error('source_principal_or_subject_conflict');
    input.studentNames.forEach(readLiteralName);
    if(!selected.username)return {status:'blocked',reason:'native_http_identifier_required'};
    let value:unknown;
    try{
      const flight=receiver({username:selected.username,discover:structuredClone(input)},lifetime.signal);flights.add(flight);
      try{value=await flight;}finally{flights.delete(flight);}
    }catch(error){
      const code=error instanceof Error?error.message:'';
      if(['source_group_termination_failed','source_group_termination_unverified'].includes(code))return {status:'uncertain',reason:code};
      return {status:'blocked',reason:/^[a-z][a-z0-9_]{1,100}$/.test(code)?code:'direct_http_consumer_failed'};
    }
    canonicalJson(value);const result=readInputRecord(value),auth=readInputRecord(result.authentication),books=readInputRecord(result.books);
    assertExactKeys(result,['schemaVersion','observedAt','authentication','source','books','academyWrites','parentSends']);
    assertExactKeys(auth,['state','transport','principalKey','collegeKey']);
    if(result.schemaVersion!==1||result.source!==null||result.academyWrites!==0||result.parentSends!==0||auth.state!=='authenticated'||auth.transport!=='direct_http_api'||auth.principalKey!==selected.teacherKey||auth.collegeKey!==selected.collegeKey||books.source!=='direct_http_api'||books.teacherLabel!==selected.teacherLabel||books.principalKey!==selected.teacherKey||books.collegeKey!==selected.collegeKey)throw Error('direct_source_witness_conflict');
    normalizeCohortDiscovery(books,input.studentNames);
    if(typeof result.observedAt!=='string'||typeof books.observedAt!=='string')throw Error('source_clock_required');
    assertInstant(result.observedAt);assertInstant(books.observedAt);lastObservedAt=books.observedAt;
    return {status:'observed',data:structuredClone(books)};
  };
  const close=async()=>{lifetime.abort();await Promise.allSettled([...flights]);};
  return {acquire,connection,close};
}
