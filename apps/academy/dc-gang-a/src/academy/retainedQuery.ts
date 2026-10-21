import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {canonicalJson,digest} from '../learning/model';
import {readInputRecord} from '../contracts/readInputRecord';
import {assertPreparationDate} from './preparationHistory';
import {assertTeacherScope} from './usecases/requestRecovery';
import {validateRetainedQueryReply} from './retainedQueryValidation';
import type {TeacherApplication} from './application';
import type {TrustedTeacherContext} from './contracts/teacherOperations';
import {retainedQueryLimits as bounds,type RetainedSelector,type RetainedQueryRequest,type RetainedQueryReply,type RetainedQueryPage,type RetainedFragment,type QueryJson,type RetainedPath} from './contracts/retainedQuery';
type Facade=Pick<TeacherApplication,'ownerId'|'student'|'cohort'|'classPreparation'>;
const refusal=(code:string):RetainedQueryReply=>({schema:'academy.retained-query.v1',status:'refused',code,records:[],automaticRetry:false});
function keys(row:Record<string,unknown>,allowed:string[],required:string[]){if(Object.keys(row).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(row,k)))throw Error('retained_query_input_invalid');}
function text(value:unknown){if(typeof value!=='string'||!value.trim()||value.length>200||/[\u0000-\u001f\u007f]/.test(value))throw Error('retained_query_input_invalid');return value;}
function request(input:unknown):Required<RetainedQueryRequest>{
  const row=readInputRecord(input);keys(row,['selector','cursor','limit','maxBytes'],['selector']);
  const selection=readInputRecord(row.selector);let selector:RetainedSelector;
  if(selection.kind==='cohort'){keys(selection,['kind'],['kind']);selector={kind:'cohort'};}
  else if(selection.kind==='student'){keys(selection,['kind','studentId','date'],['kind','studentId','date']);const date=text(selection.date);assertPreparationDate(date);selector={kind:'student',studentId:text(selection.studentId),date};}
  else if(selection.kind==='class_preparation'){keys(selection,['kind','date','groupId'],['kind','date']);const date=text(selection.date);assertPreparationDate(date);selector={kind:'class_preparation',date,...(Object.hasOwn(selection,'groupId')?{groupId:text(selection.groupId)}:{})};}
  else throw Error('retained_query_input_invalid');
  const limit=row.limit??bounds.pageRecords,maxBytes=row.maxBytes??bounds.pageBytes,cursor=row.cursor??null;
  if(!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>bounds.maxPageRecords||!Number.isSafeInteger(maxBytes)||Number(maxBytes)<bounds.minPageBytes||Number(maxBytes)>bounds.maxPageBytes||cursor!==null&&(typeof cursor!=='string'||cursor.length>2048))throw Error('retained_query_input_invalid');
  return {selector,limit:Number(limit),maxBytes:Number(maxBytes),cursor:cursor as string|null};
}
/** One facade load per page, no data/session cache. Cursors cease working after process recreation. */
export function createRetainedQueryReader(facade:Facade,options:{cursorKey?:Uint8Array;now?:()=>string}={}){
  const key=Buffer.from(options.cursorKey??randomBytes(32));if(key.length!==32)throw Error('retained_cursor_key_invalid');
  const now=options.now??(()=>new Date().toISOString());
  const sign=(body:string)=>createHmac('sha256',key).update(body).digest('base64url');
  const cursorFor=(binding:string,snapshot:string,offset:number)=>{const body=Buffer.from(JSON.stringify({version:1,binding,snapshot,offset})).toString('base64url');return body+'.'+sign(body);};
  function cursorValue(token:string,binding:string):{snapshot:string;offset:number}{
    try{
      if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error();
      const [body,signature]=token.split('.'),given=Buffer.from(signature!,'base64url'),expected=Buffer.from(sign(body!),'base64url');
      if(given.toString('base64url')!==signature||given.length!==expected.length||!timingSafeEqual(given,expected))throw Error();
      const bytes=Buffer.from(body!,'base64url');if(bytes.toString('base64url')!==body)throw Error();
      const row=readInputRecord(JSON.parse(bytes.toString('utf8')));keys(row,['version','binding','snapshot','offset'],['version','binding','snapshot','offset']);
      if(row.version!==1||row.binding!==binding||typeof row.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(row.snapshot)||!Number.isSafeInteger(row.offset)||Number(row.offset)<1)throw Error();
      return {snapshot:row.snapshot,offset:Number(row.offset)};
    }catch{throw Error('retained_cursor_scope_conflict');}
  }
  return {async page(context:TrustedTeacherContext,input:unknown):Promise<RetainedQueryReply>{
    // Snapshot caller-owned objects synchronously, before the facade can yield.
    let selected:Required<RetainedQueryRequest>,actor:TrustedTeacherContext,binding:string,prior:{snapshot:string;offset:number}|null;
    try{
      actor=JSON.parse(canonicalJson(context));assertTeacherScope(facade.ownerId,actor);
      selected=request(input);binding=digest({actor,selector:selected.selector,limit:selected.limit,maxBytes:selected.maxBytes});
      prior=selected.cursor?cursorValue(selected.cursor,binding):null;
    }catch(error){return refusal(error instanceof Error&&['owner_scope_conflict','retained_cursor_scope_conflict'].includes(error.message)?error.message:'retained_query_input_invalid');}
    try{
      const selector=selected.selector;
      let result:unknown,sourceRowCount:number|null=null;
      if(selector.kind==='student')result=await facade.student(actor,selector.studentId,selector.date);
      else if(selector.kind==='cohort'){result=await facade.cohort(actor);sourceRowCount=(result as {rowCount:number}).rowCount;}
      else{
        const source=await facade.classPreparation(actor,selector.date);sourceRowCount=source.rowCount;
        const rows=selector.groupId===undefined?source.rows:source.rows.filter(row=>row.occurrence.groupId===selector.groupId);
        result={...source,rows,rowCount:rows.length};
      }
      const document=canonicalJson(result);
      if(Buffer.byteLength(document)>bounds.documentBytes)return refusal('retained_document_scope_too_large');
      const snapshot=digest(JSON.parse(document));
      if(prior&&prior.snapshot!==snapshot)return refusal('retained_snapshot_conflict');
      const data=JSON.parse(document) as QueryJson;
      const records:RetainedFragment[]=[];
      const visit=(value:QueryJson,path:RetainedPath)=>{
        if(path.length>bounds.depth||records.length>=bounds.documentRecords)throw Error('retained_document_scope_too_large');
        if(value===null||typeof value!=='object'||Buffer.byteLength(JSON.stringify(value))<=Math.min(4096,Math.max(1,selected.maxBytes-2048))){records.push({ordinal:records.length,path,kind:'value',value});return;}
        records.push({ordinal:records.length,path,kind:Array.isArray(value)?'array':'object'});
        if(Array.isArray(value))value.forEach((child,index)=>visit(child,[...path,index]));else for(const field of Object.keys(value).sort())visit(value[field]!,[...path,field]);
      };
      visit(data,[]);
      const offset=prior?.offset??0;if(offset>=records.length)return refusal('retained_cursor_scope_conflict');
      const resultObject=data as Record<string,QueryJson>;
      const base:RetainedQueryPage={schema:'academy.retained-query.v1',status:'page',selector,snapshot,facadeSceneRevision:typeof resultObject.sceneRevision==='string'?resultObject.sceneRevision:null,callerBinding:binding,retrievedAt:now(),
        coverage:{source:'canonical_retained_facade',authoritativeCurrentness:'unknown',completeCurrentRoster:'not_established',history:'canonical_projection_inputs_only_not_all_history',clocks:'source_observed_verified_recorded_clocks_retained_in_document_not_refreshed_by_query',groupFilter:selector.kind==='class_preparation'&&selector.groupId!==undefined?'exact_observed_group':'none',sourceRowCount},
        omissions:['No native source acquisition or complete historical record scan.','Unloaded families, complete current schedule and authoritative currentness remain unknown.'],records:[],
        page:{offset,returned:0,totalRecords:records.length,exhausted:false,nextCursor:null,maxBytes:selected.maxBytes,serializedBytes:0},effects:{sourceAcquisition:false,sourceWrites:false,parentSends:false}};
      const measure=()=>{let bytes=Buffer.byteLength(JSON.stringify(base));while(bytes!==base.page.serializedBytes){base.page.serializedBytes=bytes;bytes=Buffer.byteLength(JSON.stringify(base));}return bytes;};
      // Reserve the actual signed continuation and every fixed field before adding records.
      base.page.nextCursor=cursorFor(binding,snapshot,Math.max(1,offset+1));
      if(measure()>selected.maxBytes)return refusal('retained_fixed_metadata_exceeds_json_page_budget');
      for(let index=offset;index<records.length&&base.records.length<selected.limit;index++){
        base.records.push(records[index]!);const next=index+1;
        base.page.returned=base.records.length;base.page.exhausted=next===records.length;base.page.nextCursor=base.page.exhausted?null:cursorFor(binding,snapshot,next);
        if(measure()>selected.maxBytes){base.records.pop();break;}
      }
      if(!base.records.length)return refusal('retained_record_exceeds_json_page_budget');
      const next=offset+base.records.length;base.page.returned=base.records.length;base.page.exhausted=next===records.length;base.page.nextCursor=base.page.exhausted?null:cursorFor(binding,snapshot,next);
      if(measure()>selected.maxBytes)return refusal('retained_fixed_metadata_exceeds_json_page_budget');
      validateRetainedQueryReply(base);return base;
    }catch(error){return refusal(error instanceof Error&&error.message==='retained_document_scope_too_large'?error.message:'retained_query_unavailable');}
  }};
}
