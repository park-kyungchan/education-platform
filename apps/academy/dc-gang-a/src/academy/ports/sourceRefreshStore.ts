import type {NormalizedCohort} from '../sourceBridge';
import type {CurrentRecord,StoredStudent} from '../contracts/storageRecords';
import type {SourceApplyResult,SourceAreaTask,SourceRequestHistory,SourceRequestReceipt,SourceRequestResult} from '../contracts/sourceRequests';
/** Durable source request/area outcomes; no credential or transport implementation is exposed. */
export interface SourceRefreshStore {
  students(ownerId:string):Promise<StoredStudent[]>;
  current(ownerId:string,studentId:string):Promise<CurrentRecord[]>;
  admitSourceRequest(ownerId:string,actorId:string,studentId:string|null,requestId:string,sync?:{date:string;tasks:SourceAreaTask[]}):Promise<{created:boolean;receipt:SourceRequestReceipt}>;
  applySourceRefresh(cohort:NormalizedCohort,actorId:string,requestId:string):Promise<SourceApplyResult>;
  finishSourceRequest(ownerId:string,actorId:string,requestId:string,status:'blocked'|'failed',reason:string):Promise<void>;
  pendingSourceRequest(ownerId:string,actorId:string):Promise<SourceRequestResult|null>;
  sourceRequestHistory(ownerId:string,actorId:string,cursor?:string|null):Promise<SourceRequestHistory>;
  sourceRequestResult(ownerId:string,actorId:string,requestId:string):Promise<SourceRequestResult>;
  applySourceArea(ownerId:string,actorId:string,requestId:string,taskId:string,outcome:{status:'observed';data:unknown}|{status:'blocked'|'failed';reason:string}):Promise<{status:'applied';result:SourceRequestResult}|{status:'pending'}>;
  finishSourceAreas(ownerId:string,actorId:string,requestId:string):Promise<SourceRequestResult>;
}
