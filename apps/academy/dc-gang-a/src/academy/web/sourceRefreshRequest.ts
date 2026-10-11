import {sameTeacherScope,teacherActionHeaders,type TeacherActionScope} from '../teacherActionScope';
import {scopedReadFamilies} from '../../lms/academyReadProtocol';
interface RequestIdentity {requestId:string;studentId:string|null;date?:string}
interface AreaReply {id:string;studentId:string;family:string;status:'pending'|'observed'|'blocked'|'failed';reason?:string;observedAt?:string}
export interface SourceRefreshReply extends RequestIdentity,TeacherActionScope {status:'pending'|'observed'|'partial'|'blocked'|'failed'|'not_found';reason?:string;areas?:AreaReply[]}
function validDate(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
/** Server-owned recovery: browser storage availability is never an admission or continuity dependency. */
export class SourceRefreshRequest {
  private original:RequestIdentity|null=null;
  private flight:Promise<SourceRefreshReply>|null=null;
  readonly scope:TeacherActionScope;
  constructor(scope:TeacherActionScope,private readonly send:(input:RequestIdentity)=>Promise<unknown>,private readonly readPending:()=>Promise<unknown>,private readonly readResult:(id:string)=>Promise<unknown>){
    teacherActionHeaders(scope);this.scope=Object.freeze({...scope});
  }
  private validate(value:unknown,expected?:RequestIdentity,allowCoalesced=false):SourceRefreshReply{
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('source_receipt_scope_conflict');
    const row=value as Record<string,unknown>;
    if(!sameTeacherScope(this.scope,row as unknown as TeacherActionScope)||typeof row.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.requestId)||!['pending','observed','partial','blocked','failed','not_found'].includes(row.status as string))throw Error('source_receipt_scope_conflict');
    const coalesced=allowCoalesced&&row.coalesced===true;
    if(expected&&!coalesced&&row.requestId!==expected.requestId)throw Error('source_receipt_scope_conflict');
    if(row.status==='not_found'&&expected)return {...this.scope,...expected,status:'pending',reason:'original_request_not_found_no_automatic_retry'};
    if(row.studentId!==null&&(typeof row.studentId!=='string'||!row.studentId))throw Error('source_receipt_scope_conflict');
    if(expected&&!coalesced&&row.studentId!==expected.studentId)throw Error('source_receipt_scope_conflict');
    const result:SourceRefreshReply={...this.scope,requestId:row.requestId,studentId:row.studentId as string|null,status:row.status as SourceRefreshReply['status']};
    if(row.date!==undefined){if(!validDate(row.date))throw Error('source_receipt_scope_conflict');result.date=row.date;}
    if(expected?.date!==undefined&&!coalesced&&row.date!==expected.date)throw Error('source_receipt_scope_conflict');
    if(row.areas!==undefined){
      if(!Array.isArray(row.areas)||row.areas.length>256)throw Error('source_receipt_scope_conflict');const seen=new Set<string>();
      result.areas=row.areas.map(value=>{
        if(!value||typeof value!=='object'||Array.isArray(value))throw Error('source_receipt_scope_conflict');const area=value as Record<string,unknown>;
        if(typeof area.id!=='string'||!area.id||seen.has(area.id)||typeof area.studentId!=='string'||!area.studentId||result.studentId!==null&&area.studentId!==result.studentId||!scopedReadFamilies.includes(area.family as typeof scopedReadFamilies[number])||!['pending','observed','blocked','failed'].includes(area.status as string))throw Error('source_receipt_scope_conflict');seen.add(area.id);
        const record:AreaReply={id:area.id,studentId:area.studentId,family:area.family as string,status:area.status as AreaReply['status']};
        if(typeof area.reason==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(area.reason))record.reason=area.reason;
        if(typeof area.observedAt==='string'&&Number.isFinite(Date.parse(area.observedAt)))record.observedAt=area.observedAt;
        return record;
      });
    }
    if(typeof row.reason==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(row.reason))result.reason=row.reason;
    return result;
  }
  private settle(reply:SourceRefreshReply){this.original=reply.status==='pending'?{requestId:reply.requestId,studentId:reply.studentId,...(reply.date?{date:reply.date}:{})}:null;return reply;}
  /** Read-only history does not adopt a terminal receipt as a new dispatch or change original intent. */
  history(value:unknown):{rows:SourceRefreshReply[];nextCursor:string|null}{
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('source_history_scope_conflict');
    const page=value as Record<string,unknown>;
    if(page.schemaVersion!==1||page.kind!=='source_refresh_history'||page.order!=='request_id_not_event_time'||!sameTeacherScope(this.scope,page as unknown as TeacherActionScope)||!Array.isArray(page.rows)||page.rows.length>20)throw Error('source_history_scope_conflict');
    const rows=page.rows.map(row=>this.validate(row));
    if(rows.some(row=>row.status==='not_found')||new Set(rows.map(row=>row.requestId)).size!==rows.length||page.nextCursor!==null&&(rows.length!==20||page.nextCursor!==rows.at(-1)!.requestId))throw Error('source_history_scope_conflict');
    return {rows,nextCursor:page.nextCursor as string|null};
  }
  async recover():Promise<SourceRefreshReply|null>{
    if(this.original)return this.settle(this.validate(await this.readResult(this.original.requestId),this.original));
    const pending=await this.readPending();
    if(pending!==null){
      const reply=this.validate(pending);this.original={requestId:reply.requestId,studentId:reply.studentId,...(reply.date?{date:reply.date}:{})};
      return this.settle(this.validate(await this.readResult(reply.requestId),this.original));
    }
    return null;
  }
  private async run(studentId:string|null,date?:string):Promise<SourceRefreshReply>{
    if(date!==undefined&&!validDate(date))throw Error('invalid_refresh_date');
    const recovered=await this.recover();if(recovered)return recovered;
    const input={studentId,requestId:crypto.randomUUID(),...(date?{date}:{})};this.original=input;
    let response:unknown;
    try{response=await this.send(input);}catch{return this.settle(this.validate(await this.readResult(input.requestId),input));}
    return this.settle(this.validate(response,input,true));
  }
  refresh(studentId:string|null,date?:string):Promise<SourceRefreshReply>{
    if(this.flight)return this.flight;
    this.flight=this.run(studentId,date).finally(()=>{this.flight=null;});return this.flight;
  }
}
