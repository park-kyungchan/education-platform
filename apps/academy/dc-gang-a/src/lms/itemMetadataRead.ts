export interface ItemMetadataObservation {identity:{sourceNamespace:'academy_item';lectureKey:string;outerLectureKey:string;sourceId:string};sourceUnitName:string;sourcePatternName:string;sourcePlaySeconds:number;sourceDifficulty:number;conceptMapping:'unverified'}
export interface ItemMetadataEnvironment {origin:string;authenticatedTeacherVisible:boolean;fetcher:(url:string,init:RequestInit)=>Promise<Response>}
function key(value:unknown):string {
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)return String(value);
  if(typeof value!=='string'||!/^[1-9][0-9]{0,15}$/.test(value)||BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('invalid_item_key');
  return value;
}
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_item_response');
  const d=Object.getOwnPropertyDescriptors(value);if(Object.values(d).some(v=>!Object.hasOwn(v,'value')))throw Error('accessor_item_response');
  return Object.fromEntries(Object.entries(d).map(([name,v])=>[name,v.value]));
}
/** The current source supplies item metadata, not a student's attempt or mastery. */
export function parseItemMetadata(input:unknown,lectureKey:string):ItemMetadataObservation {
  const expected=key(lectureKey),body=record(input);
  if(body.result!=='OK'||!Array.isArray(body.rows)||body.rows.length!==1)throw Error('ambiguous_item_response');
  const row=record(body.rows[0]),sourceKey=key(row.lecture_key),sourceId=key(row.id);
  if(sourceKey!==expected||sourceId!==expected)throw Error('item_identity_conflict');
  if(typeof row.unit_name!=='string'||typeof row.pat_name!=='string'||typeof row.play_seconds!=='number'||!Number.isFinite(row.play_seconds)||row.play_seconds<0
    ||typeof row.difficulty!=='number'||!Number.isFinite(row.difficulty))throw Error('item_schema_drift');
  return {identity:{sourceNamespace:'academy_item',lectureKey:sourceKey,outerLectureKey:key(row.outer_lecture_key),sourceId},sourceUnitName:row.unit_name,
    sourcePatternName:row.pat_name,sourcePlaySeconds:row.play_seconds,sourceDifficulty:row.difficulty,conceptMapping:'unverified'};
}
export async function readItemMetadata(lectureKey:string,environment:ItemMetadataEnvironment):Promise<ItemMetadataObservation> {
  if(environment.origin!=='https://dc.gang-a.kr'||environment.authenticatedTeacherVisible!==true)throw Error('authentication_required');
  if(typeof lectureKey!=='string')throw Error('invalid_item_request_key');
  const exact=key(lectureKey);const query=new URLSearchParams({p_process:'GetLectureList',lecture_list:exact});
  const response=await environment.fetcher('/servlet/controller.common.TestPageShowExServlet?'+query,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok||response.redirected)throw Error('item_transport_failed');const text=await response.text();
  if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('item_source_contract_refused');
  return parseItemMetadata(JSON.parse(text),exact);
}
