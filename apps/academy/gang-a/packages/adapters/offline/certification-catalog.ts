import {z} from 'zod';
import {parse,type DefaultTreeAdapterMap} from 'parse5';
import {parseExpressionAt,type Node as AstNode} from 'acorn';

export const CERTIFICATION_CATALOG_VERSION='academy.certification-catalog/1.0.0' as const;
export const CERTIFICATION_CONTRACT_SHA256='314ccf0359ddfe6732f74da69be2f2ebffcf5c4e6ae85e2d39a4c1e20cdafef8';
export const CERTIFICATION_CATALOG_URL='https://dc.gang-a.kr/servlet/controller.tutor.da.TestPageListGrpServlet';
export const CERTIFICATION_CAPABILITIES=Object.freeze({catalog:'offline_capture_parser',exactBookFinalBinding:'not_observed',studentResults:'not_observed',liveTransport:'unavailable',examGeneration:false,gradingWrites:false});
export const CATALOG_HEADERS=['시험출제','학년 / 시험지 제목','문항수','시험지','복사','부가정보'] as const;
const value=z.string().max(500).refine(s=>!/[\u0000-\u001f\u007f]/.test(s));
const FixedFields=z.strictObject({grade:value,p_copy:value,p_first:value,p_master:value,p_original_testno:value,p_pageno:value,p_testno:value,subject:value,test_small_name:value,use_term:value});
export type CatalogFieldPolicy={source:'unverified'|'synthetic_fixture'|'verified_nonsecret_capture_values';fixedValues:z.infer<typeof FixedFields>|null};
/** Static Main/Search descriptors only. No real values or executable transport are supplied. */
export function prepareCertificationCatalogRequest(input:unknown,policy:CatalogFieldPolicy={source:'unverified',fixedValues:null}){
 const operation=z.strictObject({p_process:z.enum(['Main','Search'])}).safeParse(input),fields=FixedFields.safeParse(policy.fixedValues);
 if(!operation.success)return {status:'blocked' as const,code:'UNSUPPORTED_CATALOG_OPERATION',networkExecutionAllowed:false as const};
 if(!['synthetic_fixture','verified_nonsecret_capture_values'].includes(policy.source)||!fields.success)return {status:'blocked' as const,code:'NONSECRET_FORM_VALUES_UNVERIFIED',networkExecutionAllowed:false as const};
 const body=new URLSearchParams({...fields.data,p_process:operation.data.p_process});
 return {status:'prepared' as const,url:CERTIFICATION_CATALOG_URL,method:'POST' as const,contentType:'application/x-www-form-urlencoded',bodyUtf8:body.toString(),valueProvenance:policy.source,networkExecutionAllowed:false as const,readEffectsVerified:false as const,credentialsIncluded:false as const};
}
type HtmlNode=DefaultTreeAdapterMap['node'];
const attr=(n:HtmlNode,key:string)=>'attrs'in n?n.attrs.find(a=>a.name===key)?.value??null:null;
const children=(n:HtmlNode):HtmlNode[]=>'childNodes'in n?n.childNodes:[];
const tag=(n:HtmlNode)=>'tagName'in n?n.tagName:'';
const walk=(n:HtmlNode):HtmlNode[]=>[n,...children(n).flatMap(walk)];
const text=(n:HtmlNode):string=>['script','style'].includes(tag(n))?'':'value'in n?n.value:children(n).map(text).join(' ');
const norm=(s:string)=>s.replace(/[\s\u00a0]+/g,' ').trim();
const cells=(row:HtmlNode)=>children(row).filter(n=>['td','th'].includes(tag(n)));
const hasClass=(n:HtmlNode,name:string)=>(attr(n,'class')??'').split(/\s+/).includes(name);
function rows(table:HtmlNode){return children(table).filter(n=>['tbody','thead'].includes(tag(n))).flatMap(section=>children(section).filter(n=>tag(n)==='tr'));}
function disabledAncestor(node:HtmlNode){let current:HtmlNode|null=node;while(current){if(['fieldset','select','optgroup','option'].includes(tag(current))&&attr(current,'disabled')!==null)return true;current='parentNode'in current?current.parentNode:null;}return false;}
const ACTIONS=['onView','onCopy','onCode','onCreatePrintButtonClick','sendTest'] as const;
function candidate(handler:string):string|null{
 const clean=handler.trim().replace(/^javascript:/i,'').replace(/^return\s+/,'').replace(/;\s*$/,'');
 let node:AstNode;try{node=parseExpressionAt(clean,0,{ecmaVersion:'latest'});}catch{throw Error('unsupported_paper_action');}
 if(node.end!==clean.length||node.type!=='CallExpression'||!('callee'in node)||!('arguments'in node))throw Error('unsupported_paper_action');
 const call=node as AstNode&{callee:AstNode&{name?:string};arguments:(AstNode&{value?:unknown})[]};
 if(call.callee.type!=='Identifier'||!ACTIONS.includes(call.callee.name as typeof ACTIONS[number]))throw Error('unsupported_paper_action');
 if(!call.arguments.length||call.arguments.some(a=>a.type!=='Literal'))throw Error('unsupported_paper_action');
 const first=call.arguments[0].value,id=typeof first==='number'&&Number.isSafeInteger(first)&&first>0?String(first):typeof first==='string'&&/^\d+$/.test(first)&&Number.isSafeInteger(Number(first))&&Number(first)>0?first:null;
 if(id===null)throw Error('invalid_paper_candidate');return id;
}
export interface CatalogRow{paperIdCandidate:string;gradeLabelRaw:string;titleRaw:string;questionCount:number;classificationRaw:string;termLabelRaw:string;bookEditionId:null;studentId:null;attemptId:null;score:null;scoreMaximum:null;examEventAt:null;nativeIdentityVerified:false;sourceRowOrdinal:number;}
/** HTML and handlers are data. No script, popup, print, copy, exam or score action runs. */
export function parseCertificationCatalog(input:{bytes:Uint8Array;status:number;mimeType:string;charset:string;responseUrl:string;wasRedirected:boolean;expectedFilters?:{grade:string;use_term:string}}){
 const blocked=(code:string)=>({status:'blocked' as const,code,rows:[] as CatalogRow[],networkInvoked:false as const});
 if(input.status===401)return blocked('AUTH_REQUIRED');if(input.status===403)return blocked('ACCESS_DENIED');
 if(input.status!==200||input.wasRedirected||input.responseUrl!==CERTIFICATION_CATALOG_URL||input.mimeType.toLowerCase().split(';')[0].trim()!=='text/html'||input.charset.toLowerCase()!=='utf-8'||!(input.bytes instanceof Uint8Array))return blocked('RESPONSE_METADATA_MISMATCH');
 if(input.bytes.length>2_000_000)return blocked('HTML_TOO_LARGE');
 let html:string;try{html=new TextDecoder('utf-8',{fatal:true}).decode(input.bytes);}catch{return blocked('INVALID_UTF8');}
 const doc=parse(html,{scriptingEnabled:false}),nodes=walk(doc);
 if(nodes.some(n=>tag(n)==='input'&&(attr(n,'type')??'').toLowerCase()==='password')||nodes.some(n=>tag(n)==='form'&&/login|sign.?in|auth/i.test(attr(n,'action')??'')))return blocked('AUTH_REQUIRED');
 const forms=nodes.filter(n=>tag(n)==='form'&&attr(n,'id')==='form1'&&attr(n,'name')==='form1');if(forms.length!==1||(attr(forms[0],'method')??'').toLowerCase()!=='post')return blocked('CATALOG_FORM_MISMATCH');
 const form=forms[0],tables=walk(form).filter(n=>tag(n)==='table'&&hasClass(n,'content-table')&&hasClass(n,'thin'));
 const isHeader=(row:HtmlNode)=>cells(row).length===6&&cells(row).every((c,i)=>norm(text(c))===CATALOG_HEADERS[i]);
 const matches=tables.filter(t=>rows(t).some(isHeader));if(matches.length!==1)return blocked('CATALOG_TABLE_MISMATCH');
 const tableRows=rows(matches[0]),headerIndex=tableRows.findIndex(isHeader),records:CatalogRow[]=[];
 try{for(const [i,row]of tableRows.slice(headerIndex+1).entries()){
  const cs=cells(row);if(cs.length!==6||cs.some(c=>(attr(c,'colspan')??'1')!=='1'||(attr(c,'rowspan')??'1')!=='1'))throw Error('catalog_row_shape');
  const handlers=walk(row).map(n=>attr(n,'onclick')).filter((s):s is string=>s!==null&&ACTIONS.some(a=>new RegExp('\\b'+a+'\\s*\\(').test(s))),ids=handlers.map(candidate).filter((s):s is string=>s!==null);
  if(!ids.length||new Set(ids).size!==1)throw Error('paper_id_conflict');
  const links=walk(cs[1]).filter(n=>hasClass(n,'txt-link')&&/\bonView\s*\(/.test(attr(n,'onclick')??'')),grades=walk(cs[1]).filter(n=>hasClass(n,'list-sub-content'));
  const tooltips=walk(cs[5]).filter(n=>tag(n)==='table'&&hasClass(n,'list-tooltip-table'));if(links.length!==1||grades.length!==1||tooltips.length!==1)throw Error('catalog_row_shape');
  const tooltipRows=rows(tooltips[0]);if(tooltipRows.length!==2||cells(tooltipRows[0]).length!==2||cells(tooltipRows[1]).length!==2||cells(tooltipRows[0]).map(c=>norm(text(c))).join('|')!=='시험구분|출제학기')throw Error('tooltip_shape');
  const countRaw=norm(text(cs[2])),count=Number(countRaw);if(!/^\d+$/.test(countRaw)||!Number.isSafeInteger(count)||count<1)throw Error('question_count_unknown');
  const [classificationRaw,termLabelRaw]=cells(tooltipRows[1]).map(c=>norm(text(c)));records.push({paperIdCandidate:ids[0],gradeLabelRaw:norm(text(grades[0])),titleRaw:norm(text(links[0])),questionCount:count,classificationRaw,termLabelRaw,bookEditionId:null,studentId:null,attemptId:null,score:null,scoreMaximum:null,examEventAt:null,nativeIdentityVerified:false,sourceRowOrdinal:i+1});
 }}catch(error){return blocked(error instanceof Error?error.message:'CATALOG_PARSE_FAILED');}
 if(new Set(records.map(r=>r.paperIdCandidate)).size!==records.length)return blocked('DUPLICATE_PAPER_CANDIDATE');
 const filters=Object.fromEntries(['grade','use_term'].map(name=>{const controls=walk(form).filter(n=>['select','input','textarea','button'].includes(tag(n))&&attr(n,'name')===name);const options=controls.length===1&&tag(controls[0])==='select'?walk(controls[0]).filter(n=>tag(n)==='option'&&attr(n,'selected')!==null):[];const selected=options.map(n=>({value:attr(n,'value'),labelRaw:norm(text(n))}));const unsupported=controls.length!==1||tag(controls[0])!=='select'||attr(controls[0],'multiple')!==null||(attr(controls[0],'form')!==null&&attr(controls[0],'form')!=='form1')||disabledAncestor(controls[0])||walk(controls[0]).some(n=>attr(n,'disabled')!==null)||options.some(n=>attr(n,'label')!==null);return [name,{selected,status:unsupported?'unsupported_control':options.length>1?'ambiguous_explicit_selection':options.length===1?'explicit_selection':'selection_not_observed'}];}));
 const ambiguous=Object.values(filters).some(f=>f.status==='ambiguous_explicit_selection'),echoVerified=!!input.expectedFilters&&Object.entries(filters).every(([name,f])=>f.status==='explicit_selection'&&f.selected[0].value===input.expectedFilters?.[name as 'grade'|'use_term']);
 return {status:'parsed' as const,rows:records,filters,filterEcho:ambiguous?'ambiguous_explicit_selection':echoVerified?'verified_exact_echo':'unverified_echo',coverage:{complete:false,zeroRowsProveNoStudentAttempts:false},provenance:{kind:'imported_snapshot' as const,responseBytesSha256:new Bun.CryptoHasher('sha256').update(input.bytes).digest('hex'),contractSha256:CERTIFICATION_CONTRACT_SHA256,captureAt:null,contractCaptureAt:'2026-10-08T09:41:34.135Z',examEventAt:null,directLmsObservation:false},capabilities:CERTIFICATION_CAPABILITIES,executedActions:0 as const,networkInvoked:false as const};
}
