import type {StudentStore} from '../ports/store.ts';
import {StudentId,Sha256} from '../domain/ids.ts';
import {StudentState} from '../application/refresh-student.ts';
/** In-process fixture adapter only. No persistent or external store is created. */
export class InMemoryStudentStore implements StudentStore{
 private readonly states=new Map<StudentId,StudentState>();
 constructor(inputs:readonly unknown[]){for(const input of inputs){const state=StudentState.parse(input);if(this.states.has(state.studentId))throw Error('duplicate_student_id');this.states.set(state.studentId,structuredClone(state));}}
 async read(studentId:StudentId){const state=this.states.get(studentId);return state?structuredClone(state):null;}
 async compareAndAppend(studentId:StudentId,expectedRevision:Sha256,input:StudentState):Promise<{kind:'appended'}|{kind:'revision_conflict'}>{const current=this.states.get(studentId),next=StudentState.parse(input);if(next.studentId!==studentId)throw Error('store_student_namespace_mismatch');if(!current||current.revision!==expectedRevision)return {kind:'revision_conflict'};if(current.revision===next.revision)throw Error('store_revision_must_change');if(next.evidence.length<current.evidence.length||current.evidence.some((e,i)=>JSON.stringify(e)!==JSON.stringify(next.evidence[i])))throw Error('store_evidence_history_is_append_only');this.states.set(studentId,structuredClone(next));return {kind:'appended'};}
}
