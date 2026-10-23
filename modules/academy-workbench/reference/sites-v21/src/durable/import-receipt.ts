import type {Append} from './durable-ledger.ts';
/** Backend verification still rereads all committed events. Only the wire response is compact. */
export function compactImportReceipt(result:any,input:Append,studentId:string,batch:string){
 if(!result||!['committed','replayed'].includes(result.status))return result;
 if(result.sourceMode!=='durable_d1'||result.durableReadVerified!==true||!Array.isArray(result.events)||!Number.isSafeInteger(result.revision)||!Number.isSafeInteger(result.committedRevision)||!/^[a-f0-9]{64}$/.test(result.headHash))throw Error('verified_import_receipt_required');
 return {schemaVersion:'academy.import-receipt/1.0.0',status:result.status,sourceMode:result.sourceMode,studentId,batch,revision:result.revision,committedRevision:result.committedRevision,headHash:result.headHash,durableReadVerified:true,hashChainVerified:true,readbackVerified:true,importSourceSha256:input.originalSource?.sha256??null,requestedEventCount:input.events.length,totalStudentEventCount:result.events.length,rawEventsReturned:false,liveLmsConnected:false,automaticPageSyncConnected:false};
}
