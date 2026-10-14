import {assertExactKeys,canonicalJson,requireText} from '../../learning/model';
import {readInputRecord} from '../../lms/academyReadProtocol';
import type {TeacherStore} from '../ports/teacherStore';
import type {TrustedTeacherContext} from '../contracts/teacherOperations';
import {assertTeacherScope} from './requestRecovery';
import {TeacherWorkspaceRefusal,isTeacherWorkspaceRecord,validateTeacherWorkspace,workspaceEntityId,type TeacherWorkspaceRecord,type TeacherWorkspaceInput,type TeacherOperationalCase} from '../teacherWorkspace';
import {asStudentWorkspace,ownerWorkspaceEntityId,validateOwnerWorkspace,type OwnerWorkspaceStore,type OwnerWorkspaceRecord} from '../ownerWorkspaceStore';
import {createExamCandidate,type ExamCandidateBody} from '../examSelection';
import {academyOperatingCatalog,academyOperatingSelection} from '../operatingWorkspace';

async function prepareWorkspaceInput<T>(prepare:()=>T|Promise<T>):Promise<T>{try{return await prepare();}catch(error){throw new TeacherWorkspaceRefusal(error instanceof Error?error.message:'invalid_workspace_input','intake');}}
/** One authenticated facade; adapters recheck all mutable record bindings under their transaction lock. */
export class TeacherWorkspaceCommands {
 constructor(readonly store:TeacherStore,readonly ownerId:string){}
 private ownerStore():TeacherStore&OwnerWorkspaceStore {
  const store=this.store as TeacherStore&Partial<OwnerWorkspaceStore>;
  if(!store.appendOwnerWorkspace||!store.ownerWorkspaces||!store.ownerWorkspaceHistory||!store.ownerWorkspaceResult)throw Error('owner_workspace_storage_unavailable');return store as TeacherStore&OwnerWorkspaceStore;
 }
 async save(context:TrustedTeacherContext,input:unknown){
  const {data,student,payload}=await prepareWorkspaceInput(async()=>{
  assertTeacherScope(this.ownerId,context);const data=readInputRecord(input);canonicalJson(data);assertExactKeys(data,['studentId','expectedRevisionId','idempotencyKey','reportedAt','payload']);
  for(const field of ['studentId','idempotencyKey','reportedAt']){requireText(data[field] as string,'workspace input');if(typeof data[field]!=='string'||(data[field] as string).length>200)throw Error('invalid_workspace_input');}
  if(!(data.expectedRevisionId===null||typeof data.expectedRevisionId==='string'&&data.expectedRevisionId.length>0&&data.expectedRevisionId.length<=200))throw Error('invalid_workspace_input');
  const student=(await this.store.students(this.ownerId)).find(row=>row.id===data.studentId);if(!student)throw Error('student_scope_conflict');
  const raw=readInputRecord(data.payload);if(Object.hasOwn(raw,'sourceStudent')||Object.hasOwn(raw,'reportedAt')||Object.hasOwn(raw,'studentBinding'))throw Error('unexpected_workspace_attribution');
  const payload={...raw,studentBinding:{studentId:student.id,sourceStudent:student.sourceKey},sourceStudent:student.sourceKey,reportedAt:data.reportedAt} as unknown as TeacherWorkspaceRecord;
  if(!isTeacherWorkspaceRecord(payload))throw Error('unsupported_teacher_workspace');validateTeacherWorkspace(payload);return {data,student,payload};});
  const store=this.ownerStore(),receipt=await store.appendOwnerWorkspace({ownerId:this.ownerId,actorId:context.actorId,idempotencyKey:data.idempotencyKey as string,expectedRevisionId:data.expectedRevisionId as string|null,payload});
  let record;try{const [stored]=await store.ownerWorkspaceHistory(this.ownerId,workspaceEntityId(payload),receipt.sequence-1);if(!stored||stored.revisionId!==receipt.revisionId)throw Error('committed_outcome_uncertain');record=asStudentWorkspace(stored,student.id);}catch{throw Error('committed_outcome_uncertain');}
  return {...receipt,record};
 }
 async result(context:TrustedTeacherContext,studentId:string,requestId:string){
  assertTeacherScope(this.ownerId,context);this.selector(studentId);this.selector(requestId);if(!(await this.store.students(this.ownerId)).some(row=>row.id===studentId))throw Error('student_scope_conflict');
  const stored=await this.ownerStore().ownerWorkspaceResult(this.ownerId,context.actorId,requestId);if(!stored||!isTeacherWorkspaceRecord(stored.payload)||stored.payload.studentBinding.studentId!==studentId)throw Error('workspace_result_not_found');const record=asStudentWorkspace(stored,studentId);return {status:'recorded',record,revisionId:record.revisionId,officialSaved:false,parentSent:false};
 }
 async history(context:TrustedTeacherContext,studentId:string,entityId:string,afterSequence=0){
  assertTeacherScope(this.ownerId,context);this.selector(studentId);this.selector(entityId);if(!(await this.store.students(this.ownerId)).some(row=>row.id===studentId))throw Error('student_scope_conflict');
  const stored=await this.ownerStore().ownerWorkspaceHistory(this.ownerId,entityId,afterSequence);const rows=stored.map(row=>asStudentWorkspace(row,studentId));return {rows,nextAfterSequence:rows.length===200?rows.at(-1)!.sequence:null,officialSaved:false,parentSent:false};
 }
 async operatingCatalog(context:TrustedTeacherContext){assertTeacherScope(this.ownerId,context);return academyOperatingCatalog();}
 async operatingSelection(context:TrustedTeacherContext,policyIds:string[],revision:string){assertTeacherScope(this.ownerId,context);return academyOperatingSelection(policyIds,revision);}
 async saveOwner(context:TrustedTeacherContext,input:unknown){
  const {data,payload}=await prepareWorkspaceInput(()=>{
  assertTeacherScope(this.ownerId,context);const data=readInputRecord(input);assertExactKeys(data,['expectedRevisionId','idempotencyKey','payload']);
  this.selector(data.idempotencyKey);if(!(data.expectedRevisionId===null||typeof data.expectedRevisionId==='string'&&data.expectedRevisionId.length>0&&data.expectedRevisionId.length<=200))throw Error('invalid_workspace_input');
  const payload=readInputRecord(data.payload) as unknown as OwnerWorkspaceRecord;if(!['teacher_operational_case','teacher_exam_selection_draft'].includes(payload.kind))throw Error('unsupported_owner_workspace');validateOwnerWorkspace(payload);return {data,payload};});
  const store=this.ownerStore(),receipt=await store.appendOwnerWorkspace({ownerId:this.ownerId,actorId:context.actorId,idempotencyKey:data.idempotencyKey as string,expectedRevisionId:data.expectedRevisionId as string|null,payload});
  let record;try{const [stored]=await store.ownerWorkspaceHistory(this.ownerId,ownerWorkspaceEntityId(payload),receipt.sequence-1);if(!stored||stored.revisionId!==receipt.revisionId)throw Error('committed_outcome_uncertain');record=stored;}catch{throw Error('committed_outcome_uncertain');}return {...receipt,record};
 }
 async projectExamCandidate(context:TrustedTeacherContext,input:unknown){assertTeacherScope(this.ownerId,context);return {candidate:createExamCandidate(readInputRecord(input) as unknown as ExamCandidateBody),sourceQualification:'not_verified_by_workspace' as const};}
 async ownerCurrent(context:TrustedTeacherContext){assertTeacherScope(this.ownerId,context);return {rows:(await this.ownerStore().ownerWorkspaces(this.ownerId)).filter(row=>!isTeacherWorkspaceRecord(row.payload)),officialSaved:false,parentSent:false};}
 async ownerHistory(context:TrustedTeacherContext,entityId:string,afterSequence=0){assertTeacherScope(this.ownerId,context);this.selector(entityId);return {rows:await this.ownerStore().ownerWorkspaceHistory(this.ownerId,entityId,afterSequence),officialSaved:false,parentSent:false};}
 async ownerResult(context:TrustedTeacherContext,requestId:string){assertTeacherScope(this.ownerId,context);this.selector(requestId);const record=await this.ownerStore().ownerWorkspaceResult(this.ownerId,context.actorId,requestId);if(!record)throw Error('workspace_result_not_found');return {status:'recorded',record,revisionId:record.revisionId,officialSaved:false,parentSent:false};}
 private selector(value:unknown):asserts value is string{if(typeof value!=='string'||!value.trim()||value.length>512)throw Error('invalid_workspace_input');}
}
