import {digest} from '../learning/model';
import {parse,parseExpressionAt} from 'acorn';

/** Retain exact rendered literal defaults rather than guessing institutional/category scope. */
export function testPoolSelectorDefaults(html:string) {
  const result:Record<string,string>={};
  for(const name of ['make_school_key','category_iden','categ_type']){
    const matches=[...html.matchAll(new RegExp('(?:var|let|const)\\s+'+name+'\\s*=\\s*(?:"([^"\\r\\n]*)"|\'([^\'\\r\\n]*)\'|([0-9]+))\\s*;','g'))];
    if(matches.length!==1)throw Error('test_pool_selector_default_unqualified');
    const value=matches[0]![1]??matches[0]![2]??matches[0]![3]!;
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw Error('test_pool_selector_default_unqualified');result[name]=value;
  }
  return result;
}

export function readTestPoolDocument(html:string,parseDocument:(text:string,mime:DOMParserSupportedType)=>Document) {
  if(Buffer.byteLength(html)>2_000_000)throw Error('test_pool_response_too_large');
  const doc=parseDocument(html,'text/html');
  if(doc.querySelector('input[type=password]')||/normal_session_error\.jsp|세션이 만료/.test(html))throw Error('test_pool_authentication_required');
  return doc;
}

/** Inert page metadata only. It never follows a form, executes scripts or retains source controls' values. */
export function inspectTestPoolDocument(html:string,parseDocument:(text:string,mime:DOMParserSupportedType)=>Document,additionalScripts:readonly string[]=[]) {
  if(additionalScripts.length>2||additionalScripts.some(script=>Buffer.byteLength(script)>2_000_000))throw Error('test_pool_script_size_limit');
  const doc=readTestPoolDocument(html,parseDocument);
  const location=(value:string)=>{try{const url=new URL(value,'https://dc.gang-a.kr');return {path:url.pathname,
    sameOrigin:url.origin==='https://dc.gang-a.kr',queryFieldNames:[...url.searchParams.keys()],
    commandFields:Object.fromEntries(['reqCmd','p_process'].flatMap(key=>{const value=url.searchParams.get(key);return value&&/^[A-Za-z0-9_]{1,100}$/.test(value)?[[key,value]]:[]}))};}catch{return {path:'unparsed',sameOrigin:false,queryFieldNames:[],commandFields:{}};}};
  const paths=(selector:string,attribute:string)=>[...doc.querySelectorAll(selector)].map(node=>node.getAttribute(attribute)??'').filter(Boolean).map(location);
  const scripts=[...[...doc.querySelectorAll('script:not([src])')].map(node=>node.textContent??''),...additionalScripts];
  const functionNames=[...new Set(scripts.flatMap(script=>[...script.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]!)))];
  const sourcePathCandidates=[...new Set(scripts.flatMap(script=>[...script.matchAll(/["'](\/(?:common|servlet|js)\/[A-Za-z0-9_./?=&-]+)["']/g)].map(match=>match[1]!)))];
  const selectedReadFunctions=[...new Set(['dbFormatterTypesCell','getExamPath','getExamCardImageFileName','reloadExamList','onGetExamListButtonClick','previewDBExam','toJsonValue','checkResultValue','getPoolExamList','onGetPoolExamList','onReceiveTypeInfo','getTextExamList','getObjectExamList',
    ...functionNames.filter(name=>/^(?:get|load|search).*(?:Category|Type|Pat|Unit|Stage|Chapter|Label|Grade|Tree)/i.test(name))])].slice(0,16);
  const readFunctionSources:{name:string;source:string|null;classification:string}[]=[];
  for(const script of scripts){
    if(script.length>1_000_000)continue;
    let ast:unknown;try{ast=parse(script,{ecmaVersion:2022});}catch{
      for(const name of selectedReadFunctions){
        const matches=[...script.matchAll(new RegExp('function\\s+'+name+'\\s*\\(','g'))];
        if(matches.length!==1)continue;
        try{const expression=parseExpressionAt(script,matches[0]!.index!,{ecmaVersion:2022});
          if(expression.type==='FunctionExpression'&&expression.end-expression.start<=20000)readFunctionSources.push({name,source:script.slice(expression.start,expression.end),classification:'inert_function_fragment_global_binding_unverified'});
        }catch{}
      }
      continue;
    }
    const pending:unknown[]=[ast];let visited=0;
    while(pending.length){if(++visited>100000)break;const node=pending.pop() as any;
      if(!node||typeof node!=='object')continue;
      if(node.type==='FunctionDeclaration'&&selectedReadFunctions.includes(node.id?.name))readFunctionSources.push({name:node.id.name,source:node.end-node.start<=20000?script.slice(node.start,node.end):null,classification:'inert_ast_source_not_executed'});
      if(node.type==='VariableDeclarator'&&selectedReadFunctions.includes(node.id?.name)&&['FunctionExpression','ArrowFunctionExpression'].includes(node.init?.type))readFunctionSources.push({name:node.id.name,source:node.end-node.start<=20000?script.slice(node.start,node.end):null,classification:'inert_function_initializer_not_executed'});
      for(const child of Object.values(node))if(Array.isArray(child)){for(const item of child)pending.push(item);}else if(child&&typeof child==='object')pending.push(child);
    }
  }
  for(const name of selectedReadFunctions)if(readFunctionSources.filter(row=>row.name===name).length>1)for(const row of readFunctionSources.filter(row=>row.name===name)){row.source=null;row.classification='source_function_ambiguous';}
  const declaredCommands=[...new Set(scripts.flatMap(script=>[...script.matchAll(/\b(?:p_process|reqCmd)\s*[:=]\s*["']([A-Za-z0-9_]{1,100})["']/g)].map(match=>match[1]!)))];
  return {schemaVersion:1,kind:'inert_test_pool_page_metadata' as const,sourceSha256:digest(html),
    frames:paths('iframe[src],frame[src]','src'),externalScripts:paths('script[src]','src'),
    formActions:paths('form[action]','action'),functionNames,sourcePathCandidates:sourcePathCandidates.map(location),declaredCommands,
    readFunctionSources,
    questionFilterDeclarations:scripts.flatMap(script=>[...script.matchAll(/\bvar\s+(g_examtype_filter|searchConditionDifficulty|searchConditionBehAreaNo)\s*=\s*(?:([0-9]+)|"([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)')\s*;/g)].map(match=>({name:match[1],value:match[2]??match[3]??match[4]}))),
    questionGridInitializerSource:scripts.flatMap(script=>{
      const match=/\$\(["']#dbExamListGrid["']\)\.jqGrid\s*\(/.exec(script);
      if(!match)return [];
      try{const node=parseExpressionAt(script,match.index,{ecmaVersion:2022});
        return node.end-node.start<=32000?[{source:script.slice(node.start,node.end),classification:'inert_grid_configuration_not_executed'}]:[];
      }catch{return [];}
    }),
    categoryInitializerSource:scripts.flatMap(script=>{const index=script.indexOf('CategoryList');return index<0?[]:[script.slice(Math.max(0,index-800),index+1500)];}),
    typeReadTemplateFields:scripts.flatMap(script=>{const index=script.indexOf('/servlet/controller.common.TestPageShowExServlet?p_process=GetTypeTotal');
      if(index<0)return [];const end=script.indexOf(';',index);if(end<0||end-index>2000)return [];
      return [{fields:[...script.slice(index,end).matchAll(/[?&]([A-Za-z_]\w*)=/g)].map(match=>match[1]!),source:script.slice(index,end)}];}),
    elementIds:[...doc.querySelectorAll('[id]')].map(node=>node.id).filter(value=>/^[A-Za-z_][\w-]{0,80}$/.test(value)),
    controls:[...doc.querySelectorAll('input[name],select[name],textarea[name]')].map(node=>({
      tag:node.tagName.toLowerCase(),name:node.getAttribute('name'),type:node.getAttribute('type'),optionCount:node.querySelectorAll('option').length,
    })),
    etestPoolTabReferenced:html.includes('/common/etest_pool.jsp'),
    sourceHandlersExecuted:false as const,controlValuesExported:false as const,academyWrites:0 as const};
}
