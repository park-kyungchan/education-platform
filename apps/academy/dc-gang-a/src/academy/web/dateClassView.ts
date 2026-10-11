import type {DateClassPreparation,DateClassRow} from '../contracts/teacherOperations';
export type {DateClassPreparation,DateClassRow} from '../contracts/teacherOperations';
export function occurrenceIdentity(row:Pick<DateClassRow,'studentId'|'occurrence'>){return JSON.stringify([row.studentId,row.occurrence.date,row.occurrence.groupId,row.occurrence.courseKey,row.occurrence.recordKey,row.occurrence.membershipKey]);}
export function dateClassView(source: DateClassPreparation, requestedDate: string, students: readonly { id: string; displayName: string }[]) {
  if(source.kind!=='date_class_preparation'||source.date!==requestedDate)throw Error('date_scene_scope_conflict');
  if(source.rowCount!==source.rows.length)throw Error('date_scene_count_conflict');
  const cohort=new Map(students.map(student=>[student.id,student.displayName])),identities=new Set<string>();
  for(const row of source.rows){
    if(typeof row.studentId!=='string'||!cohort.has(row.studentId)||typeof row.studentName!=='string'||cohort.get(row.studentId)!==row.studentName)throw Error('date_scene_student_conflict');
    if(row.occurrence.date!==requestedDate)throw Error('date_scene_scope_conflict');
    const identity=occurrenceIdentity(row);
    if(identities.has(identity))throw Error('duplicate_lesson_occurrence');identities.add(identity);
  }
  return { date: requestedDate, rows: source.rows, occurrenceCount: source.rows.length, studentCount: new Set(source.rows.map(row => row.studentId)).size,
    completeRoster: source.knowledge.completeCurrentRoster, scope: source.scope };
}
/** Local UI response ordering, not a native Session/Task or domain-state owner. */
export function requestGate(){let sequence=0;return {begin:()=>++sequence,current:(ticket:number)=>ticket===sequence,snapshot:()=>sequence};}
