import {buildStudentEventProjection,reconcileLegacyCurrent} from './student-event-projection.ts';
import {projectHistory} from './history-import.ts';
import {historyImport} from './generated/history-import.ts';
import {AcademyReadError,assertSavedRead,assertSavedIndex,parseReadArguments,buildToday,buildStudentDetail,buildSourceFreshness,type ReadOperation,type ReadArguments} from './academy-read-model.ts';
type SnapshotWorker={fetch(request:Request):Promise<Response>};
export interface AcademyReadHandlerOptions {origin:string;snapshotWorker:SnapshotWorker;authorize:(request:Request)=>Promise<unknown>;now?:()=>Date;projectEvents?:(request:Request,students:readonly {studentId:string;displayName?:string}[],date?:string,session?:'all'|'1'|'2',recordId?:string)=>Promise<any>;}
const paths:Record<string,ReadOperation>={'/api/academy/today':'today','/api/academy/student-detail':'student-detail','/api/academy/source-freshness':'source-freshness'};
const tools=[
 {name:'academy_today',operation:'today' as const,description:'Read a date-scoped academy preparation summary. Saved evidence only; unqueried DailyRecord and unverified session mappings stay unknown. No refresh or writes.',inputSchema:{type:'object',properties:{date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},session:{type:'string',enum:['all','1','2']}},additionalProperties:false}},
 {name:'academy_student_detail',operation:'student-detail' as const,description:'Read one authorized student saved detail or one exact record. Original clocks, teacher decisions, history and explicit conflicts stay separate. No refresh or writes.',inputSchema:{type:'object',properties:{studentId:{type:'string',minLength:1,maxLength:512},recordId:{type:'string',minLength:1,maxLength:512},offset:{type:'integer',minimum:0,maximum:10000},limit:{type:'integer',minimum:1,maximum:20}},required:['studentId'],additionalProperties:false}},
 {name:'academy_source_freshness',operation:'source-freshness' as const,description:'Check saved-source freshness and live-connection limits for the Site or one authorized student. A build timestamp is never a source refresh time.',inputSchema:{type:'object',properties:{studentId:{type:'string',minLength:1,maxLength:512}},additionalProperties:false}}
];
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie, Authorization, OAI-Sites-Authorization'}});
const isObject=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const rpcError=(id:unknown,code:number,message:string,status=200)=>json({jsonrpc:'2.0',id:id??null,error:{code,message}},status);
const safeError=(error:unknown)=>error instanceof AcademyReadError?error:{status:isObject(error)&&[401,403].includes(error.status)?error.status:503,code:isObject(error)&&typeof error.code==='string'?error.code:'protected_read_unavailable'};
export function createAcademyReadHandler(options:AcademyReadHandlerOptions):SnapshotWorker{
  async function source(request:Request,path:string,body:unknown){
    // A function call through the unchanged legacy authorization/scope gates,
    // never a network fetch or a service token masquerading as a visitor.
    const headers=new Headers({'Content-Type':'application/json',origin:options.origin});
    for(const name of ['oai-authenticated-user-id','oai-authenticated-user-email']){const value=request.headers.get(name);if(value)headers.set(name,value);}
    const response=await options.snapshotWorker.fetch(new Request(options.origin+path,{method:'POST',headers,body:JSON.stringify(body)}));
    if(!response.ok)throw new AcademyReadError([401,403,409].includes(response.status)?response.status:503,'protected_saved_read_failed');
    let result:any;try{result=await response.json();}catch{throw new AcademyReadError(503,'invalid_saved_read_response');}
    return path==='/__academy/index'?assertSavedIndex(result):assertSavedRead(result);
  }
  async function selected(request:Request,studentId?:string){
    const initial=await source(request,'/__academy/index',{});
    if(!studentId)return initial;
    if(!initial.meta.students.some((s:any)=>s.id===studentId&&s.managementState==='active'))throw new AcademyReadError(403,'student_outside_current_managed_scope');
    const m=initial.meta,body={studentId,expectedRosterRevision:m.rosterRevision,expectedRegistrySha256:m.registrySha256,expectedSnapshotSha256:m.snapshotProjectionSha256?.[studentId],expectedTeacherOverlaySha256:m.teacherOverlayProjectionSha256?.[studentId],expectedGradingProjectionSha256:m.gradingProjectionSha256?.[studentId],expectedEvidenceProjectionSha256:m.evidenceProjectionSha256?.[studentId],expectedDomainContractSha256:m.domainContractSha256,expectedAssessmentProjectionSha256:m.assessmentProjectionSha256?.[studentId],expectedAssessmentContractSha256:m.assessmentContractSha256};
    return assertSavedRead(await source(request,'/api/student-snapshot',body),studentId);
  }
  async function read(request:Request,operation:ReadOperation,args:ReadArguments){
    await options.authorize(request);const result=await selected(request,args.studentId);
    const readResult=operation==='today'?buildToday(result,args,options.now?.()??new Date()):operation==='student-detail'?buildStudentDetail(result,args):buildSourceFreshness(result,args);
    const authorizedStudents=result.meta.students.filter((s:any)=>s.managementState==='active'&&(!args.studentId||s.id===args.studentId)).map((s:any)=>({studentId:s.id,displayName:s.displayName}));
    const legacy=projectHistory(readResult,args,historyImport,authorizedStudents.map((s:any)=>s.studentId));
    const overlay=options.projectEvents?await options.projectEvents(request,authorizedStudents,(readResult as any).requestedDate,args.session??'all',args.recordId):await buildStudentEventProjection(authorizedStudents,(readResult as any).requestedDate,args.session??'all',args.recordId);
    return reconcileLegacyCurrent(legacy,overlay);
  }
  return {async fetch(request){
    const url=new URL(request.url),isMcp=url.pathname==='/mcp',operation=paths[url.pathname];
    if(url.pathname==='/__academy/index')return json({status:'not_found'},404);
    if(!isMcp&&!operation)return options.snapshotWorker.fetch(request);
    if(url.origin!==options.origin)return json({status:'untrusted_host'},403);
    if(request.method!=='POST')return json({status:'method_not_allowed'},405);
    const origin=request.headers.get('origin');
    // Browser API remains same-origin; native MCP may have no Origin. A
    // foreign or null Origin is rejected, never converted into a trusted one.
    if((!isMcp&&origin!==options.origin)||(isMcp&&origin!==null&&origin!==options.origin))return json({status:'same_origin_required'},403);
    if(request.headers.get('sec-fetch-site')==='cross-site')return json({status:'same_origin_required'},403);
    if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({status:'application_json_required'},415);
    const length=Number(request.headers.get('content-length'));if(Number.isFinite(length)&&length>8192)return json({status:'request_too_large'},413);
    let raw:string;try{raw=await request.text();}catch{return json({status:'invalid_request'},400);}
    if(raw.length>8192)return json({status:'request_too_large'},413);
    let input:any;try{input=JSON.parse(raw);}catch{return isMcp?rpcError(null,-32700,'Parse error',400):json({status:'invalid_request'},400);}
    if(!isMcp){try{return json({status:'success',result:await read(request,operation,parseReadArguments(operation,input))});}catch(error){const e=safeError(error);return json({status:e.code},e.status);}}
    if(!isObject(input)||input.jsonrpc!=='2.0'||typeof input.method!=='string'||Object.keys(input).some(key=>!['jsonrpc','id','method','params'].includes(key))||('id'in input&&!(typeof input.id==='string'||typeof input.id==='number'&&Number.isSafeInteger(input.id)))||('params'in input&&!isObject(input.params)))return rpcError(null,-32600,'Invalid Request',400);
    const id=input.id,params=input.params??{};
    if(!('id'in input)){if(['notifications/initialized','notifications/cancelled'].includes(input.method))return new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});return rpcError(null,-32600,'Unsupported notification',400);}
    if(input.method==='initialize'){
      if(typeof params.protocolVersion!=='string'||!isObject(params.capabilities)||!isObject(params.clientInfo))return rpcError(id,-32602,'Invalid initialize parameters');
      const supported=['2025-03-26','2025-06-18','2025-11-25'];
      return json({jsonrpc:'2.0',id,result:{protocolVersion:supported.includes(params.protocolVersion)?params.protocolVersion:'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'academy-learning-rails',version:'1.0.0'},instructions:'Owner-private academy saved evidence only. Unqueried records never prove missing homework or completion.'}});
    }
    if(input.method==='ping')return json({jsonrpc:'2.0',id,result:{}});
    if(input.method==='tools/list')return json({jsonrpc:'2.0',id,result:{tools:tools.map(({operation,...tool})=>({...tool,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}))}});
    if(input.method!=='tools/call')return rpcError(id,-32601,'Method not found');
    if(Object.keys(params).some(key=>!['name','arguments','_meta'].includes(key))||typeof params.name!=='string')return rpcError(id,-32602,'Invalid tool parameters');
    const tool=tools.find(t=>t.name===params.name);if(!tool)return rpcError(id,-32602,'Unknown tool');
    let args:ReadArguments;try{args=parseReadArguments(tool.operation,Object.hasOwn(params,'arguments')?params.arguments:{});}catch{return rpcError(id,-32602,'Invalid tool arguments');}
    try{const result=await read(request,tool.operation,args);return json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false}});}catch(error){const e=safeError(error);if(e.status===401||e.status===403)return rpcError(id,-32001,e.code,e.status);return json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:e.code}],isError:true}});}
  }};
}
