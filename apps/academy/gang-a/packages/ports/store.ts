import type {StudentId,Sha256} from '../domain/ids.ts';
import type {StudentState} from '../application/refresh-student.ts';
/** Implementations must compare the revision before an atomic selected-student write. */
export interface StudentStore {read(studentId:StudentId):Promise<StudentState|null>;compareAndAppend(studentId:StudentId,expectedRevision:Sha256,next:StudentState):Promise<{kind:'appended'}|{kind:'revision_conflict'}>;}
