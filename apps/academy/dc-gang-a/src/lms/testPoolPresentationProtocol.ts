import {parse,parseExpressionAt} from 'acorn';
import {digest} from '../learning/model';
import {testPoolPreviewSourcePins} from './testPoolQuestionPreview';

export interface TestPoolSourceRange {start:number;end:number}
export interface TestPoolSourceDocument {
  document:Document;
  sourceRange(node:Node):TestPoolSourceRange|null;
}
export type TestPoolSourceDocumentParser=(html:string)=>TestPoolSourceDocument;
type Scalar=string|number|boolean|null;
type Ast={type:string;start:number;end:number;[key:string]:unknown};
type Script={source:'selector'|'helpers';text:string;offset:number;ast:Ast|null};
const limits=Object.freeze({sourceBytes:2_000_000,documentNodes:20_000,scripts:64,astNodes:100_000,
  controls:64,options:100,gridColumns:80,functions:64,functionBytes:32_000,literals:128,text:4096,resultBytes:524_288});
const filterNames=new Set(['g_examtype_filter','searchConditionDifficulty','searchConditionBehAreaNo']);
const previewNames=new Set(['previewDBExam','getExamPath','getExamCardImageFileName']);
const relevantControl=/difficulty|exam[_-]?type|question[_-]?type|sel[_-]?type|response|(?:obj|sbj|des)[_-]?option|난이도|서술형|주관식|객관식/i;

function boundedText(value:string,max:number=limits.text){
  if(value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('test_pool_presentation_text_limit');
  return value;
}
function ast(value:unknown):value is Ast {
  return !!value&&typeof value==='object'&&typeof (value as Ast).type==='string'
    &&Number.isInteger((value as Ast).start)&&Number.isInteger((value as Ast).end);
}
function walk(node:Ast,visit:(node:Ast)=>void){
  const pending=[node];let count=0;
  while(pending.length){
    if(++count>limits.astNodes)throw Error('test_pool_presentation_ast_limit');
    const current=pending.pop()!;visit(current);
    for(const child of Object.values(current)){
      if(Array.isArray(child)){for(const item of child)if(ast(item))pending.push(item);}
      else if(ast(child))pending.push(child);
    }
  }
}
function literal(node:unknown):Scalar|undefined {
  if(!ast(node)||node.type!=='Literal')return undefined;
  const value=node.value;
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
  return typeof value==='string'?boundedText(value):undefined;
}
function reference(node:unknown,depth=0):string|null {
  if(!ast(node)||depth>16)return null;
  if(node.type==='Identifier')return boundedText(String(node.name),256);
  if(node.type==='MemberExpression'){
    const object=reference(node.object,depth+1),property=node.computed?literal(node.property):reference(node.property,depth+1);
    return object&&typeof property==='string'&&/^[A-Za-z_$][\w$]*$/.test(property)?boundedText(object+'.'+property,512):null;
  }
  return null;
}
function property(node:Ast,name:string):unknown {
  if(node.type!=='ObjectExpression'||!Array.isArray(node.properties))return undefined;
  const matches=node.properties.filter((entry:unknown)=>ast(entry)&&entry.type==='Property'
    &&(entry.computed?literal(entry.key):reference(entry.key)??literal(entry.key))===name) as Ast[];
  if(matches.length>1)throw Error('test_pool_presentation_property_ambiguous');
  return matches[0]?.value;
}
function range(node:Ast,script:Script):TestPoolSourceRange {return {start:script.offset+node.start,end:script.offset+node.end};}
function sourceString(value:unknown):string|null {const result=literal(value);return typeof result==='string'?result:null;}
function functionName(node:Ast):string|null {
  if(node.type==='FunctionDeclaration')return reference(node.id);
  if(node.type==='VariableDeclarator'&&ast(node.init)&&['FunctionExpression','ArrowFunctionExpression'].includes(node.init.type))return reference(node.id);
  return null;
}

/** Static observations only: no target code, handlers, network resources or guessed code meanings. */
export function inspectTestPoolPresentationProtocol(selectorHtml:string,helperText:string,parseSourceDocument:TestPoolSourceDocumentParser){
  if(typeof selectorHtml!=='string'||typeof helperText!=='string')throw Error('test_pool_presentation_source_invalid');
  const sourceBytes={selector:Buffer.byteLength(selectorHtml),helpers:Buffer.byteLength(helperText)};
  if(sourceBytes.selector>limits.sourceBytes||sourceBytes.helpers>limits.sourceBytes)throw Error('test_pool_presentation_source_limit');
  const parsed=parseSourceDocument(selectorHtml),doc=parsed.document,unknowns=new Set<string>();
  if(doc.querySelectorAll('*').length>limits.documentNodes)throw Error('test_pool_presentation_document_limit');
  if(doc.querySelector('input[type=password]')||/normal_session_error\.jsp|세션이 만료/.test(selectorHtml))throw Error('test_pool_authentication_required');
  const nodeRange=(node:Node):TestPoolSourceRange=>{
    const value=parsed.sourceRange(node);
    if(!value||!Number.isInteger(value.start)||!Number.isInteger(value.end)||value.start<0||value.end<value.start||value.end>selectorHtml.length)throw Error('test_pool_presentation_source_range_unqualified');
    return value;
  };
  const scripts:Script[]=[];
  const parseScript=(source:Script['source'],text:string,offset:number)=>{
    let tree:Ast|null=null;
    try{tree=parse(text,{ecmaVersion:2022}) as unknown as Ast;}
    catch{unknowns.add(source+'_script_parse_unqualified');}
    scripts.push({source,text,offset,ast:tree});
  };
  for(const script of doc.querySelectorAll('script:not([src])')){
    if(scripts.length>=limits.scripts)throw Error('test_pool_presentation_script_limit');
    const type=script.getAttribute('type')?.toLowerCase();
    if(type&&!['text/javascript','application/javascript'].includes(type)){unknowns.add('nonclassic_selector_script_not_inspected');continue;}
    if(script.firstChild){const location=nodeRange(script.firstChild);parseScript('selector',selectorHtml.slice(location.start,location.end),location.start);}
  }
  parseScript('helpers',helperText,0);

  const controls:{tag:string;id:string|null;name:string|null;type:string|null;labelExact:string|null;valueRaw:string|null;
    sourceRange:TestPoolSourceRange;options:{valueRaw:string|null;labelExact:string;selected:boolean;sourceRange:TestPoolSourceRange}[];handlerReferences:string[]}[]=[];
  const associatedLabels=new Map<string,string[]>();
  for(const label of doc.querySelectorAll('label[for]')){
    const key=label.getAttribute('for')!,values=associatedLabels.get(key)??[];
    values.push(boundedText(label.textContent??''));associatedLabels.set(key,values);
  }
  for(const control of doc.querySelectorAll('select,input[type=radio],input[type=checkbox],button,a')){
    const id=control.getAttribute('id'),name=control.getAttribute('name');
    const handlers=['onchange','onclick','oninput'].flatMap(attribute=>{
      const value=control.getAttribute(attribute);return value?[{attribute,value}]:[];
    });
    const href=control.getAttribute('href');if(href&&/^javascript:/i.test(href))handlers.push({attribute:'href',value:href.slice('javascript:'.length)});
    const labels=id?associatedLabels.get(id)??[]:[];
    const wrapping=control.closest('label');if(!labels.length&&wrapping)labels.push(boundedText(wrapping.textContent??''));
    const ownText=['button','a'].includes(control.tagName.toLowerCase())?control.textContent:null;
    const labelExact=labels.length===1?labels[0]!:ownText;
    if(!relevantControl.test([id,name,labelExact,...handlers.map(row=>row.value)].join(' ')))continue;
    if(controls.length>=limits.controls)throw Error('test_pool_presentation_control_limit');
    if(labels.length>1)unknowns.add('control_multiple_associated_labels');
    const handlerReferences=new Set<string>();
    for(const handler of handlers){
      boundedText(handler.value);
      try{const tree=parse(handler.value,{ecmaVersion:2022,allowReturnOutsideFunction:true}) as unknown as Ast;
        walk(tree,node=>{if(node.type==='CallExpression'){const name=reference(node.callee);if(name)handlerReferences.add(name);}});
      }catch(error){if(error instanceof Error&&error.message.startsWith('test_pool_presentation_'))throw error;unknowns.add('control_handler_parse_unqualified');}
    }
    const options=[...control.querySelectorAll('option')];
    if(options.length>limits.options)throw Error('test_pool_presentation_option_limit');
    const attribute=(element:Element,key:string)=>{const value=element.getAttribute(key);return value===null?null:boundedText(value);};
    controls.push({tag:control.tagName.toLowerCase(),id:id===null?null:boundedText(id),name:name===null?null:boundedText(name),
      type:attribute(control,'type'),labelExact:labelExact===null?null:boundedText(labelExact),valueRaw:attribute(control,'value'),
      sourceRange:nodeRange(control),options:options.map(option=>({valueRaw:attribute(option,'value'),labelExact:boundedText(option.textContent??''),selected:option.hasAttribute('selected'),sourceRange:nodeRange(option)})),handlerReferences:[...handlerReferences].sort()});
  }

  const filterDeclarations:{name:string;valueRaw:Scalar;sourceRange:TestPoolSourceRange}[]=[];
  const gridColumns:{name:string|null;index:string|null;labelExact:string|null;formatterReference:string|null;
    formatterKind:'reference'|'inline'|'absent'|'dynamic';sourceRange:TestPoolSourceRange}[]=[];
  const referencedFormatters=new Set<string>(),inlineFormatters:{name:string;node:Ast;script:Script}[]=[];
  let gridCount=0;
  for(const script of scripts){
    if(script.source!=='selector')continue;
    const trees:Ast[]=[];
    if(script.ast)trees.push(script.ast);
    else{
      // A malformed unrelated script cannot authorize interpretation of arbitrary expressions.
      for(const match of script.text.matchAll(/(?:\$|jQuery)\(["']#dbExamListGrid["']\)\.jqGrid\s*\(/g)){
        try{trees.push(parseExpressionAt(script.text,match.index!,{ecmaVersion:2022}) as unknown as Ast);}
        catch{unknowns.add('question_grid_parse_unqualified');}
      }
    }
    for(const tree of trees)walk(tree,node=>{
      if(node.type==='VariableDeclarator'){
        const name=reference(node.id);
        if(name&&filterNames.has(name)){
          const valueRaw=literal(node.init);
          if(valueRaw===undefined)unknowns.add('filter_declaration_not_literal:'+name);
          else filterDeclarations.push({name,valueRaw,sourceRange:range(node,script)});
        }
      }
      if(node.type!=='CallExpression'||!ast(node.callee)||node.callee.type!=='MemberExpression')return;
      if((reference(node.callee.property)??sourceString(node.callee.property))!=='jqGrid')return;
      const object=node.callee.object;
      if(!ast(object)||object.type!=='CallExpression'||!['$','jQuery'].includes(reference(object.callee)??''))return;
      if(!Array.isArray(object.arguments)||sourceString(object.arguments[0])!=='#dbExamListGrid')return;
      if(!Array.isArray(node.arguments)||!ast(node.arguments[0])||node.arguments[0].type!=='ObjectExpression'){unknowns.add('question_grid_configuration_dynamic');return;}
      gridCount++;
      const config=node.arguments[0],model=property(config,'colModel'),names=property(config,'colNames');
      if(!ast(model)||model.type!=='ArrayExpression'||!Array.isArray(model.elements)){unknowns.add('question_grid_columns_dynamic');return;}
      if(model.elements.length>limits.gridColumns)throw Error('test_pool_presentation_column_limit');
      const columnNames=ast(names)&&names.type==='ArrayExpression'&&Array.isArray(names.elements)?names.elements:[];
      for(const [ordinal,column] of model.elements.entries()){
        if(gridColumns.length>=limits.gridColumns)throw Error('test_pool_presentation_column_limit');
        if(!ast(column)||column.type!=='ObjectExpression'){unknowns.add('question_grid_column_dynamic');continue;}
        const name=sourceString(property(column,'name')),index=sourceString(property(column,'index'));
        const labelExact=sourceString(property(column,'label'))??sourceString(columnNames[ordinal]);
        const formatter=property(column,'formatter'),formatterReference=reference(formatter)??sourceString(formatter);
        const formatterKind=formatter===undefined?'absent':formatterReference?'reference':ast(formatter)&&['FunctionExpression','ArrowFunctionExpression'].includes(formatter.type)?'inline':'dynamic';
        if(formatterReference)referencedFormatters.add(formatterReference);
        if(formatterKind==='inline')inlineFormatters.push({name:(name??String(ordinal))+'.formatter',node:formatter as Ast,script});
        if(formatterKind==='dynamic')unknowns.add('question_grid_formatter_dynamic');
        gridColumns.push({name,index,labelExact,formatterReference,formatterKind,sourceRange:range(column,script)});
      }
    });
  }
  if(!gridCount)unknowns.add('question_grid_not_observed');
  if(gridCount>1)unknowns.add('question_grid_initializer_ambiguous');
  for(const name of filterNames)if(filterDeclarations.filter(row=>row.name===name).length!==1)unknowns.add('filter_declaration_missing_or_ambiguous:'+name);
  if(!controls.length)unknowns.add('relevant_literal_controls_not_observed');

  const functionEvidence:{name:string;source:Script['source'];sourceRange:TestPoolSourceRange;sourceSha256:string;
    literals:{valueRaw:Scalar;sourceRange:TestPoolSourceRange}[]}[]=[];
  const addFunction=(name:string,node:Ast,script:Script)=>{
    if(functionEvidence.length>=limits.functions)throw Error('test_pool_presentation_function_limit');
    const source=script.text.slice(node.start,node.end);
    if(Buffer.byteLength(source)>limits.functionBytes)throw Error('test_pool_presentation_function_size_limit');
    const literals:{valueRaw:Scalar;sourceRange:TestPoolSourceRange}[]=[];
    walk(node,child=>{if(child.type==='Literal'){
      const valueRaw=literal(child);if(valueRaw===undefined)return;
      if(literals.length>=limits.literals)throw Error('test_pool_presentation_literal_limit');
      literals.push({valueRaw,sourceRange:range(child,script)});
    }});
    literals.sort((left,right)=>left.sourceRange.start-right.sourceRange.start);
    functionEvidence.push({name,source:script.source,sourceRange:range(node,script),sourceSha256:digest(source),literals});
  };
  for(const script of scripts)if(script.ast)walk(script.ast,node=>{
    const name=functionName(node);
    if(name&&(previewNames.has(name)||referencedFormatters.has(name)||/^dbFormatter.*(?:Difficulty|Types|Exam|Option|Answer)/i.test(name)))addFunction(name,node,script);
  });
  for(const row of inlineFormatters)addFunction(row.name,row.node,row.script);
  for(const name of referencedFormatters)if(!functionEvidence.some(row=>row.name===name))unknowns.add('formatter_definition_not_observed:'+name);
  for(const name of previewNames)if(!functionEvidence.some(row=>row.name===name))unknowns.add('preview_function_not_observed:'+name);
  for(const name of new Set(functionEvidence.map(row=>row.name)))if(functionEvidence.filter(row=>row.name===name).length>1)unknowns.add('function_definition_ambiguous:'+name);
  const selectorSha256=digest(selectorHtml),helpersSha256=digest(helperText);
  const selectorMatches=selectorSha256===testPoolPreviewSourcePins.selector,helpersMatch=helpersSha256===testPoolPreviewSourcePins.helpers;
  if(!selectorMatches||!helpersMatch)unknowns.add('source_revisions_differ_from_preview_qualification_pins');
  unknowns.add('literal_values_and_labels_do_not_establish_code_semantics');
  unknowns.add('question_and_solution_content_roles_not_normalized');
  const result={schemaVersion:1,sourceOperation:'test_pool_presentation_protocol' as const,selectorSha256,helpersSha256,sourceBytes,
    rangeUnit:'utf16_code_units' as const,sourcePins:{expectedSelectorSha256:testPoolPreviewSourcePins.selector,expectedHelpersSha256:testPoolPreviewSourcePins.helpers,
      selectorMatches,helpersMatch,qualification:selectorMatches&&helpersMatch?'qualified_original_source' as const:'source_changed_unqualified' as const},
    controls,gridColumns,functionEvidence,filterDeclarations,unknowns:[...unknowns].sort(),difficultyMapping:'not_normalized' as const,
    responseFormatMapping:'not_normalized' as const,sourceHandlersExecuted:false as const,academyWrites:0 as const};
  if(Buffer.byteLength(JSON.stringify(result))>limits.resultBytes)throw Error('test_pool_presentation_result_limit');
  return result;
}
