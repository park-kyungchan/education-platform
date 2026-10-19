import {parse} from 'acorn';
import {digest} from '../learning/model';
import {readTestPoolDocument} from './testPoolInspection';

export const NATIVE_PAPER_INPUT_PATH='/common/testpage/testpage_lecture_input_hwp.jsp' as const;
export const NATIVE_PAPER_OPTIONS_PATH='/servlet/controller.common.TestpageSelectExServlet' as const;
export const NATIVE_PAPER_OPTIONS_QUERY=Object.freeze({p_process:'getTestOption',stage_id:'',ass_type:''});
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
