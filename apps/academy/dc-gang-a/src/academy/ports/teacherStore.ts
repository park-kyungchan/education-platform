import type {CatalogNode} from '../domain';
import type {AppendCommand,CurrentRecord,PinnedCatalogNode,RecordVersion,StoredStudent,WriteAcknowledgement} from '../contracts/storageRecords';
/** Scoped reads only; no driver, schema migration or generic connection access. */
export interface TeacherReadStore {
  students(ownerId:string):Promise<StoredStudent[]>;
  current(ownerId:string,studentId:string):Promise<CurrentRecord[]>;
  history(ownerId:string,studentId:string,entityId:string,afterSequence?:number,limit?:number):Promise<RecordVersion[]>;
  preparationRevisions(ownerId:string,studentId:string,date:string):Promise<RecordVersion[]>;
  catalog(ownerId:string):Promise<CatalogNode[]>;
  pinnedCatalog(ownerId:string,refs:readonly {nodeId:string;revisionId:string}[]):Promise<PinnedCatalogNode[]>;
  observationRequest(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
  observationResult(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
  clinicRequest(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
  clinicResult(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
}
/** Implementations enforce scope, current basis, CAS, original retention and outcome readback atomically. */
export interface TeacherStore extends TeacherReadStore {
  readSnapshot<T>(read:(store:TeacherReadStore)=>Promise<T>):Promise<T>;
  append(command:AppendCommand,recordedAt?:string):Promise<WriteAcknowledgement>;
}
