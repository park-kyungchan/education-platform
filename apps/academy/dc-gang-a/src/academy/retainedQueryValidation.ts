import {retainedQueryLimits as bounds,type RetainedQueryReply} from './contracts/retainedQuery';
/** Browser-safe validation of the complete wire union; errors never echo provider fields. */
export function validateRetainedQueryReply(input:unknown):RetainedQueryReply{
  function need(condition:unknown):asserts condition{if(!condition)throw Error('retained_page_contract_conflict');}
  const object=(value:unknown):Record<string,any>=>{need(value!==null&&typeof value==='object'&&!Array.isArray(value));need(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);need(Object.getOwnPropertySymbols(value).length===0&&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.hasOwn(d,'value')));return value as Record<string,any>;};
  const exact=(value:unknown,names:string[])=>{const row=object(value);need(Object.keys(row).length===names.length&&names.every(name=>Object.hasOwn(row,name)));return row;};
  const array=(value:unknown):any[]=>{need(Array.isArray(value));const list=value as any[];need(Object.getOwnPropertySymbols(list).length===0&&Object.keys(list).length===list.length&&Object.values(Object.getOwnPropertyDescriptors(list)).every(d=>Object.hasOwn(d,'value')));return list;};
  const text=(value:unknown,max:number)=>typeof value==='string'&&value.length>0&&value.length<=max;
  const safe=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
  const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  const date=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  let nodes=0;
  const json=(value:unknown,depth:number):void=>{
    need(depth<=bounds.depth&&++nodes<=bounds.documentRecords);
    if(value===null||typeof value==='string'||typeof value==='boolean')return;
    if(typeof value==='number'){need(Number.isFinite(value));return;}
    if(Array.isArray(value)){for(const child of array(value))json(child,depth+1);return;}
    for(const child of Object.values(object(value)))json(child,depth+1);
  };
  try{
    const value=object(input);need(value.schema==='academy.retained-query.v1');
    if(value.status==='refused'){
      exact(value,['schema','status','code','records','automaticRetry']);need(typeof value.code==='string'&&/^[a-z][a-z0-9_]{0,100}$/.test(value.code));need(array(value.records).length===0&&value.automaticRetry===false);
      need(new TextEncoder().encode(JSON.stringify(value)).byteLength<bounds.minPageBytes);return value as unknown as RetainedQueryReply;
    }
    need(value.status==='page');exact(value,['schema','status','selector','snapshot','facadeSceneRevision','callerBinding','retrievedAt','coverage','omissions','records','page','effects']);
    const selection=object(value.selector),identity=(v:unknown)=>text(v,200)&&typeof v==='string'&&!!v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);
    if(selection.kind==='cohort')exact(selection,['kind']);
    else if(selection.kind==='student'){exact(selection,['kind','studentId','date']);need(identity(selection.studentId)&&date(selection.date));}
    else{need(selection.kind==='class_preparation');exact(selection,Object.hasOwn(selection,'groupId')?['kind','date','groupId']:['kind','date']);need(date(selection.date));if(Object.hasOwn(selection,'groupId'))need(identity(selection.groupId));}
    need(hash(value.snapshot)&&hash(value.callerBinding));need(value.facadeSceneRevision===null||text(value.facadeSceneRevision,bounds.maxPageBytes));
    need(typeof value.retrievedAt==='string'&&value.retrievedAt.length<=64&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.retrievedAt)&&Number.isFinite(Date.parse(value.retrievedAt))&&date(value.retrievedAt.slice(0,10)));
    const coverage=exact(value.coverage,['source','authoritativeCurrentness','completeCurrentRoster','history','clocks','groupFilter','sourceRowCount']);
    need(coverage.source==='canonical_retained_facade'&&coverage.authoritativeCurrentness==='unknown'&&coverage.completeCurrentRoster==='not_established'&&coverage.history==='canonical_projection_inputs_only_not_all_history'&&coverage.clocks==='source_observed_verified_recorded_clocks_retained_in_document_not_refreshed_by_query');
    need(coverage.groupFilter===(selection.kind==='class_preparation'&&selection.groupId!==undefined?'exact_observed_group':'none'));need(coverage.sourceRowCount===null||safe(coverage.sourceRowCount));
    need(array(value.omissions).length<=100&&value.omissions.every((note:unknown)=>text(note,4000)));
    const effects=exact(value.effects,['sourceAcquisition','sourceWrites','parentSends']);need(Object.values(effects).every(flag=>flag===false));
    const page=exact(value.page,['offset','returned','totalRecords','exhausted','nextCursor','maxBytes','serializedBytes']);
    need(safe(page.totalRecords,1,bounds.documentRecords)&&safe(page.offset,0,page.totalRecords-1)&&safe(page.returned,1,bounds.maxPageRecords)&&page.offset+page.returned<=page.totalRecords);
    need(typeof page.exhausted==='boolean'&&page.exhausted===(page.offset+page.returned===page.totalRecords));
    need(page.exhausted?page.nextCursor===null:typeof page.nextCursor==='string'&&page.nextCursor.length<=2048&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(page.nextCursor));
    need(safe(page.maxBytes,bounds.minPageBytes,bounds.maxPageBytes)&&safe(page.serializedBytes,1,page.maxBytes));
    const records=array(value.records);need(records.length===page.returned);
    records.forEach((record,index)=>{
      const row=object(record);need(['object','array','value'].includes(row.kind));exact(row,row.kind==='value'?['ordinal','path','kind','value']:['ordinal','path','kind']);need(safe(row.ordinal)&&row.ordinal===page.offset+index);
      const path=array(row.path);need(path.length<=bounds.depth&&path.every(segment=>typeof segment==='string'||safe(segment)));
      if(row.kind==='value')json(row.value,path.length);
    });
    need(new TextEncoder().encode(JSON.stringify(value)).byteLength===page.serializedBytes);
    return value as unknown as RetainedQueryReply;
  }catch{throw Error('retained_page_contract_conflict');}
}
