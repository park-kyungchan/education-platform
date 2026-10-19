import {parse} from 'acorn';
import {createHash} from 'node:crypto';
import {readTestPoolDocument} from './testPoolInspection';

export const REUSABLE_POOL_SAVE_PATH='/servlet/controller.common.TestpageSelectServlet' as const;
export const REUSABLE_POOL_INDEX_PATH='/servlet/controller.tutor.etest.TestPoolServlet' as const;
const bounds={bytes:2_000_000,scripts:64,nodes:100_000,rows:5000,cellChars:512} as const;
const sha=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const canonicalKey=(value:unknown,max=20):string=>{
 const text=typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
 if(!new RegExp('^[1-9][0-9]{0,'+(max-1)+'}$').test(text))throw Error('reusable_pool_identity_invalid');return text;
};
function exactKeys(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error('reusable_pool_input_invalid');
}
export interface ReusableTestPoolInput {
 schemaVersion:'academy.reusable-test-pool-create/1';title1:string;title2:string;keywordTitle:string;
 rows:readonly {lectureKey:string;outerLectureKey:string;variant:'sbj'|'des'}[];
}
/** Strict24-row metadata only. No creator, owner, arbitrary URL, raw answer or native option inputs. */
export function reusablePoolExpectation(input:unknown){
 exactKeys(input,['schemaVersion','title1','title2','keywordTitle','rows']);
 if(input.schemaVersion!=='academy.reusable-test-pool-create/1'||!Array.isArray(input.rows)||input.rows.length!==24)throw Error('reusable_pool_input_invalid');
 const title=(value:unknown)=>{if(typeof value!=='string'||!value||value.length>128||value!==value.trim()||/[\r\n]/.test(value)||value.includes('|,|')||/^\[/.test(value))throw Error('reusable_pool_title_invalid');return value;};
 const rows=input.rows.map(row=>{exactKeys(row,['lectureKey','outerLectureKey','variant']);
  if(typeof row.lectureKey!=='string'||typeof row.outerLectureKey!=='string'||typeof row.variant!=='string'||!['sbj','des'].includes(row.variant))throw Error('reusable_pool_input_invalid');
  return Object.freeze({lectureKey:canonicalKey(row.lectureKey,9),outerLectureKey:canonicalKey(row.outerLectureKey),variant:row.variant as 'sbj'|'des'});
 });
 if(new Set(rows.map(row=>row.lectureKey)).size!==24)throw Error('reusable_pool_duplicate_question');
 // The original keyword field may be deliberately empty; never default an omitted value.
 const keywordTitle=input.keywordTitle;
 if(typeof keywordTitle!=='string'||keywordTitle.length>128||keywordTitle!==keywordTitle.trim()||/[\r\n]/.test(keywordTitle)||keywordTitle.includes('|,|'))throw Error('reusable_pool_keyword_title_invalid');
 const selected=Object.freeze(rows),title1=title(input.title1),title2=title(input.title2);
 return Object.freeze({title1,title2,keywordTitle,rows:selected,selectionSha256:sha(JSON.stringify(rows))});
}
export type ReusablePoolExpectation=ReturnType<typeof reusablePoolExpectation>;
export function reusableTestPoolRequest(input:unknown){
 const expected=reusablePoolExpectation(input),{rows,title1,title2,keywordTitle}=expected;
 const body=new URLSearchParams({reqCmd:'SaveTestPool',pool_value:[title1,title2,'','',keywordTitle].join('|,|'),
  lecture_list:rows.map(row=>row.lectureKey).join(','),outer_lecture_list:rows.map(row=>row.outerLectureKey).join(','),
  exam_type_list:rows.map(row=>row.variant).join(','),pool_no:'0',is:'true'}).toString();
 return Object.freeze({...expected,method:'POST' as const,path:REUSABLE_POOL_SAVE_PATH,body,bodySha256:sha(body)});
}
export type ReusablePoolRequest=ReturnType<typeof reusableTestPoolRequest>;

type Ast={type:string;start:number;end:number;[key:string]:any};
const isNode=(value:unknown):value is Ast=>!!value&&typeof value==='object'&&typeof(value as Ast).type==='string';
function shape(value:any):any{return Array.isArray(value)?value.map(shape):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','raw'].includes(key)).map(([key,child])=>[key,shape(child)])):value;}
const tabPins=Object.freeze({onSaveETestPoolButtonClick:'ec5c839b354e609744fbd1b9e9417290ce9ab7c649fa32b8e130b69842d8a052',saveTestPool:'5b4032914c91caa212952888329ea418576fc9f054a16e00d76a9a82cdefca4a',getPoolExamList:'67c469a929c1de2a81cc370a971744ec0adbe7b2a5610593c4cc82dce2ada0a0',onGetPoolExamList:'a96e14e690f7fe5ea6e1690ab13fa75947268b6de74fd0e1ca96eef60030d581'});
const mainPins=Object.freeze({popup_etest_pool:'1b725d4157f58ca6d24ddf4ff3f5c26b658c54b6d19a86e824f4905534dfb57c',popup_etest_pool_new:'68603cd2bba5d894bf5e5446b5c481dd43c8e6b29257a5a6530e5fcd86b0a25f'});
type ParseDocument=(text:string,mime:DOMParserSupportedType)=>Document;
function document(html:string,parseDocument:ParseDocument){if(typeof html!=='string'||Buffer.byteLength(html)>bounds.bytes)throw Error('reusable_pool_source_size_limit');return readTestPoolDocument(html,parseDocument);}
/** Observed20261019 function AST pins; no handler evaluation, native trust or runtime authority. */
function qualifyFunctions(doc:Document,pins:Readonly<Record<string,string>>,allowLegacyPopup=false){
 const names=Object.keys(pins),matches=new Map(names.map(name=>[name,[] as {fn:Ast;source:string;scriptIndex:number}[]])),rebindings=new Set<string>();
 const scripts=[...doc.querySelectorAll('script:not([src])')];if(scripts.length>bounds.scripts)throw Error('reusable_pool_script_limit');let count=0;
 for(const [scriptIndex,script]of scripts.entries()){const source=script.textContent??'';if(!names.some(name=>source.includes(name)))continue;
  let tree:Ast;try{tree=parse(source,{ecmaVersion:2022}) as unknown as Ast;}catch{throw Error('reusable_pool_source_unqualified');}
  const pending=[tree];while(pending.length){if(++count>bounds.nodes)throw Error('reusable_pool_ast_limit');const node=pending.pop()!;
   if(node.type==='FunctionDeclaration'&&names.includes(node.id?.name)){if(!tree.body.includes(node))rebindings.add(node.id.name);matches.get(node.id.name)!.push({fn:node,source,scriptIndex});}
   if(node.type==='VariableDeclarator'&&names.includes(node.id?.name))rebindings.add(node.id.name);
   if(node.type==='AssignmentExpression'){const left=node.left,name=left?.type==='Identifier'?left.name:left?.type==='MemberExpression'&&['window','globalThis','self'].includes(left.object?.name)?left.computed?left.property?.value:left.property?.name:null;if(names.includes(name))rebindings.add(name);}
   for(const child of Object.values(node))if(Array.isArray(child)){for(const value of child)if(isNode(value))pending.push(value);}else if(isNode(child))pending.push(child);
  }
 }
 return names.map(name=>{
  const rows=matches.get(name)!.sort((a,b)=>a.scriptIndex-b.scriptIndex||a.fn.start-b.fn.start);
  // The observed Main contains a legacy zero-argument declaration before its five-argument replacement.
  const legacy=allowLegacyPopup&&name==='popup_etest_pool'&&rows.length===2&&rows[0]!.fn.params.length===0&&rows[1]!.fn.params.length===5;
  if(rebindings.has(name)||(!legacy&&rows.length!==1))throw Error('reusable_pool_source_unqualified');
  const selected=legacy?rows[1]!:rows[0]!;if(selected.fn.end-selected.fn.start>20_000)throw Error('reusable_pool_source_unqualified');
  const astSha256=sha(JSON.stringify(shape(selected.fn)));if(astSha256!==pins[name])throw Error('reusable_pool_source_unqualified');
  return {name,astSha256,sourceSha256:sha(selected.source.slice(selected.fn.start,selected.fn.end))};
 });
}
const text=(element:Element)=>element.textContent?.replace(/\s+/g,' ').trim()??'';
export function qualifyReusablePoolTab(html:string,parseDocument:ParseDocument){
 const doc=document(html,parseDocument),buttons=[...doc.querySelectorAll('button')].filter(button=>text(button)==='재사용을 위해 입력된 정보 저장'&&/^\s*(?:javascript:)?onSaveETestPoolButtonClick\(\s*\);?\s*$/.test(button.getAttribute('onclick')??''));
 if(buttons.length!==1)throw Error('reusable_pool_save_button_unqualified');
 for(const name of ['title1','title2','search_word1','search_word2','keyword_title'])if(doc.querySelectorAll('form[name=regist_form] input[name='+name+']').length!==1)throw Error('reusable_pool_form_unqualified');
 return {sourceSha256:sha(html),functions:qualifyFunctions(doc,tabPins),reuseButtonObserved:true as const,sourceHandlersExecuted:false as const};
}
const creatorHeaders=new Set(['제작자','작성자','등록자','제작선생님']);
function headers(doc:Document){
 const result:{tableIndex:number;rowIndex:number;cellCount:number;creatorIndex:number;label:string;questionCountIndex:number|null}[]=[];
 [...doc.querySelectorAll('table')].forEach((table,tableIndex)=>{
  const rows=[...table.querySelectorAll('tr')].filter(row=>row.closest('table')===table);if(rows.length>bounds.rows)throw Error('reusable_pool_main_row_limit');
  rows.forEach((row,rowIndex)=>{const cells=[...row.children].filter(cell=>/^(TH|TD)$/.test(cell.tagName));
   if(cells.some(cell=>(cell.getAttribute('colspan')??'1')!=='1'||(cell.getAttribute('rowspan')??'1')!=='1'))return;
   const indices=cells.flatMap((cell,index)=>creatorHeaders.has(text(cell))?[index]:[]);
   const counts=cells.flatMap((cell,index)=>text(cell)==='문항수'?[index]:[]);
   if(indices.length===1){if(result.length>=64)throw Error('reusable_pool_main_header_limit');result.push({tableIndex,rowIndex,cellCount:cells.length,creatorIndex:indices[0]!,label:text(cells[indices[0]!]!),questionCountIndex:counts.length===1?counts[0]!:null});}
  });
 });return result;
}
export function qualifyReusablePoolMain(html:string,parseDocument:ParseDocument){
 const doc=document(html,parseDocument);return {sourceSha256:sha(html),functions:qualifyFunctions(doc,mainPins,true),creatorHeaderCandidates:headers(doc),sourceHandlersExecuted:false as const};
}
export async function readReusablePoolText(response:Response){
 if(!response.body)throw Error('reusable_pool_body_missing');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>bounds.bytes){void reader.cancel().catch(()=>{});throw Error('reusable_pool_source_size_limit');}chunks.push(part.value);}}
 finally{reader.releaseLock();}return Buffer.concat(chunks).toString('utf8');
}
export function reusablePoolCreatedKey(xml:string,parseDocument:ParseDocument){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>bounds.bytes||/<!DOCTYPE/i.test(xml))throw Error('reusable_pool_save_response_invalid');
 if(/normal_session_error\.jsp|popup_session_error\.jsp|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password/i.test(xml))throw Error('test_pool_authentication_required');
 let doc:Document;try{doc=parseDocument(xml,'application/xml');}catch{throw Error('reusable_pool_save_response_invalid');}
 const nodes=[...doc.querySelectorAll('poolno')];if(doc.querySelector('parsererror')||nodes.length!==1||nodes[0]!.children.length)throw Error('reusable_pool_save_response_invalid');
 return canonicalKey(nodes[0]!.textContent?.trim());
}
export function reusablePoolReadbackKey(value:unknown){return canonicalKey(value);}
export function verifyReusablePoolMembership(raw:string,request:ReusablePoolExpectation){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>bounds.bytes)throw Error('reusable_pool_membership_invalid');
 if(/normal_session_error\.jsp|popup_session_error\.jsp|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password/i.test(raw))throw Error('test_pool_authentication_required');
 let result:any;try{result=JSON.parse(raw);}catch{throw Error('reusable_pool_membership_invalid');}
 if(!result||result.result!=='OK'||!Array.isArray(result.rows)||result.rows.length!==24)throw Error('reusable_pool_membership_invalid');
 const seen=new Set<string>();for(let i=0;i<24;i++){
  const row=result.rows[i],expected=request.rows[i]!;if(!row||typeof row!=='object'||Array.isArray(row))throw Error('reusable_pool_membership_invalid');
  const key=canonicalKey(row.lecture_key,9),outer=canonicalKey(row.outer_lecture_key);
  if(seen.has(key)||key!==expected.lectureKey||outer!==expected.outerLectureKey||row.sel_type!==expected.variant)throw Error('reusable_pool_membership_mismatch');seen.add(key);
 }
 return {sourceSha256:sha(raw),questionCount:24,selectionSha256:request.selectionSha256,identityOrderOuterKeysAndVariantsVerified:true as const,originalRowValuesExported:false as const};
}
function popupArgs(source:string){
 if(source.length>4096)return null;
 let tree:any;try{tree=parse(source.replace(/^\s*javascript:/,''),{ecmaVersion:2022,allowReturnOutsideFunction:true});}catch{return null;}
 const statements=tree.body.filter((node:any)=>node.type!=='EmptyStatement');
 if(statements.length===2&&statements[1].type==='ReturnStatement'&&statements[1].argument?.type==='Literal'&&statements[1].argument.value===false)statements.pop();
 const first=statements[0],call=statements.length===1?(first?.type==='ExpressionStatement'?first.expression:first?.type==='ReturnStatement'?first.argument:null):null;
 if(call?.type!=='CallExpression'||!['popup_etest_pool','popup_etest_pool_new'].includes(call.callee?.name)||call.arguments.length!==5||call.arguments.some((arg:any)=>arg.type!=='Literal'||!['string','number'].includes(typeof arg.value)))return null;
 return call.arguments.map((arg:any)=>String(arg.value)) as string[];
}
/** Only the exact returned pool row is projected. Other paper/student rows never leave this parser. */
export function inspectReusablePoolMainTarget(html:string,poolNo:string,request:ReusablePoolExpectation,expectedCreator:string,parseDocument:ParseDocument){
 canonicalKey(poolNo);const qualification=qualifyReusablePoolMain(html,parseDocument),doc=document(html,parseDocument),matches=new Map<HTMLTableRowElement,string[]>();
 for(const element of [...doc.querySelectorAll('[onclick],a[href^="javascript:"]')]){
  const args=popupArgs(element.getAttribute('onclick')??element.getAttribute('href')??'');if(!args||args[0]!==poolNo)continue;
  const row=element.closest('tr'),cell=element.closest('td,th');
  if(!row||cell?.parentElement!==row||matches.has(row)&&JSON.stringify(matches.get(row))!==JSON.stringify(args))throw Error('reusable_pool_target_row_unqualified');matches.set(row,args);
 }
 if(matches.size!==1)return {sourceSha256:sha(html),targetPresent:false as const,metadataVerified:false as const,reason:'exact_pool_row_missing_or_ambiguous' as const};
 const [row,args]=[...matches][0]!,table=row.closest('table'),tableIndex=[...doc.querySelectorAll('table')].indexOf(table!),cells=[...row.children].filter(cell=>/^(TH|TD)$/.test(cell.tagName));
 if(cells.length>32)throw Error('reusable_pool_target_row_limit');
 const values=cells.map(cell=>{const clone=cell.cloneNode(true) as Element;for(const nested of clone.querySelectorAll('table'))nested.remove();
  const value=text(clone);if(value.length>bounds.cellChars)throw Error('reusable_pool_target_row_limit');return value;});
 const rowIndex=table?[...table.querySelectorAll('tr')].filter(item=>item.closest('table')===table).indexOf(row):-1;
 const candidates=qualification.creatorHeaderCandidates.filter(header=>header.tableIndex===tableIndex&&header.cellCount===cells.length&&header.rowIndex<rowIndex);
 if(table?.closest('tr')&&!candidates.length)return {sourceSha256:sha(html),targetPresent:false as const,metadataVerified:false as const,reason:'target_popup_not_bound_to_list_header' as const};
 const titlesMatch=args[1]===request.title1&&args[2]===request.title2&&args[3]===''&&args[4]==='';
 const creator=candidates.length===1?values[candidates[0]!.creatorIndex]!:null;
 const countIndex=candidates.length===1?candidates[0]!.questionCountIndex:null,questionCountText=countIndex!==null?values[countIndex]!:null;
 const questionCount=questionCountText!==null&&/^(?:0|[1-9][0-9]{0,3})$/.test(questionCountText)?Number(questionCountText):null;
 const questionCountMatchesExpected=questionCount===request.rows.length;
 return {sourceSha256:sha(html),targetPresent:true as const,poolNo,title1:args[1],title2:args[2],searchWordsEmpty:args[3]===''&&args[4]==='',titlesMatch,
  creator,creatorHeaderQualified:candidates.length===1,creatorMatchesExpected:creator===expectedCreator,
  questionCount,questionCountText,questionCountHeaderQualified:countIndex!==null,questionCountMatchesExpected,
  metadataVerified:titlesMatch&&candidates.length===1&&creator===expectedCreator&&questionCountMatchesExpected,
  ...(candidates.length===1?{}:{privateTargetRowProjection:{cells:values,headerCandidates:candidates,meaning:'Only this returned pool row; creator column semantics remain unqualified.'}}),
  unrelatedRowsExported:false as const};
}
export interface ReusablePoolDispatch {
 schemaVersion:'academy.reusable-test-pool-dispatch/1';method:'POST';path:typeof REUSABLE_POOL_SAVE_PATH;bodySha256:string;selectionSha256:string;tabSourceSha256:string;mainSourceSha256:string;automaticRetryAllowed:false;
}
export class ReusableTestPoolCreateFailure extends Error {
 readonly automaticRetryAllowed=false;
 readonly unknownOutcome:boolean;
 readonly remoteOutcome:'unknown_after_dispatch'|'not_dispatched';
 constructor(readonly code:string,readonly phase:string,readonly dispatchAttempted:boolean,readonly poolNo:string|null,readonly metadataReadback?:ReturnType<typeof inspectReusablePoolMainTarget>,readonly membershipVerified=false,readonly httpStatus:number|null=null,readonly saveResponseSha256:string|null=null){
  super('reusable_test_pool_create_failed');this.name='ReusableTestPoolCreateFailure';
  this.unknownOutcome=dispatchAttempted;this.remoteOutcome=dispatchAttempted?'unknown_after_dispatch':'not_dispatched';
 }
}

const usagePins=Object.freeze({showUseLog:'0bd0b730b2309000c62e6dbeab6169bbfa6da48aa5650a7ec90084a823f75d4e',onGetUseLogResult:'a29cf3cb808031afcac7af80015ebcf0fecec972ef8b42ce368a18c8a3700f0e',
 saveUseLog:'059dbebee08ae82aa668657d50ef8d99c7eaa9dd0a9272bec2a2a34844328c46',getTextExamList:'57433ec8de86df297d190e1a8d895c32ba930120d516dde6ebba4c1a29dc9f15'});
export const LECTURE_USAGE_HISTORY_PATH='/servlet/controller.common.TestPageShowExServlet' as const;
export interface LectureUsageInput {schemaVersion:'academy.lecture-use-log/1';lectureKeys:readonly string[];keywordTitle:string;date:string}
function validDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00.000Z');return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
export function lectureUsageDateAt(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function lectureUsageExpectation(input:unknown){
 exactKeys(input,['schemaVersion','lectureKeys','keywordTitle','date']);
 if(input.schemaVersion!=='academy.lecture-use-log/1'||!Array.isArray(input.lectureKeys)||input.lectureKeys.length<1||input.lectureKeys.length>24||
  !validDate(input.date)||typeof input.keywordTitle!=='string'||!input.keywordTitle||input.keywordTitle.length>128||input.keywordTitle!==input.keywordTitle.trim()||/[\r\n]/.test(input.keywordTitle))throw Error('lecture_usage_input_invalid');
 const lectureKeys=input.lectureKeys.map(key=>{if(typeof key!=='string')throw Error('lecture_usage_input_invalid');return canonicalKey(key,9);});
 if(new Set(lectureKeys).size!==lectureKeys.length)throw Error('lecture_usage_duplicate_question');
 const value={schemaVersion:'academy.lecture-use-log/1' as const,lectureKeys:Object.freeze(lectureKeys),keywordTitle:input.keywordTitle,date:input.date};
 return Object.freeze({...value,scopeSha256:sha(JSON.stringify(value))});
}
export type LectureUsageExpectation=ReturnType<typeof lectureUsageExpectation>;
export function lectureUsageRequest(input:unknown){
 const expected=lectureUsageExpectation(input),body=new URLSearchParams({reqCmd:'SaveLectureUseLog',keyword_title:expected.keywordTitle,
  exam_list:expected.lectureKeys.map(key=>'1|,|'+key).join('<BR>')}).toString();
 return Object.freeze({...expected,method:'POST' as const,path:REUSABLE_POOL_SAVE_PATH,body,bodySha256:sha(body)});
}
export function qualifyLectureUsageTab(html:string,parseDocument:ParseDocument){
 const doc=document(html,parseDocument);
 if(doc.querySelectorAll('form[name=regist_form] input[name=keyword_title]').length!==1)throw Error('lecture_usage_form_unqualified');
 return {sourceSha256:sha(html),functions:qualifyFunctions(doc,usagePins),sourceHandlersExecuted:false as const};
}
type UsageRecord={assNo:string|number;title:string;useDate:string};
function recordDate(value:string){
 // GetLectureListLog returned an exact YYYY.MM.DD calendar date on2026-10-19.
 // Accept that observed date-only grammar; do not infer timestamps or a timezone.
 if(/^20[0-9]{2}\.[0-9]{2}\.[0-9]{2}$/.test(value)){
  const date=value.replaceAll('.','-');return validDate(date)?date:null;
 }
 // An explicit accepted grammar, not a claim about unobserved server date formats.
 const match=/^(20[0-9]{2}-[0-9]{2}-[0-9]{2})(?:[ T]([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?)?$/.exec(value);
 if(!match||!validDate(match[1])||match[2]&&Number(match[2])>23||match[3]&&Number(match[3])>59||match[4]&&Number(match[4])>59)return null;
 return match[1]!;
}
/** Decode the original XML/JS-object-fragment as literals only. Never eval or expose other memo records. */
export function inspectLectureUsageHistory(xml:string,lectureKey:string,expected:LectureUsageExpectation,parseDocument:ParseDocument){
 canonicalKey(lectureKey,9);if(!expected.lectureKeys.includes(lectureKey))throw Error('lecture_usage_question_out_of_scope');
 if(typeof xml!=='string'||Buffer.byteLength(xml)>bounds.bytes||/<!DOCTYPE/i.test(xml))throw Error('lecture_usage_response_invalid');
 if(/normal_session_error\.jsp|popup_session_error\.jsp|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password/i.test(xml))throw Error('test_pool_authentication_required');
 let doc:Document;try{doc=parseDocument(xml,'application/xml');}catch{throw Error('lecture_usage_response_invalid');}
 const results=[...doc.querySelectorAll('result')],lists=[...doc.querySelectorAll('lectureList')];
 if(doc.querySelector('parsererror')||results.length!==1||results[0]!.children.length||lists.length!==1||lists[0]!.children.length)throw Error('lecture_usage_response_unqualified');
 // Observed native result_fail plus one exactly empty list is the original UI's no-log branch.
 if(results[0]!.textContent==='result_fail'&&lists[0]!.textContent==='')return {
  lectureKey,sourceSha256:sha(xml),recordCount:0,matched:[] as UsageRecord[],unknownTargetDateCount:0,
  dateFormatCounts:{accepted:0,unqualified:0},sourceResult:'result_fail' as const,
  historyState:'no_history_reported_by_source' as const,unrelatedRecordsExported:false as const,
 };
 if(results[0]!.textContent!=='result_ok')throw Error('lecture_usage_response_unqualified');
 let tree:any;try{tree=parse('['+(lists[0]!.textContent??'')+']',{ecmaVersion:2022});}catch{throw Error('lecture_usage_literal_payload_required');}
 const array=tree.body.length===1&&tree.body[0].type==='ExpressionStatement'?tree.body[0].expression:null;
 if(array?.type!=='ArrayExpression'||array.elements.length>bounds.rows)throw Error('lecture_usage_literal_payload_required');
 const matched:UsageRecord[]=[];let unknownTargetDateCount=0;const dateFormatCounts={accepted:0,unqualified:0};
 for(const node of array.elements){
  if(node?.type!=='ObjectExpression'||node.properties.length>32)throw Error('lecture_usage_literal_payload_required');
  const fields=new Map<string,unknown>();
  for(const property of node.properties){
   const key=property.key?.type==='Identifier'?property.key.name:property.key?.type==='Literal'?property.key.value:null,value=property.value;
   if(property.type!=='Property'||property.computed||property.method||property.shorthand||property.kind!=='init'||typeof key!=='string'||key.length>80||fields.has(key)||
    value?.type!=='Literal'||value.regex||value.bigint||!['string','number','boolean'].includes(typeof value.value)&&value.value!==null||
    typeof value.value==='number'&&!Number.isFinite(value.value)||typeof value.value==='string'&&value.value.length>2048)throw Error('lecture_usage_literal_payload_required');
   fields.set(key,value.value);
  }
  const assNo=fields.get('ass_no'),title=fields.get('title'),useDate=fields.get('use_date');
  if(!(typeof assNo==='string'&&assNo.length<=80||typeof assNo==='number'&&Number.isSafeInteger(assNo))||typeof title!=='string'||title.length>512||typeof useDate!=='string'||useDate.length>80)throw Error('lecture_usage_record_unqualified');
  const date=recordDate(useDate);dateFormatCounts[date?'accepted':'unqualified']++;
  if(title!==expected.keywordTitle)continue;
  if(!date){unknownTargetDateCount++;continue;}
  if(date===expected.date){if(matched.length>=500)throw Error('lecture_usage_match_limit');matched.push({assNo,title,useDate});}
 }
 return {lectureKey,sourceSha256:sha(xml),recordCount:array.elements.length,matched,unknownTargetDateCount,dateFormatCounts,unrelatedRecordsExported:false as const};
}
export type LectureUsageHistory=ReturnType<typeof inspectLectureUsageHistory>;
export interface LectureUsageSnapshot {scopeSha256:string;date:string;histories:LectureUsageHistory[]}
export function verifyLectureUsageDelta(before:LectureUsageSnapshot,after:LectureUsageSnapshot){
 const issues:Array<{lectureKey:string;code:string}>=[],perLecture:Array<{lectureKey:string;beforeCount:number;afterCount:number;addedCount:number;removedCount:number}>=[];
 if(before.scopeSha256!==after.scopeSha256||before.date!==after.date||before.histories.length!==after.histories.length)issues.push({lectureKey:'',code:'lecture_usage_scope_mismatch'});
 for(const snapshot of [before,after])if(!validDate(snapshot.date)||snapshot.histories.length<1||snapshot.histories.length>24||
  new Set(snapshot.histories.map(history=>history.lectureKey)).size!==snapshot.histories.length)issues.push({lectureKey:'',code:'lecture_usage_scope_mismatch'});
 for(let i=0;i<Math.max(before.histories.length,after.histories.length);i++){
  const prior=before.histories[i],next=after.histories[i],lectureKey=prior?.lectureKey??next?.lectureKey??'';
  if(!prior||!next||prior.lectureKey!==next.lectureKey){issues.push({lectureKey,code:'lecture_usage_scope_mismatch'});continue;}
  if(prior.unknownTargetDateCount||next.unknownTargetDateCount)issues.push({lectureKey,code:'lecture_usage_target_date_unqualified'});
  const counts=(records:UsageRecord[])=>{const result=new Map<string,number>();for(const record of records){const key=JSON.stringify([record.assNo,record.title,record.useDate]);result.set(key,(result.get(key)??0)+1);}return result;};
  const oldCounts=counts(prior.matched),newCounts=counts(next.matched);let addedCount=0,removedCount=0;
  for(const key of new Set([...oldCounts.keys(),...newCounts.keys()])){const difference=(newCounts.get(key)??0)-(oldCounts.get(key)??0);addedCount+=Math.max(difference,0);removedCount+=Math.max(-difference,0);}
  perLecture.push({lectureKey,beforeCount:prior.matched.length,afterCount:next.matched.length,addedCount,removedCount});
  if(addedCount!==1||removedCount!==0)issues.push({lectureKey,code:'lecture_usage_expected_single_increment_missing'});
 }
 return {verified:issues.length===0,issues,perLecture,teacherAttribution:'not_returned_by_qualified_history' as const,causalAttribution:'not_independently_proven' as const};
}
export interface LectureUsageDispatch {schemaVersion:'academy.lecture-use-log-dispatch/1';method:'POST';path:typeof REUSABLE_POOL_SAVE_PATH;
 bodySha256:string;scopeSha256:string;tabSourceSha256:string;baselineSha256:string;automaticRetryAllowed:false}
export class LectureUsageWriteFailure extends Error {
 readonly automaticRetryAllowed=false;readonly unknownOutcome:boolean;readonly remoteOutcome:'unknown_after_dispatch'|'not_dispatched';
 constructor(readonly code:string,readonly phase:string,readonly dispatchAttempted:boolean,readonly baseline:LectureUsageSnapshot|null,
  readonly readback:LectureUsageSnapshot|null,readonly saveResponseSha256:string|null){
  super('lecture_usage_write_failed');this.name='LectureUsageWriteFailure';this.unknownOutcome=dispatchAttempted;this.remoteOutcome=dispatchAttempted?'unknown_after_dispatch':'not_dispatched';
 }
}
