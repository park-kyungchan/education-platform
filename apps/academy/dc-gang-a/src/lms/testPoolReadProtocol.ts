import {assertExactKeys,digest} from '../learning/model';

export interface TestPoolScope {cl1:number;cl2:number;cl3:number;cl4:number}
export function testPoolScope(value:unknown):TestPoolScope {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('test_pool_scope_invalid');
  assertExactKeys(value,['cl1','cl2','cl3','cl4']);
  for(const key of ['cl1','cl2','cl3','cl4'] as const)if(!Number.isSafeInteger((value as TestPoolScope)[key])||(value as TestPoolScope)[key]<0)throw Error('test_pool_scope_invalid');
  const scope=value as TestPoolScope;
  if((!scope.cl1&&(scope.cl2||scope.cl3||scope.cl4))||(!scope.cl2&&(scope.cl3||scope.cl4))||(!scope.cl3&&scope.cl4))throw Error('test_pool_scope_hierarchy_gap');
  return {...scope};
}
export const emptyTestPoolScope:Readonly<TestPoolScope>=Object.freeze({cl1:0,cl2:0,cl3:0,cl4:0});
export function testPoolReadRequest(value:unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('test_pool_read_request_invalid');
  const request=value as Record<string,unknown>;
  if(Object.keys(request).some(key=>!['operation','scope','expectedSelectorSha256',...(request.operation==='questions'?['patNo','page','limit','offset']:[])].includes(key))||typeof request.operation!=='string'||!['categories','labels','questions'].includes(request.operation))throw Error('test_pool_read_request_invalid');
  if(request.expectedSelectorSha256!==undefined&&(typeof request.expectedSelectorSha256!=='string'||!/^[a-f0-9]{64}$/.test(request.expectedSelectorSha256)))throw Error('test_pool_selector_pin_invalid');
  const scope=testPoolScope(request.scope);if(request.operation!=='categories'&&!scope.cl3)throw Error('test_pool_type_scope_requires_source_level3');
  if(request.operation==='questions'&&(typeof request.patNo!=='string'||!/^[1-9][0-9]{0,15}$/.test(request.patNo)||!Number.isSafeInteger(request.page)||(request.page as number)<1||(request.page as number)>100000||!Number.isInteger(request.limit)||(request.limit as number)<1||(request.limit as number)>50))throw Error('test_pool_question_request_invalid');
  if(request.operation==='questions'&&request.offset!==undefined&&(!Number.isInteger(request.offset)||(request.offset as number)<0||(request.offset as number)>49))throw Error('test_pool_question_offset_invalid');
  return {operation:request.operation as 'categories'|'labels'|'questions',scope,expectedSelectorSha256:request.expectedSelectorSha256 as string|undefined,patNo:request.patNo as string,page:request.page as number,limit:request.limit as number,offset:request.offset as number|undefined};
}
function exactText(value:unknown):string {if(typeof value!=='string'||!value.trim()||value.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('test_pool_source_text_invalid');return value;}
function nativeId(value:unknown):string|number {if(typeof value==='string'&&value.length>0&&value.length<256)return value;if(Number.isSafeInteger(value)&&(value as number)>=0)return value as number;throw Error('test_pool_native_id_invalid');}
export function parseTestPoolCategories(value:unknown,parent:TestPoolScope) {
  if(!Array.isArray(value)||value.length>1000)throw Error('test_pool_category_response_invalid');
  const seen=new Set<string>();
  return value.map(row=>{
    const scope=testPoolScope({cl1:row?.cl1,cl2:row?.cl2,cl3:row?.cl3,cl4:row?.cl4});
    for(const key of ['cl1','cl2','cl3','cl4'] as const)if(parent[key]&&scope[key]!==parent[key])throw Error('test_pool_category_scope_conflict');
    const identity=JSON.stringify(scope);if(seen.has(identity))throw Error('duplicate_test_pool_category');seen.add(identity);
    if(Object.values(parent).some(Boolean)&&identity===JSON.stringify(parent))throw Error('test_pool_category_self_parent');
    if(typeof row.isLazy!=='boolean'||typeof row.isFolder!=='boolean')throw Error('test_pool_category_state_invalid');
    return {nativeKey:nativeId(row.key),title:exactText(row.title),scope,isLazy:row.isLazy,isFolder:row.isFolder};
  });
}
/** Qualify the fixed current source URL field set without evaluating its concatenations. */
export function qualifyTestPoolTypeTemplate(html:string) {
  const literal='/servlet/controller.common.TestPageShowExServlet?p_process=GetTypeTotal';
  const start=html.indexOf(literal),end=html.indexOf(';',start);
  if(start<0||end<0||end-start>2000)throw Error('test_pool_type_template_unqualified');
  const source=html.slice(start,end),fields=[...source.matchAll(/[?&]([A-Za-z_]\w*)=/g)].map(match=>match[1]!);
  if(JSON.stringify([...new Set(fields)].sort())!==JSON.stringify(['p_process','category_iden','cl1','cl2','cl3','cl4','make_school_key'].sort()))throw Error('test_pool_type_template_fields_changed');
  return {sourceSha256:digest(source),queryFields:fields};
}
export function parseTestPoolTypeLabels(value:unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value)||(value as any).result!=='OK'||!Array.isArray((value as any).pat_list)||(value as any).pat_list.length>10000)throw Error('test_pool_label_response_invalid');
  const seen=new Set<string>();
  return (value as {pat_list:unknown[]}).pat_list.map(row=>{
    if(!row||typeof row!=='object')throw Error('test_pool_label_row_invalid');const data=row as Record<string,unknown>;
    const id=nativeId(data.pat_no),identity=JSON.stringify([typeof id,id]);if(seen.has(identity))throw Error('duplicate_test_pool_label');seen.add(identity);
    const count=data.cnt;
    if(!(typeof count==='number'&&Number.isSafeInteger(count)&&count>=0)&&!(typeof count==='string'&&/^[0-9]{1,16}$/.test(count)))throw Error('test_pool_label_count_invalid');
    return {nativeId:id,labelExact:exactText(data.pat_name),sourceQuestionCountRaw:count};
  });
}

/** Current checkResultValue contract: exactly framed JSON, never executable source. */
export function extractTestPoolLabelPayload(body:string) {
  const start='##START_DATA##',end='##END_DATA##';
  const from=body.indexOf(start),to=body.indexOf(end);
  if(from<0||to<from+start.length||body.indexOf(start,from+start.length)>=0||body.indexOf(end,to+end.length)>=0)throw Error('test_pool_label_frame_invalid_or_ambiguous');
  const json=body.slice(from+start.length,to);
  let value:unknown;try{value=JSON.parse(json);}catch{throw Error('test_pool_label_payload_invalid_json');}
  return {value,payloadSha256:digest(json)};
}

export function qualifyTestPoolQuestionTemplate(html:string){
  const literal='/servlet/controller.common.TestPageShowExServlet?p_process=GetExamList';
  const start=html.indexOf(literal),end=html.indexOf(';',start);
  if(start<0||end<0||end-start>2000)throw Error('test_pool_question_template_unqualified');
  const source=html.slice(start,end),fields=[...source.matchAll(/[?&]([A-Za-z_]\w*)=/g)].map(match=>match[1]!);
  const expected=['p_process','category_iden','make_school_key','cl1','cl2','cl3','cl4','exam_type','difficulty','pat_no','beh_no'];
  if(JSON.stringify(fields.slice().sort())!==JSON.stringify(expected.sort()))throw Error('test_pool_question_template_fields_changed');
  const grid=/\$\(["']#dbExamListGrid["']\)\.jqGrid\s*\(\s*\{([\s\S]{0,2000}?)jsonReader\s*:\s*\{/.exec(html);
  if(!grid||! /\browNum\s*:\s*50\s*,/.test(grid[1]!))throw Error('test_pool_question_source_page_size_unqualified');
  const defaults:Record<string,string>={};
  for(const name of ['g_examtype_filter','searchConditionDifficulty','searchConditionBehAreaNo']){
    const matches=[...html.matchAll(new RegExp('\\bvar\\s+'+name+'\\s*=\\s*(?:([0-9]+)|"([A-Za-z0-9_-]+)"|\'([A-Za-z0-9_-]+)\')\\s*;','g'))];
    if(matches.length!==1)throw Error('test_pool_question_default_unqualified');
    defaults[name]=matches[0]![1]??matches[0]![2]??matches[0]![3]!;
  }
  return {sourceSha256:digest(source),queryFields:fields,defaults};
}
function pageCount(value:unknown):number {
  const number=typeof value==='string'&&/^[0-9]{1,16}$/.test(value)?Number(value):value;
  if(typeof number!=='number'||!Number.isSafeInteger(number)||number<0)throw Error('test_pool_question_page_count_invalid');return number;
}
export function parseTestPoolQuestions(value:unknown,patNo:string,page:number,limit:number){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('test_pool_question_response_invalid');
  const body=value as Record<string,unknown>;
  if(body.result!==undefined&&body.result!=='OK')throw Error('test_pool_question_response_refused');
  if(!Array.isArray(body.rows)||body.rows.length>limit)throw Error('test_pool_question_rows_invalid');
  const returnedPage=pageCount(body.page),totalPages=pageCount(body.total),records=pageCount(body.records);
  if(returnedPage!==page||records<body.rows.length||(records===0&&(body.rows.length||totalPages))||(records>0&&totalPages!==Math.ceil(records/limit)))throw Error('test_pool_question_pagination_conflict');
  const seen=new Set<string>();
  const questions=body.rows.map((row:unknown)=>{
    if(!row||typeof row!=='object'||Array.isArray(row))throw Error('test_pool_question_row_invalid');const data=row as Record<string,unknown>;
    const lectureKey=String(nativeId(data.lecture_key));
    if(!/^[1-9][0-9]{0,15}$/.test(lectureKey)||seen.has(lectureKey))throw Error('test_pool_question_identity_invalid');seen.add(lectureKey);
    if(String(nativeId(data.pat_no))!==patNo)throw Error('test_pool_question_type_conflict');
    const raw:Record<string,string|number|boolean|null>={};
    for(const key of ['id','outer_lecture_key','difficulty','obj_option','sbj_option','des_option','sel_type','stage_id','examtext_key','answer']){
      const item=data[key];if(item===undefined)continue;
      if(item!==null&&typeof item!=='string'&&typeof item!=='number'&&typeof item!=='boolean')throw Error('test_pool_question_field_invalid');
      if(typeof item==='string'&&item.length>100000||typeof item==='number'&&!Number.isFinite(item))throw Error('test_pool_question_field_invalid');raw[key]=item as string|number|boolean|null;
    }
    return {sourceNamespace:'academy_item' as const,lectureKey,patNo,labelExact:exactText(data.pat_name),unitNameExact:exactText(data.unit_name),sourceFields:raw};
  });
  return {page:returnedPage,totalPages,sourceRecordCount:records,questions};
}
