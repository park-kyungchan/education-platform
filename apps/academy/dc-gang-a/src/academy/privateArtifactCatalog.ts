import {constants} from 'node:fs';
import {open,type FileHandle} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalJson,assertExactKeys} from '../learning/model';
import {createPrivateArtifactReader,type ReconciledPrivateArtifact} from './privateArtifacts';
import type {TrustedTeacherContext} from './contracts/teacherOperations';

const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const selector=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(value);
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export type PreservedArtifactEntry=Omit<ReconciledPrivateArtifact,'reconciliationReceiptSha256'> & {availability:'available'|'missing'|'withdrawn'};
export interface PrivateArtifactCatalogConfiguration {
 root:string;uid:number;ownerId:string;indexSha256:string;acceptedCustodyReceiptSha256:string;
 studentIsOwned:(ownerId:string,studentId:string)=>Promise<boolean>;
}
export interface PrivateArtifactList {
 state:'ready'|'not_configured'|'held';sourceIdentity:'unverified_preservation';
 artifacts:{id:string;filename:string;mime:string;bytes:number;sha256:string;studentId:string|null;availability:'available'|'missing'|'withdrawn'|'held'}[];
}
export interface PrivateArtifactAccess {
 list(context:TrustedTeacherContext):Promise<PrivateArtifactList>;
 read(context:TrustedTeacherContext,id:string):ReturnType<ReturnType<typeof createPrivateArtifactReader>['read']>;
}

/** Private operational metadata only. The caller supplies the fixed owner root. */
export async function readPrivateArtifactControl(root:string,name:string,uid:number,cap:number){
 if(!isAbsolute(root)||resolve(root)!==root||!/^[-a-z0-9]+\.json$/.test(name)||!Number.isSafeInteger(uid)||uid<0||!Number.isSafeInteger(cap)||cap<1||cap>2*1024*1024)throw Error('invalid_private_control_scope');
 let directory:FileHandle|undefined,file:FileHandle|undefined;
 try{
  directory=await open('/',constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  for(const part of root.split('/').slice(1)){
   const next=await open('/proc/self/fd/'+directory.fd+'/'+part,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   await directory.close();directory=next;
  }
  const ds=await directory.stat();if(ds.uid!==uid||(ds.mode&0o077)!==0)throw Error('private_control_storage_refused');
  file=await open('/proc/self/fd/'+directory.fd+'/'+name,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const before=await file.stat();
  if(!before.isFile()||before.uid!==uid||before.nlink!==1||(before.mode&0o077)!==0||before.size<1||before.size>cap)throw Error('private_control_storage_refused');
  const bytes=Buffer.alloc(before.size+1);let length=0;
  while(length<bytes.length){const part=await file.read(bytes,length,bytes.length-length,null);if(!part.bytesRead)break;length+=part.bytesRead;}
  const after=await file.stat();
  if(length!==before.size||before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs||before.uid!==after.uid||before.mode!==after.mode||before.nlink!==after.nlink)throw Error('private_control_changed');
  return bytes.subarray(0,length);
 }finally{await file?.close();await directory?.close();}
}

export function createPrivateArtifactCatalog(config:PrivateArtifactCatalogConfiguration):PrivateArtifactAccess {
 const {root,uid,ownerId,indexSha256,acceptedCustodyReceiptSha256,studentIsOwned}=config;
 if(!isAbsolute(root)||resolve(root)!==root||!Number.isSafeInteger(uid)||uid<0||!selector(ownerId)||!digest(indexSha256)||!digest(acceptedCustodyReceiptSha256)||typeof studentIsOwned!=='function')throw Error('invalid_private_artifact_catalog_configuration');
 const contextScope=(context:TrustedTeacherContext)=>{canonicalJson(context);if(context.ownerId!==ownerId||context.role!=='teacher'||!selector(context.actorId))throw Error('owner_scope_conflict');};
 const entries=async()=>{
  const bytes=await readPrivateArtifactControl(root,'index.json',uid,2*1024*1024);
  if(hash(bytes)!==indexSha256)throw Error('private_artifact_catalog_changed');
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  assertExactKeys(value,['schema','ownerId','sourceIdentity','artifacts']);
  if(value.schema!=='academy.preserved-private-artifact-index.v1'||value.ownerId!==ownerId||value.sourceIdentity!=='unverified_preservation'||!Array.isArray(value.artifacts)||value.artifacts.length>128)throw Error('invalid_private_artifact_catalog');
  const result=value.artifacts as PreservedArtifactEntry[];const ids=new Set<string>();let totalBytes=0;
  for(const item of result){
   canonicalJson(item);assertExactKeys(item,['id','ownerId','studentId','sourceRecordId','mime','filename','bytes','sha256','archivePath','availability']);
   if(!selector(item.id)||ids.has(item.id)||item.ownerId!==ownerId||item.studentId!==null&&!selector(item.studentId)||!selector(item.sourceRecordId)||!digest(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>50*1024*1024||typeof item.filename!=='string'||!item.filename.trim()||item.filename.length>200||/[\u0000-\u001f\u007f/\\]/u.test(item.filename)||!['application/json','application/pdf','image/png','image/jpeg','video/mp4','video/webm','text/plain'].includes(item.mime)||typeof item.archivePath!=='string'||!['available','missing','withdrawn'].includes(item.availability))throw Error('invalid_private_artifact_catalog');
   ids.add(item.id);totalBytes+=item.bytes;if(totalBytes>128*1024*1024)throw Error('private_artifact_catalog_byte_cap');
  }
  return result;
 };
 const reader=(items:PreservedArtifactEntry[])=>createPrivateArtifactReader({root,uid,ownerId,acceptedReceiptSha256:[acceptedCustodyReceiptSha256],studentIsOwned,resolveArtifact:async(_owner,id)=>{
  const selected=items.find(x=>x.id===id);if(!selected||selected.availability!=='available')return null;
  const {availability,...metadata}=selected;return {...metadata,reconciliationReceiptSha256:acceptedCustodyReceiptSha256};
 }});
 return {
  async list(context){
   contextScope(context);const items=await entries(),bytes=reader(items),artifacts:PrivateArtifactList['artifacts']=[];
   for(const item of items){
    if(item.studentId!==null&&!await studentIsOwned(ownerId,item.studentId))throw Error('artifact_student_scope_conflict');
    let availability:PrivateArtifactList['artifacts'][number]['availability']=item.availability;
    if(availability==='available')try{await bytes.read(context,item.id);}catch{availability='held';}
    artifacts.push({id:item.id,filename:item.filename,mime:item.mime,bytes:item.bytes,sha256:item.sha256,studentId:item.studentId,availability});
   }
   return {state:'ready',sourceIdentity:'unverified_preservation',artifacts};
  },
  async read(context,id){contextScope(context);if(!selector(id))throw Error('invalid_artifact_selector');return reader(await entries()).read(context,id);}
 };
}

/** Separate optional custody configuration never changes existing owner/auth state. */
export async function loadPrivateArtifactCatalog(ownerDirectory:string,ownerId:string,studentIsOwned:PrivateArtifactCatalogConfiguration['studentIsOwned']):Promise<PrivateArtifactAccess>{
 const uid=process.getuid?.();if(uid===undefined)throw Error('native_private_uid_required');
 const held=(state:'not_configured'|'held'):PrivateArtifactAccess=>({
  async list(context){canonicalJson(context);if(context.ownerId!==ownerId||context.role!=='teacher'||!selector(context.actorId))throw Error('owner_scope_conflict');return {state,sourceIdentity:'unverified_preservation',artifacts:[]};},
  async read(context){canonicalJson(context);if(context.ownerId!==ownerId||context.role!=='teacher'||!selector(context.actorId))throw Error('owner_scope_conflict');throw Error('private_artifact_storage_unavailable');}
 });
 let bytes:Buffer;
 try{bytes=await readPrivateArtifactControl(ownerDirectory,'private-artifact-admission.json',uid,16384);}catch(error){return held((error as NodeJS.ErrnoException).code==='ENOENT'?'not_configured':'held');}
 try{
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  assertExactKeys(value,['schema','ownerId','archiveDirectory','indexSha256','acceptedCustodyReceiptSha256']);
  if(value.schema!=='academy.private-artifact-custody-configuration.v1'||value.ownerId!==ownerId||!digest(value.archiveDirectory))throw Error('invalid_private_custody_configuration');
  return createPrivateArtifactCatalog({root:resolve(ownerDirectory,'private-archive',value.archiveDirectory),uid,ownerId,indexSha256:value.indexSha256,acceptedCustodyReceiptSha256:value.acceptedCustodyReceiptSha256,studentIsOwned});
 }catch{return held('held');}
}
