import { createAcademySourceAudit } from '../lms/academySourceAudit';
import { readInputRecord, readLiteralKey, readLiteralName } from '../lms/academyReadProtocol';
import { stableId, requireText } from '../learning/model';
import { validateAcademyRecord, type SourceAuditRecord, type SourceBookRegistration } from './records';
import type { StoredStudent } from './contracts/storageRecords';

export interface PlannedSourceEvidence {
  readonly studentId:string;
  readonly entityId:string;
  readonly sourceObservedAt:string;
  readonly payload:SourceAuditRecord;
}
/** Pure intake planning. The native acquisition witness and trusted operator remain the ingress owners. */
export function planTextbookEvidence(ownerId:string,students:readonly StoredStudent[],books:readonly SourceBookRegistration[],snapshots:readonly unknown[]):PlannedSourceEvidence[] {
  requireText(ownerId,'source owner');
  const byKey=new Map(students.filter(student=>student.ownerId===ownerId&&student.sourceKey.namespace==='academy_student').map(student=>[student.sourceKey.literalKey,student]));
  for(const book of books)validateAcademyRecord(book);
  const result:PlannedSourceEvidence[]=[];
  const identities=new Set<string>();
  for(const snapshot of snapshots){
    const audit=createAcademySourceAudit(snapshot);
    if(audit.content.sourceNamespace!=='academy_textbook')throw Error('textbook_source_required');
    const source=readInputRecord(snapshot);
    for(const raw of source.records as unknown[]){
      const record=readInputRecord(raw),student=byKey.get(readLiteralKey(record.studentKey));
      if(!student||student.displayName!==readLiteralName(record.studentName))throw Error('source_student_binding_conflict');
      const courseKey=readLiteralKey(record.courseKey),bookNo=readLiteralKey(record.bookNo);
      if(!books.some(book=>book.sourceStudent.literalKey===student.sourceKey.literalKey&&book.sourceCourse.literalKey===courseKey&&book.sourceBook.literalKey===bookNo))throw Error('source_book_binding_conflict');
      const acquisition={schemaVersion:1,family:'textbook',status:'observed',records:[record],dailyResults:[],dayRecords:[],observedAt:source.observedAt,coverage:source.coverage,unknownStates:source.unknownStates,nativePrintInvoked:false,automaticRetryAllowed:false};
      createAcademySourceAudit(acquisition);
      const entityId=stableId('entity','academy_textbook',student.id,courseKey,bookNo,readLiteralKey(record.paperKey),readLiteralKey(record.attemptKey));
      if(identities.has(entityId))throw Error('duplicate_source_evidence_identity');
      identities.add(entityId);
      result.push({studentId:student.id,entityId,sourceObservedAt:source.observedAt as string,
        payload:{kind:'source_audit',acquisition,contractRef:'docs/academy-deterministic-read-contract.ts#sourceContracts/textbook'}});
    }
  }
  return result;
}

/** Official source fields are evidence, not teacher finalization or a course-namespace alias. */
export function planDayRecordEvidence(ownerId:string,teacherKey:string,students:readonly StoredStudent[],snapshots:readonly unknown[]):PlannedSourceEvidence[]{
  requireText(ownerId,'source owner');readLiteralKey(teacherKey);
  const byKey=new Map(students.filter(student=>student.ownerId===ownerId&&student.sourceKey.namespace==='academy_student').map(student=>[student.sourceKey.literalKey,student]));
  const result:PlannedSourceEvidence[]=[],identities=new Set<string>();
  for(const snapshot of snapshots){
    const audit=createAcademySourceAudit(snapshot),source=readInputRecord(snapshot);
    if(audit.content.sourceNamespace!=='academy_dayrecord'||source.status!=='observed')throw Error('verified_dayrecord_source_required');
    const scope=readInputRecord(source.requestedScope);
    for(const raw of source.dayRecords as unknown[]){
      const row=readInputRecord(raw),student=byKey.get(readLiteralKey(row.studentKey));
      if(!student||student.displayName!==readLiteralName(row.studentName))throw Error('source_student_binding_conflict');
      if(row.teacherKey!==teacherKey)throw Error('source_principal_conflict');
      const entityId=stableId('entity','academy_dayrecord',student.id,readLiteralName(row.date),readLiteralKey(row.groupId),readLiteralKey(row.courseKey),readLiteralKey(row.recordKey),readLiteralKey(row.membershipKey));
      if(identities.has(entityId))throw Error('duplicate_source_evidence_identity');identities.add(entityId);
      const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[row],requestedScope:{family:'day_record',teacherLabel:scope.teacherLabel,date:row.date,groupIds:[row.groupId],studentNames:[row.studentName]},observedAt:source.observedAt,coverage:source.coverage,unknownStates:source.unknownStates,nativePrintInvoked:false,automaticRetryAllowed:false};
      createAcademySourceAudit(acquisition);
      result.push({studentId:student.id,entityId,sourceObservedAt:source.observedAt as string,payload:{kind:'source_audit',acquisition,contractRef:'docs/academy-dayrecord-column-qualification-2026-10-04.json'}});
    }
  }
  return result;
}
