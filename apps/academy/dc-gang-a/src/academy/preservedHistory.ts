import {createHash} from 'node:crypto';
import {canonicalJson,assertExactKeys} from '../learning/model';
import type {TrustedTeacherContext} from './contracts/teacherOperations';
import type {PrivateArtifactAccess} from './privateArtifactCatalog';
import type {ArchivedJson,PreservedDataset,PreservedSelection,ArchiveIdentity,PreservedHistoryIndex,PreservedHistoryPage,PreservedHistoryDetail} from './contracts/preservedHistory';

export const preservedNamespace='academy.sites.academy-rails-current.student';
const datasetId='preserved-portable-dataset',datasetCap=32*1024*1024,detailCap=2*1024*1024,pageSize=20;
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const object=(value:unknown):value is Record<string,any>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=2048):value is string=>typeof value==='string'&&value.length>0&&value.length<=max;
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const clock=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
function requireValue(value:unknown,code='preserved_dataset_invalid'):asserts value {if(!value)throw Error(code);}
function safeJson(value:unknown,depth=0,budget={nodes:0}){
 requireValue(depth<=40&&++budget.nodes<=1_000_000);
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'){requireValue(Number.isFinite(value));return;}
 if(Array.isArray(value)){requireValue(value.length<=50_000);for(const child of value)safeJson(child,depth+1,budget);return;}
 requireValue(object(value));for(const [key,child] of Object.entries(value)){requireValue(!['__proto__','constructor','prototype'].includes(key));safeJson(child,depth+1,budget);}
}
/** Validation preserves original order and raw values; it never resolves correction or identity claims. */
export function parsePreservedDataset(bytes:Uint8Array):PreservedDataset {
 requireValue(bytes.length>0&&bytes.length<=datasetCap,'preserved_dataset_size_refused');
 let value:any;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('preserved_dataset_invalid');}
 safeJson(value);requireValue(object(value));assertExactKeys(value,['schemaVersion','datasetId','ownerId','mode','createdAt','students','records','artifacts','projections']);
 requireValue(value.schemaVersion==='academy.portable-dataset/1'&&text(value.datasetId,128)&&text(value.ownerId,128)&&['private','synthetic'].includes(value.mode)&&clock(value.createdAt));
 requireValue(Array.isArray(value.students)&&value.students.length<=10_000&&Array.isArray(value.records)&&value.records.length<=50_000&&Array.isArray(value.artifacts)&&value.artifacts.length<=128&&Array.isArray(value.projections));
 const students=new Set<string>(),identities=new Set<string>(),records=new Map<string,any>(),artifacts=new Set<string>();
 for(const student of value.students){
  requireValue(object(student));assertExactKeys(student,['id','displayName','sourceIdentities']);requireValue(text(student.id,128)&&text(student.displayName,200)&&!students.has(student.id)&&Array.isArray(student.sourceIdentities));students.add(student.id);
  for(const identity of student.sourceIdentities){requireValue(object(identity));assertExactKeys(identity,['namespace','sourceId','verification','evidenceIds']);requireValue(identity.namespace===preservedNamespace&&text(identity.sourceId,512)&&['verified','unverified'].includes(identity.verification)&&Array.isArray(identity.evidenceIds)&&identity.evidenceIds.length>0&&identity.evidenceIds.every((id:unknown)=>text(id)), 'preserved_namespace_conflict');const key=JSON.stringify([identity.namespace,identity.sourceId]);requireValue(!identities.has(key));identities.add(key);}
 }
 for(const record of value.records){
  requireValue(object(record));assertExactKeys(record,['id','studentId','domain','kind','data','provenance','supersedes','retracts','conflicts']);
  requireValue(text(record.id,256)&&!records.has(record.id)&&(record.studentId===null||students.has(record.studentId))&&text(record.domain,128)&&text(record.kind,128));
  requireValue(Buffer.byteLength(JSON.stringify(record))<=detailCap,'preserved_record_size_refused');records.set(record.id,record);
  const p=record.provenance;requireValue(object(p));assertExactKeys(p,['sourceKind','sourceReference','sourceHash','sourceRevision','observedAt','reportedAt','occurredAt','recordedAt','originalTimeLabel','timePrecision','verification','completeness','queryScope','coverageWindow','pagination']);
  requireValue(['synthetic','source_snapshot','user_report','teacher_decision','derived_projection'].includes(p.sourceKind)&&text(p.sourceReference)&&(p.sourceHash===null||hash(p.sourceHash))&&(p.sourceRevision===null||text(p.sourceRevision))&&clock(p.recordedAt)&&['exact','date_only','year_unknown','unknown'].includes(p.timePrecision)&&['unverified','corroborated','contradicted'].includes(p.verification)&&['complete_within_scope','partial','unknown'].includes(p.completeness)&&text(p.queryScope));
  requireValue(['observedAt','reportedAt','occurredAt'].every(key=>p[key]===null||clock(p[key]))&&(p.originalTimeLabel===null||text(p.originalTimeLabel))&&object(p.coverageWindow)&&object(p.pagination));
  assertExactKeys(p.coverageWindow,['from','to']);assertExactKeys(p.pagination,['exhausted','pages']);requireValue([p.coverageWindow.from,p.coverageWindow.to].every(item=>item===null||typeof item==='string')&&[null,true,false].includes(p.pagination.exhausted)&&(p.pagination.pages===null||Number.isSafeInteger(p.pagination.pages)&&p.pagination.pages>=0));
  for(const key of ['supersedes','retracts','conflicts'])requireValue(Array.isArray(record[key])&&record[key].every((id:unknown)=>text(id)&&id!==record.id));
 }
 for(const record of value.records)for(const key of ['supersedes','retracts','conflicts'])for(const id of record[key])requireValue(records.has(id)&&records.get(id).studentId===record.studentId,'preserved_history_scope_conflict');
 for(const student of value.students)for(const identity of student.sourceIdentities)for(const id of identity.evidenceIds)requireValue(records.has(id)&&records.get(id).studentId===student.id,'preserved_history_scope_conflict');
 for(const artifact of value.artifacts){
  requireValue(object(artifact));assertExactKeys(artifact,['id','mime','filename','bytes','sha256','archivePath','sourceObjectId','acquiredAt','availability']);requireValue(text(artifact.id,256)&&!artifacts.has(artifact.id)&&text(artifact.mime,200)&&text(artifact.filename,512)&&(artifact.bytes===null||Number.isSafeInteger(artifact.bytes)&&artifact.bytes>=0)&&(artifact.sha256===null||hash(artifact.sha256))&&['available','missing','blocked','unverified'].includes(artifact.availability)&&(artifact.archivePath===null||text(artifact.archivePath))&&(artifact.sourceObjectId===null||text(artifact.sourceObjectId))&&(artifact.acquiredAt===null||clock(artifact.acquiredAt)));artifacts.add(artifact.id);
 }
 return value as PreservedDataset;
}

export function createPreservedHistoryReader(access:PrivateArtifactAccess,ownerId:string){
 const scope=(context:TrustedTeacherContext)=>{canonicalJson(context);if(context.ownerId!==ownerId||context.role!=='teacher'||!text(context.actorId,200))throw Error('owner_scope_conflict');};
 const load=async(context:TrustedTeacherContext)=>{
  scope(context);const artifact=await access.read(context,datasetId);scope(context);
  requireValue(artifact.id===datasetId&&artifact.mime==='application/json'&&artifact.bytes===artifact.body.length&&hash(artifact.sha256)&&sha(artifact.body)===artifact.sha256,'preserved_dataset_integrity_conflict');
  const dataset=parsePreservedDataset(artifact.body),identity:ArchiveIdentity={sourceIdentity:'unverified_preservation',namespace:preservedNamespace,snapshotSha256:artifact.sha256,datasetId:dataset.datasetId,archivedOwnerId:dataset.ownerId,createdAt:dataset.createdAt,currentStudentBinding:null,currentness:'unknown',correctionSemantics:'preserved_not_applied'};
  return {dataset,identity};
 };
 const selection=(dataset:PreservedDataset,input:PreservedSelection)=>{
  canonicalJson(input);assertExactKeys(input,input.scope==='student'?['namespace','scope','studentId']:['namespace','scope']);
  requireValue(input.namespace===preservedNamespace,'preserved_namespace_conflict');requireValue(input.scope==='owner'||input.scope==='student','preserved_selection_invalid');
  if(input.scope==='student')requireValue(text(input.studentId,128)&&dataset.students.some(student=>student.id===input.studentId),'preserved_student_scope_conflict');
  return dataset.records.filter(record=>record.studentId===(input.scope==='owner'?null:input.studentId));
 };
 const snapshot=(actual:string,requested:string)=>requireValue(hash(requested)&&requested===actual,'preserved_snapshot_conflict');
 return {
  async index(context:TrustedTeacherContext):Promise<PreservedHistoryIndex>{const {dataset,identity}=await load(context);return {...identity,students:dataset.students,ownerRecordCount:dataset.records.filter(record=>record.studentId===null).length,recordCount:dataset.records.length,projectionCount:dataset.projections.length,artifacts:dataset.artifacts,datasetDownload:'/api/private-artifact?id=preserved-portable-dataset'};},
  async page(context:TrustedTeacherContext,input:PreservedSelection,cursor:string|null,expectedSnapshot:string):Promise<PreservedHistoryPage>{
   const {dataset,identity}=await load(context),rows=selection(dataset,input);snapshot(identity.snapshotSha256,expectedSnapshot);let offset=0;
   if(cursor!==null){requireValue(typeof cursor==='string'&&cursor.length<=2048&&/^[A-Za-z0-9_-]+$/.test(cursor),'preserved_cursor_invalid');let value:any;try{value=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{throw Error('preserved_cursor_invalid');}requireValue(object(value),'preserved_cursor_invalid');assertExactKeys(value,['ownerId','snapshotSha256','selection','offset']);snapshot(identity.snapshotSha256,value.snapshotSha256);requireValue(value.ownerId===ownerId&&JSON.stringify(value.selection)===JSON.stringify(input)&&Number.isSafeInteger(value.offset)&&value.offset>0&&value.offset<rows.length,'preserved_cursor_scope_conflict');offset=value.offset;}
   const records:PreservedHistoryPage['records']=[];let pageBytes=0;
   for(const record of rows.slice(offset,offset+pageSize)){
    const summary={id:record.id,studentId:record.studentId,domain:record.domain,kind:record.kind,sourceKind:record.provenance.sourceKind,verification:record.provenance.verification,completeness:record.provenance.completeness,recordedAt:record.provenance.recordedAt,originalTimeLabel:record.provenance.originalTimeLabel,supersedes:record.supersedes,retracts:record.retracts,conflicts:record.conflicts},bytes=Buffer.byteLength(JSON.stringify(summary));
    requireValue(bytes<=256*1024,'preserved_summary_size_refused');if(records.length&&pageBytes+bytes>256*1024)break;records.push(summary);pageBytes+=bytes;
   }
   const nextOffset=offset+records.length;
   return {...identity,selection:input,total:rows.length,records,nextCursor:nextOffset<rows.length?Buffer.from(JSON.stringify({ownerId,snapshotSha256:identity.snapshotSha256,selection:input,offset:nextOffset})).toString('base64url'):null};
  },
  async detail(context:TrustedTeacherContext,input:PreservedSelection,recordId:string,expectedSnapshot:string):Promise<PreservedHistoryDetail>{const {dataset,identity}=await load(context);snapshot(identity.snapshotSha256,expectedSnapshot);requireValue(text(recordId,256),'preserved_record_selector_invalid');const record=selection(dataset,input).find(record=>record.id===recordId);requireValue(record,'preserved_record_scope_conflict');return {...identity,selection:input,record};},
  async artifact(context:TrustedTeacherContext,artifactId:string,expectedSnapshot:string){
   const {dataset,identity}=await load(context);snapshot(identity.snapshotSha256,expectedSnapshot);requireValue(text(artifactId,256),'preserved_artifact_selector_invalid');const original=dataset.artifacts.find(artifact=>artifact.id===artifactId);requireValue(original,'preserved_artifact_scope_conflict');requireValue(original.availability==='available'&&hash(original.sha256)&&Number.isSafeInteger(original.bytes),'preserved_artifact_unavailable');
   const list=await access.list(context);scope(context);requireValue(list.state==='ready','preserved_artifact_unavailable');
   const matches=list.artifacts.filter(item=>item.id!==datasetId&&item.studentId===null&&item.availability==='available'&&item.sha256===original.sha256&&item.bytes===original.bytes&&item.mime===original.mime);requireValue(matches.length===1,'preserved_artifact_custody_ambiguous');
   const result=await access.read(context,matches[0]!.id);scope(context);requireValue(result.sha256===original.sha256&&result.bytes===original.bytes&&result.mime===original.mime&&sha(result.body)===original.sha256,'preserved_artifact_integrity_conflict');
   requireValue(!/[\u0000-\u001f\u007f/\\]/u.test(original.filename),'preserved_artifact_filename_refused');
   return {...result,filename:original.filename,headers:{...result.headers,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(original.filename).replace(/[!'()*]/g,character=>'%'+character.charCodeAt(0).toString(16).toUpperCase())},archivedArtifactId:original.id,binding:'exact_archived_bytes_only_not_student_identity' as const};
  },
 };
}
