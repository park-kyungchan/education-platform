import {z} from 'zod';
import {createHash} from 'node:crypto';
import {toolResultBytes} from './tool-result.ts';
import {renderTeacherReport} from './teacher-report.ts';
import type {AuthenticatedFetchPage,TeacherSourceBinding,TeacherSelector} from './teacher-source-binding.ts';

export const MAX_TEACHER_MCP_BYTES=512*1024;
const id=z.string().min(1).max(200).refine(v=>!!v.trim()&&!/[\u0000-\u001f\u007f]/.test(v),'exact_opaque_id_required');
const date=z.iso.date();
const student=z.object({kind:z.literal('student'),studentId:id,date}).strict();
const preparation=z.object({kind:z.literal('class_preparation'),date,groupId:id.optional()}).strict();
export const teacherQuerySchema=z.object({
  selector:z.discriminatedUnion('kind',[z.object({kind:z.literal('cohort')}).strict(),student,preparation]),
  cursor:z.string().max(2048).nullable().optional(),limit:z.number().int().min(1).max(250).default(100),
  maxBytes:z.number().int().min(1024).max(131072).default(65536),
}).strict();
export const teacherReportSchema=z.object({
  selector:z.discriminatedUnion('kind',[student,preparation]),cursor:z.string().max(2048).optional(),
  maxBytes:z.number().int().min(1024).max(MAX_TEACHER_MCP_BYTES).default(65536),
  limit:z.number().int().min(1).max(250).default(100),
}).strict();
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonicalSelector=(selector:unknown)=>JSON.stringify(Object.entries(selector as Record<string,unknown>).sort(([a],[b])=>a<b?-1:a>b?1:0));
const refusal=(code:string)=>({schema:'academy.teacher-consumer.v1',status:'refused',code,automaticRetry:false,sourceWrites:false,parentSends:false});
const safeError=(error:unknown):string=>{
  const code=error instanceof Error?error.message:'';
  return code==='owner_scope_conflict'||/^(?:retained_|teacher_report_|teacher_source_)[a-z0-9_]{1,90}$/.test(code)?code:'teacher_source_unavailable';
};

/** Consumer transport/presentation only. Auth is supplied by the existing owner, never tool arguments. */
export class TeacherRetainedService {
  constructor(readonly binding:TeacherSourceBinding,private readonly authenticatedFetchPage:AuthenticatedFetchPage){}
  private async fetchPage(request:unknown):Promise<unknown>{
    try{return await this.authenticatedFetchPage(request);}catch{throw Error('teacher_source_authenticated_transport_unavailable');}
  }
  async query(value:unknown):Promise<unknown>{
    const input=teacherQuerySchema.parse(value);
    try{
      await this.binding.assertCurrent();
      const page=this.binding.validateReply(await this.fetchPage(input));
      if(page.status==='page'&&canonicalSelector(page.selector)!==canonicalSelector(input.selector))throw Error('teacher_report_scope_conflict');
      if(page.status==='page'){
        const metadata=page.page as Record<string,unknown>;
        if(metadata.maxBytes!==input.maxBytes||Number(metadata.returned)>input.limit)throw Error('teacher_source_request_scope_conflict');
      }
      await this.binding.assertCurrent();
      if(toolResultBytes(page)>MAX_TEACHER_MCP_BYTES)return refusal('teacher_report_mcp_budget_exceeded');
      return page;
    }catch(error){return refusal(safeError(error));}
  }
  async report(value:unknown):Promise<unknown>{
    const input=teacherReportSchema.parse(value);
    try{
      await this.binding.assertCurrent();
      const pages:{snapshot:string;callerBinding:string;retrievedAt:string;facadeSceneRevision:unknown;coverage:unknown;omissions:unknown}[]=[];
      // Canonical reader owns wire validation, every continuation, scope/order/count checks and final digest.
      const document=await this.binding.readDocument(input.selector,async request=>{
        const reply=this.binding.validateReply(await this.fetchPage(request));
        if(reply.status==='page')pages.push({snapshot:reply.snapshot as string,callerBinding:reply.callerBinding as string,retrievedAt:reply.retrievedAt as string,
          facadeSceneRevision:reply.facadeSceneRevision,coverage:reply.coverage,omissions:reply.omissions});
        return reply;
      });
      await this.binding.assertCurrent();
      if(!pages.length)throw Error('teacher_report_provenance_missing');
      const lines=renderTeacherReport(document,input.selector),snapshot=pages[0]!.snapshot;
      const selection=digest({selector:input.selector,maxBytes:input.maxBytes,limit:input.limit,format:'academy.teacher-report.v1'});
      const reportHash=digest(lines);
      let offset=0;
      if(input.cursor!==undefined){
        const parsed=decodeCursor(input.cursor);
        if(parsed.selection!==selection||parsed.snapshot!==snapshot||parsed.reportHash!==reportHash||parsed.callerBinding!==pages[0]!.callerBinding)throw Error('teacher_report_cursor_scope_conflict');
        if(parsed.offset>=lines.length)throw Error('teacher_report_cursor_scope_conflict');
        offset=parsed.offset;
      }
      const make=(end:number)=>({
        schema:'academy.teacher-report.v1',status:'page',selector:input.selector,
        text:(offset>0?`${lines[0]}\n[계속: ${offset+1}번째 줄부터]\n`:'')+lines.slice(offset,end).join('\n'),
        provenance:{canonicalSource:this.binding.source,snapshot,callerBinding:pages[0]!.callerBinding,facadeSceneRevision:pages[0]!.facadeSceneRevision,
          retrievedFirstAt:pages[0]!.retrievedAt,retrievedLastAt:pages.at(-1)!.retrievedAt,canonicalPagesConsumed:pages.length,
          sourceClockMeaning:'Source observation/verification/recording clocks stay in report; retrieval is not source refresh.',
          nativeSourceAcquisition:false},
        coverage:pages[0]!.coverage,omissions:pages[0]!.omissions,
        savedScopeAdvisory:'Saved student_history covers selected facets only; dated lesson_context-only observations require a separate query. No saved/live merge or all/current-history claim.',
        page:{offset,returned:end-offset,totalLines:lines.length,exhausted:end===lines.length,
          nextCursor:end<lines.length?encodeCursor({v:1,selection,snapshot,reportHash,callerBinding:pages[0]!.callerBinding,offset:end}):null},
        effects:{sourceAcquisition:false,sourceWrites:false,parentSends:false,print:false},
      });
      if(toolResultBytes(make(offset))>input.maxBytes)return refusal('teacher_report_fixed_metadata_exceeds_budget');
      let end=offset;
      while(end<Math.min(lines.length,offset+input.limit)){
        if(toolResultBytes(make(end+1))>input.maxBytes)break;
        end++;
      }
      if(end===offset)return refusal('teacher_report_line_exceeds_budget');
      const result=make(end);
      if(toolResultBytes(result)>MAX_TEACHER_MCP_BYTES)return refusal('teacher_report_mcp_budget_exceeded');
      return result;
    }catch(error){return refusal(safeError(error));}
  }
}
const cursorSchema=z.object({v:z.literal(1),selection:z.string().regex(/^[a-f0-9]{64}$/),snapshot:z.string().regex(/^[a-f0-9]{64}$/),reportHash:z.string().regex(/^[a-f0-9]{64}$/),callerBinding:z.string().regex(/^[a-f0-9]{64}$/),offset:z.number().int().positive()}).strict();
function encodeCursor(value:z.infer<typeof cursorSchema>):string{return Buffer.from(JSON.stringify(value)).toString('base64url');}
function decodeCursor(token:string):z.infer<typeof cursorSchema>{
  try{
    if(!/^[A-Za-z0-9_-]+$/.test(token)||Buffer.from(token,'base64url').toString('base64url')!==token)throw Error();
    return cursorSchema.parse(JSON.parse(Buffer.from(token,'base64url').toString('utf8')));
  }catch{throw Error('teacher_report_cursor_scope_conflict');}
}
