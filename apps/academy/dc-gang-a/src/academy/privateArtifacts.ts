import {constants} from 'node:fs';
import {open,type FileHandle} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalJson,assertExactKeys,requireText} from '../learning/model';
import type {TrustedTeacherContext} from './contracts/teacherOperations';

export interface ReconciledPrivateArtifact {
 id:string;ownerId:string;studentId:string|null;sourceRecordId:string;
 mime:'application/json'|'application/pdf'|'image/png'|'image/jpeg'|'video/mp4'|'video/webm'|'text/plain';
 filename:string;bytes:number;sha256:string;archivePath:string;reconciliationReceiptSha256:string;
}
export interface PrivateArtifactOwner {
 root:string;uid:number;ownerId:string;acceptedReceiptSha256:readonly string[];maxBytes?:number;
 /** Existing authenticated product store resolves identifiers; request bodies never supply metadata. */
 resolveArtifact:(ownerId:string,artifactId:string)=>Promise<ReconciledPrivateArtifact|null>;
 studentIsOwned:(ownerId:string,studentId:string)=>Promise<boolean>;
}
const sha=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
const selector=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(value);
const hex=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function matchesMime(bytes:Buffer,mime:ReconciledPrivateArtifact['mime']){
 if(mime==='application/json')try{JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return true;}catch{return false;}
 if(mime==='application/pdf')return bytes.subarray(0,5).toString('ascii')==='%PDF-';
 if(mime==='image/png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==='video/mp4')return bytes.length>=12&&bytes.subarray(4,8).toString('ascii')==='ftyp';
 if(mime==='video/webm')return bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]));
 if(mime==='text/plain')try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text);}catch{return false;}
 return false;
}
function refusal(code:string){return Object.assign(Error(code),{privateArtifactRefusal:true});}
/** Private byte reads only. Authentication and factual reconciliation remain with existing owners. */
export function createPrivateArtifactReader(config:PrivateArtifactOwner){
 const {root,uid,ownerId,resolveArtifact,studentIsOwned}=config,maxBytes=config.maxBytes??50*1024*1024;
 const receipts=new Set(config.acceptedReceiptSha256);
 if(!isAbsolute(root)||resolve(root)!==root||!Number.isSafeInteger(uid)||uid<0||!selector(ownerId)||
  !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>128*1024*1024||receipts.size>100000||
  [...receipts].some(value=>!hex(value))||typeof resolveArtifact!=='function'||typeof studentIsOwned!=='function')throw Error('invalid_private_artifact_configuration');
 return {async read(context:TrustedTeacherContext,artifactId:string){
  canonicalJson(context);
  if(context.ownerId!==ownerId||context.role!=='teacher'||!selector(context.actorId))throw Error('owner_scope_conflict');
  if(!selector(artifactId))throw Error('invalid_artifact_selector');
  let metadata:ReconciledPrivateArtifact|null;
  try{metadata=await resolveArtifact(ownerId,artifactId);}catch{throw Error('private_artifact_lookup_failed');}
  if(metadata===null)throw Error('private_artifact_not_found');
  // Copy source-store values before asynchronous filesystem work; never invoke accessors.
  metadata=JSON.parse(canonicalJson(metadata)) as ReconciledPrivateArtifact;
  assertExactKeys(metadata,['id','ownerId','studentId','sourceRecordId','mime','filename','bytes','sha256','archivePath','reconciliationReceiptSha256']);
  if(metadata.id!==artifactId||metadata.ownerId!==ownerId||!selector(metadata.sourceRecordId)||
   metadata.studentId!==null&&!selector(metadata.studentId)||!hex(metadata.sha256)||!hex(metadata.reconciliationReceiptSha256)||
   !receipts.has(metadata.reconciliationReceiptSha256))throw Error('artifact_reconciliation_required');
  if(metadata.studentId!==null){
   let owned:boolean;try{owned=await studentIsOwned(ownerId,metadata.studentId);}catch{throw Error('artifact_student_scope_unavailable');}
   if(!owned)throw Error('artifact_student_scope_conflict');
  }
  if(!Number.isSafeInteger(metadata.bytes)||metadata.bytes<1||metadata.bytes>maxBytes)throw Error('artifact_size_refused');
  requireText(metadata.filename,'artifact filename');
  if(metadata.filename.length>200||/[\u0000-\u001f\u007f/\\]/u.test(metadata.filename))throw Error('invalid_artifact_filename');
  const extensions:Record<ReconciledPrivateArtifact['mime'],RegExp>={'application/json':/\.json$/i,'application/pdf':/\.pdf$/i,'image/png':/\.png$/i,'image/jpeg':/\.jpe?g$/i,'video/mp4':/\.mp4$/i,'video/webm':/\.webm$/i,'text/plain':/\.txt$/i};
  if(!Object.hasOwn(extensions,metadata.mime)||!extensions[metadata.mime].test(metadata.filename))throw Error('artifact_filename_mime_conflict');
  if(typeof metadata.archivePath!=='string'||metadata.archivePath.length>1024||/[\u0000-\u001f\u007f\\:?#]/u.test(metadata.archivePath))throw Error('invalid_artifact_path');
  const parts=metadata.archivePath.split('/');
  if(parts.length>32||parts.some(part=>!part||part==='.'||part==='..'||part.length>200))throw Error('invalid_artifact_path');
  let directory:FileHandle|undefined,file:FileHandle|undefined;
  try{
   directory=await open('/',constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
   for(const part of root.split('/').slice(1)){
    const next=await open('/proc/self/fd/'+directory.fd+'/'+part,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    await directory.close();directory=next;
   }
   const privateDirectory=async()=>{const stat=await directory!.stat();if(stat.uid!==uid||(stat.mode&0o077)!==0)throw refusal('private_artifact_storage_refused');};
   await privateDirectory();
   for(const part of parts.slice(0,-1)){
    const next=await open('/proc/self/fd/'+directory.fd+'/'+part,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    await directory.close();directory=next;await privateDirectory();
   }
   file=await open('/proc/self/fd/'+directory.fd+'/'+parts.at(-1),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   const before=await file.stat();
   if(!before.isFile()||before.nlink!==1||before.uid!==uid||(before.mode&0o077)!==0||before.size!==metadata.bytes)throw refusal('private_artifact_storage_refused');
   const buffer=Buffer.alloc(metadata.bytes+1);let length=0;
   while(length<buffer.length){const part=await file.read(buffer,length,buffer.length-length,null);if(!part.bytesRead)break;length+=part.bytesRead;}
   const after=await file.stat(),body=buffer.subarray(0,length);
   if(length!==metadata.bytes||before.dev!==after.dev||before.ino!==after.ino||before.nlink!==after.nlink||
    before.uid!==after.uid||before.mode!==after.mode||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs||sha(body)!==metadata.sha256)throw refusal('artifact_integrity_conflict');
   if(!matchesMime(body,metadata.mime))throw refusal('artifact_mime_refused');
   return Object.freeze({id:artifactId,mime:metadata.mime,filename:metadata.filename,bytes:length,sha256:metadata.sha256,body,
    headers:Object.freeze({'Content-Type':metadata.mime,'Content-Length':String(length),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(metadata.filename).replace(/[!'()*]/g,character=>'%'+character.charCodeAt(0).toString(16).toUpperCase()),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}),
    sourceVerification:'resolver_owned_not_inferred_from_byte_parity' as const,sourceEffect:'none' as const});
  }catch(error){
   if(error instanceof Error&&Object.hasOwn(error,'privateArtifactRefusal'))throw error;
   throw Error('private_artifact_bytes_unavailable');
  }finally{await file?.close();await directory?.close();}
 }};
}
