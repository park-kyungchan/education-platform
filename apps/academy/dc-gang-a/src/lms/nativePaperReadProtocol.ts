import {parse} from 'acorn';
import {createHash} from 'node:crypto';
import {digest} from '../learning/model';
import {readTestPoolDocument} from './testPoolInspection';

export const NATIVE_PAPER_INPUT_PATH='/common/testpage/testpage_lecture_input_hwp.jsp' as const;
export const NATIVE_PAPER_OPTIONS_PATH='/servlet/controller.common.TestpageSelectExServlet' as const;
export const NATIVE_PAPER_OPTIONS_QUERY=Object.freeze({p_process:'getTestOption',stage_id:'',ass_type:''});
export const NATIVE_PAPER_SELECTED_PATH='/servlet/controller.common.TestPageShowExServlet' as const;
export const NATIVE_PAPER_SELECTED_FIELDS=['id','use_log','difficulty','obj_option','sbj_option','des_option','sel_type','lecture_key','outer_lecture_key','answer','unit_name','pat_no','pat_name','stage_id','examtext_key','text_height','exam_size_list','play_seconds'] as const;
const limit=Object.freeze({sourceBytes:2_000_000,scripts:64,astNodes:100_000,functionBytes:20_000,groups:64,options:500,fields:64,resultBytes:262_144});
type Node={type:string;start:number;end:number;[key:string]:unknown};
const node=(value:unknown):value is Node=>!!value&&typeof value==='object'&&typeof(value as Node).type==='string';
function walk(root:Node,visit:(value:Node)=>void){
 const pending=[root];let count=0;
 while(pending.length){if(++count>limit.astNodes)throw Error('native_paper_source_ast_limit');const current=pending.pop()!;visit(current);
  for(const value of Object.values(current))if(Array.isArray(value)){for(const item of value)if(node(item))pending.push(item);}else if(node(value))pending.push(value);
 }
}
function properties(value:unknown):Map<string,Node>{
 if(!node(value)||value.type!=='ObjectExpression'||!Array.isArray(value.properties))throw Error('native_paper_options_template_unqualified');
 const rows=new Map<string,Node>();
 for(const entry of value.properties){
  if(!node(entry)||entry.type!=='Property'||entry.computed||entry.method||entry.kind!=='init'||!node(entry.key)||!node(entry.value))throw Error('native_paper_options_template_unqualified');
  const key=entry.key.type==='Identifier'?entry.key.name:entry.key.type==='Literal'?entry.key.value:null;
  if(typeof key!=='string'||rows.has(key))throw Error('native_paper_options_template_unqualified');rows.set(key,entry.value);
 }
 return rows;
}
const literal=(value:unknown)=>node(value)&&value.type==='Literal'?value.value:undefined;
function exactNames(map:Map<string,Node>,names:readonly string[]){if(map.size!==names.length||names.some(name=>!map.has(name)))throw Error('native_paper_options_template_unqualified');}

/** Fixed input-document read only. Source query values are never copied into a request. */
export function qualifyNativePaperInputReference(tab:{sourcePathCandidates:{path:string;sameOrigin:boolean}[];sourceSha256:string}){
 if(!tab.sourcePathCandidates.some(row=>row.sameOrigin&&row.path===NATIVE_PAPER_INPUT_PATH))throw Error('native_paper_input_reference_unqualified');
 return {path:NATIVE_PAPER_INPUT_PATH,method:'GET' as const,tabSourceSha256:tab.sourceSha256,queryValuesCopied:false as const};
}

/** Qualify the observed two-statement loadPaperOptions source without running its callbacks. */
export function qualifyNativePaperOptionsTemplate(html:string,parseDocument:(text:string,mime:DOMParserSupportedType)=>Document){
 const doc=readTestPoolDocument(html,parseDocument),scripts=[...doc.querySelectorAll('script:not([src])')];
 if(scripts.length>limit.scripts)throw Error('native_paper_source_script_limit');
 const matches:{functionNode:Node;source:string;offset:number}[]=[];let bindings=0;
 for(const script of scripts){
  const source=script.textContent??'';if(Buffer.byteLength(source)>limit.sourceBytes)throw Error('native_paper_source_size_limit');
  if(!source.includes('loadPaperOptions'))continue;
  let tree:Node;try{tree=parse(source,{ecmaVersion:2022}) as unknown as Node;}catch{throw Error('native_paper_options_function_unqualified');}
  walk(tree,value=>{
   if(value.type==='VariableDeclarator'&&node(value.id)&&value.id.type==='Identifier'&&value.id.name==='loadPaperOptions'){bindings++;if(node(value.init)&&value.init.type==='FunctionExpression')matches.push({functionNode:value.init,source,offset:value.start});}
   if(value.type==='FunctionDeclaration'&&node(value.id)&&value.id.name==='loadPaperOptions'){bindings++;matches.push({functionNode:value,source,offset:value.start});}
   if(value.type==='AssignmentExpression'&&node(value.left)&&value.left.type==='Identifier'&&value.left.name==='loadPaperOptions')bindings++;
  });
 }
 if(matches.length!==1||bindings!==1)throw Error('native_paper_options_function_unqualified');
 const {functionNode:fn,source,offset}=matches[0]!;
 if(fn.end-fn.start>limit.functionBytes||!Array.isArray(fn.params)||fn.params.length||!node(fn.body)||!Array.isArray(fn.body.body)||fn.body.body.length!==2)throw Error('native_paper_options_template_unqualified');
 const [declaration,statement]=fn.body.body;
 if(!node(declaration)||declaration.type!=='VariableDeclaration'||!Array.isArray(declaration.declarations)||declaration.declarations.length!==1)throw Error('native_paper_options_template_unqualified');
 const parameter=declaration.declarations[0];
 if(!node(parameter)||!node(parameter.id)||parameter.id.type!=='Identifier')throw Error('native_paper_options_template_unqualified');
 const fields=properties(parameter.init);exactNames(fields,['p_process','stage_id','ass_type']);
 for(const [key,value] of Object.entries(NATIVE_PAPER_OPTIONS_QUERY))if(literal(fields.get(key))!==value)throw Error('native_paper_options_template_unqualified');
 if(!node(statement)||statement.type!=='ExpressionStatement'||!node(statement.expression)||statement.expression.type!=='CallExpression')throw Error('native_paper_options_template_unqualified');
 const call=statement.expression,callee=call.callee;
 if(!node(callee)||callee.type!=='MemberExpression'||callee.computed||!node(callee.object)||callee.object.type!=='Identifier'||callee.object.name!=='$'||!node(callee.property)||callee.property.type!=='Identifier'||callee.property.name!=='ajax'||!Array.isArray(call.arguments)||call.arguments.length!==1)throw Error('native_paper_options_template_unqualified');
 const config=properties(call.arguments[0]);exactNames(config,['type','url','data','success','error']);
 if(literal(config.get('type'))!=='GET'||literal(config.get('url'))!==NATIVE_PAPER_OPTIONS_PATH||config.get('data')?.type!=='Identifier'||config.get('data')?.name!==parameter.id.name
  ||config.get('success')?.type!=='FunctionExpression'||config.get('error')?.type!=='FunctionExpression')throw Error('native_paper_options_template_unqualified');
 return {path:NATIVE_PAPER_OPTIONS_PATH,method:'GET' as const,query:NATIVE_PAPER_OPTIONS_QUERY,tabSourceSha256:digest(html),
  functionName:'loadPaperOptions' as const,functionSourceSha256:digest(source.slice(fn.start,fn.end)),functionRange:{start:fn.start,end:fn.end},
  rangeUnit:'utf16_code_units_within_inline_script' as const,declarationStart:offset,sourceHandlersExecuted:false as const};
}

function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
const safeKey=(value:string)=>/^[A-Za-z0-9_-]{1,64}$/.test(value)&&!/password|secret|token|cookie|credential|authorization|session/i.test(value);
const valueKind=(value:unknown)=>value===null?'null':Array.isArray(value)?'array':typeof value;

/** Observe the stage/assessment option arrays. Non-option scalar values and account keys are not exported. */
export function inspectNativePaperOptionsResponse(text:string){
 if(typeof text!=='string'||Buffer.byteLength(text)>limit.sourceBytes)throw Error('native_paper_options_response_limit');
 if(/normal_session_error\.jsp|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password/i.test(text))throw Error('test_pool_authentication_required');
 let value:unknown;try{value=JSON.parse(text);}catch{throw Error('native_paper_options_response_invalid');}
 if(!object(value)||value.result!=='ok')throw Error('native_paper_options_result_unqualified');
 const groups:{stageId:string;assessmentType:string;options:{optionType:string|number|null;fields:{name:string;valueKind:string}[];omittedFieldCount:number}[]}[]=[];
 let optionCount=0,unclassifiedTopLevelFields=0;
 for(const [stageId,stages] of Object.entries(value)){
  if(stageId==='result'||stageId==='message')continue;
  if(!safeKey(stageId)||!object(stages)){unclassifiedTopLevelFields++;continue;}
  for(const [assessmentType,options] of Object.entries(stages)){
   if(!safeKey(assessmentType)||!Array.isArray(options)){unclassifiedTopLevelFields++;continue;}
   if(groups.length>=limit.groups||optionCount+options.length>limit.options)throw Error('native_paper_options_collection_limit');
   const rows=options.map(raw=>{
    if(!object(raw)||Object.keys(raw).length>limit.fields)throw Error('native_paper_options_row_unqualified');
    const entries=Object.entries(raw),fields=entries.filter(([key])=>safeKey(key)).map(([name,value])=>({name,valueKind:valueKind(value)}));
    const type=raw.option_type,optionType=typeof type==='string'&&safeKey(type)?type:typeof type==='number'&&Number.isSafeInteger(type)&&type>=0?type:null;
    return {optionType,fields,omittedFieldCount:entries.length-fields.length};
   });
   optionCount+=rows.length;groups.push({stageId,assessmentType,options:rows});
  }
 }
 const result={schemaVersion:1,kind:'inert_native_paper_options_metadata' as const,sourceSha256:digest(text),resultRaw:'ok' as const,groups,optionCount,unclassifiedTopLevelFields,
  optionSettingValuesExported:false as const,optionTypeIdsExported:true as const,accountValuesExported:false as const,sourceHandlersExecuted:false as const,academyWrites:0 as const,
  unknowns:['stage_assessment_and_option_type_meanings_not_inferred','selected_question_row_query_contract_not_qualified','no_setter_or_generation_contract_invoked',...(groups.length?[]:['no_stage_assessment_option_arrays_observed'])]};
 if(Buffer.byteLength(JSON.stringify(result))>limit.resultBytes)throw Error('native_paper_options_result_limit');return result;
}

// Narrow syntax pins from the observed native-input20261019 request, validation and callback.
// Positions/raw literal spellings are removed; comments/whitespace do not change the AST pin.
// This is inert source qualification, never native trust, handler execution or runtime admission.
const selectedFunctionPins={
 checkValidate:'8d38162b3ebdbaadcfff924b85ae9c3c4db44f23a1456579c047540e03406a4a',
 lecture_info:'b5a506c0f36758881fc5d1095853f19d5e92d2786c727c82db9e809ed87fce71',
 onResultGetExamList:'d640f5ac40a16157a22e5f64453194bb5e947e5cb93c00ea46a3125c52f38e71',
} as const;
const rawSelectedSha256=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
function astShape(value:unknown):unknown{
 if(Array.isArray(value))return value.map(astShape);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','raw'].includes(key)).map(([key,child])=>[key,astShape(child)]));
 return value;
}
export function readNativePaperLectureKeys(input:readonly string[]):readonly string[]{
 if(!Array.isArray(input)||input.length<1||input.length>24||input.some(key=>typeof key!=='string'||!/^[1-9][0-9]{0,8}$/.test(key))||new Set(input).size!==input.length)throw Error('native_paper_selected_scope_invalid');
 return Object.freeze([...input]);
}
/** Qualify only the observed input request and result callback; no source function is called. */
export function qualifyNativePaperSelectedQuestionsTemplate(html:string,parseDocument:(text:string,mime:DOMParserSupportedType)=>Document){
 const doc=readTestPoolDocument(html,parseDocument),scripts=[...doc.querySelectorAll('script:not([src])')];
 if(scripts.length>limit.scripts)throw Error('native_paper_source_script_limit');
 const names=Object.keys(selectedFunctionPins),matches=new Map<string,{fn:Node;source:string}[]>(),bindings=new Map(names.map(name=>[name,0]));
 for(const script of scripts){
  const source=script.textContent??'';if(!names.some(name=>source.includes(name)))continue;
  let tree:Node;try{tree=parse(source,{ecmaVersion:2022}) as unknown as Node;}catch{throw Error('native_paper_selected_template_unqualified');}
  walk(tree,value=>{
   if(value.type==='FunctionDeclaration'&&node(value.id)&&typeof value.id.name==='string'&&names.includes(value.id.name)){
    const name=value.id.name;bindings.set(name,bindings.get(name)!+1);matches.set(name,[...(matches.get(name)??[]),{fn:value,source}]);
   }
   if(value.type==='VariableDeclarator'&&node(value.id)&&typeof value.id.name==='string'&&names.includes(value.id.name))bindings.set(value.id.name,bindings.get(value.id.name)!+1);
   if(value.type==='AssignmentExpression'&&node(value.left)){
    const left=value.left,name=left.type==='Identifier'?left.name:left.type==='MemberExpression'&&node(left.object)&&['window','globalThis','self'].includes(String(left.object.name))&&node(left.property)?left.computed?literal(left.property):left.property.name:null;
    if(typeof name==='string'&&names.includes(name))bindings.set(name,bindings.get(name)!+1);
   }
  });
 }
 const functions=names.map(name=>{
  const rows=matches.get(name)??[];if(rows.length!==1||bindings.get(name)!==1)throw Error('native_paper_selected_template_unqualified');
  const {fn,source}=rows[0]!;if(fn.end-fn.start>limit.functionBytes)throw Error('native_paper_selected_template_unqualified');
  const astSha256=rawSelectedSha256(JSON.stringify(astShape(fn)));
  if(astSha256!==selectedFunctionPins[name as keyof typeof selectedFunctionPins])throw Error('native_paper_selected_template_unqualified');
  return {name,sourceSha256:rawSelectedSha256(source.slice(fn.start,fn.end)),astSha256,range:{start:fn.start,end:fn.end}};
 });
 return {path:NATIVE_PAPER_SELECTED_PATH,method:'GET' as const,p_process:'GetLectureList' as const,
  queryFields:['p_process','lecture_list','uniq'] as const,inputSourceSha256:rawSelectedSha256(html),inputCanonicalJsonStringSha256:digest(html),functions,
  sourceDigestMeaning:'raw_utf8_sha256' as const,astDigestMeaning:'normalized_ast_json_utf8_sha256' as const,
  rangeUnit:'utf16_code_units_within_inline_script' as const,sourceHandlersExecuted:false as const,
  contract:'source_pinned_inert_lecture_info_and_result_OK_rows' as const};
}
export function nativePaperSelectedQuestionQuery(input:readonly string[],uniq:number){
 const lectureKeys=readNativePaperLectureKeys(input);
 if(!Number.isSafeInteger(uniq)||uniq<0)throw Error('native_paper_selected_timestamp_invalid');
 // The original IFRAME GET concatenates canonical digits/commas directly; no caller URL is accepted.
 const query='p_process=GetLectureList&lecture_list='+lectureKeys.join(',')+'&uniq='+uniq;
 return {path:NATIVE_PAPER_SELECTED_PATH,method:'GET' as const,query,querySha256:rawSelectedSha256(query),lectureKeys,uniq};
}
type SourceJson=null|boolean|number|string|SourceJson[]|{[key:string]:SourceJson};
function assertSelectedJson(value:unknown,depth=0,budget={nodes:0}):asserts value is SourceJson{
 if(++budget.nodes>50_000||depth>12)throw Error('native_paper_selected_value_limit');
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='string'){if(value.length>250_000)throw Error('native_paper_selected_value_limit');return;}
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('native_paper_selected_value_unqualified');return;}
 if(Array.isArray(value)){for(const child of value)assertSelectedJson(child,depth+1,budget);return;}
 if(object(value)){for(const [key,child] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('native_paper_selected_value_unqualified');assertSelectedJson(child,depth+1,budget);}return;}
 throw Error('native_paper_selected_value_unqualified');
}
/** Original18-field projection only. UI-assigned id/use_log and variants are never synthesized. */
export function inspectNativePaperSelectedQuestionsResponse(text:string,input:readonly string[],parseDocument:(text:string,mime:DOMParserSupportedType)=>Document){
 const lectureKeys=readNativePaperLectureKeys(input);
 if(typeof text!=='string'||Buffer.byteLength(text)>limit.sourceBytes)throw Error('native_paper_selected_response_limit');
 if(/normal_session_error\.jsp|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password/i.test(text))throw Error('test_pool_authentication_required');
 let value:unknown,envelope:'raw_json'|'html_body_inner_html'='raw_json';
 try{value=JSON.parse(text);}catch{
  // The observed callback reads IFRAME.document.body.innerHTML. Do not invent script/PRE extraction.
  const doc=readTestPoolDocument(text,parseDocument);
  if(!/<(?:html|body|!doctype)\b/i.test(text)||doc.querySelector('script,iframe,frame,form')||doc.body.children.length)throw Error('native_paper_selected_response_invalid');
  try{value=JSON.parse(doc.body.innerHTML);envelope='html_body_inner_html';}catch{throw Error('native_paper_selected_response_invalid');}
 }
 if(!object(value)||value.result!=='OK'||!Array.isArray(value.rows)||value.rows.length!==lectureKeys.length)throw Error('native_paper_selected_result_unqualified');
 const wanted=new Set(lectureKeys),seen=new Set<string>(),missingFieldCounts=Object.fromEntries(NATIVE_PAPER_SELECTED_FIELDS.map(field=>[field,0]));
 const rowEvidence:{lectureKey:string;sourcePointer:string;presentFields:string[];missingFields:string[];nullFields:string[];omittedOriginalFieldCount:number}[]=[];
 const rows=value.rows.map((raw,index)=>{
  if(!object(raw)||Object.keys(raw).length>128)throw Error('native_paper_selected_row_unqualified');
  const originalKey=raw.lecture_key;
  if(typeof originalKey!=='string'&&!(typeof originalKey==='number'&&Number.isSafeInteger(originalKey)))throw Error('native_paper_selected_identity_unqualified');
  const key=String(originalKey);if(!/^[1-9][0-9]{0,8}$/.test(key)||!wanted.has(key)||seen.has(key))throw Error('native_paper_selected_identity_set_mismatch');seen.add(key);
  const projected:Partial<Record<typeof NATIVE_PAPER_SELECTED_FIELDS[number],SourceJson>>={},presentFields:string[]=[],missingFields:string[]=[],nullFields:string[]=[];
  for(const field of NATIVE_PAPER_SELECTED_FIELDS){
   if(!Object.hasOwn(raw,field)){missingFields.push(field);missingFieldCounts[field]!++;continue;}
   assertSelectedJson(raw[field]);projected[field]=structuredClone(raw[field]);presentFields.push(field);if(raw[field]===null)nullFields.push(field);
  }
  rowEvidence.push({lectureKey:key,sourcePointer:'/rows/'+index,presentFields,missingFields,nullFields,omittedOriginalFieldCount:Object.keys(raw).length-presentFields.length});
  return projected;
 });
 if(seen.size!==wanted.size)throw Error('native_paper_selected_identity_set_mismatch');
 return {schemaVersion:1,kind:'inert_native_selected_question_rows' as const,sourceSha256:rawSelectedSha256(text),sourceCanonicalJsonStringSha256:digest(text),sourceDigestMeaning:'raw_utf8_sha256' as const,responseEnvelope:envelope,resultRaw:'OK' as const,
  requestedLectureKeys:lectureKeys,identityField:'lecture_key' as const,sourceRowOrder:rowEvidence.map(row=>row.lectureKey),sourceOrderPreserved:true as const,
  sourceOrderMatchesRequested:rowEvidence.every((row,index)=>row.lectureKey===lectureKeys[index]),rows,rowEvidence,missingFieldCounts,
  original18FieldValuesPreserved:true as const,unrelatedFieldValuesExported:false as const,nativeGridSerializationApplied:false as const,
  variantOverrideApplied:false as const,sourceHandlersExecuted:false as const,academyWrites:0 as const,
  unknowns:['missing_fields_are_not_defaulted','parent_grid_rowid_and_use_log_transformations_not_applied','raw_answer_not_reinterpreted_for_selected_variant','no_native_generation_or_final_membership_applied']};
}
