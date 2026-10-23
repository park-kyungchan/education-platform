import {loadTeacherSource,type TeacherSourceBinding} from '../src/teacher-source-binding.ts';
import {resolve} from 'node:path';
// Prepared by the integrated setup from the immutable local ancestor; no host fallback.
export const sourceRoot=resolve(import.meta.dir,'../../../../..','.private/academy-teacher-fixture');
/** Invented canonical-owner test fixture only; no production server/CLI, DB or original loader. */
export async function teacherFixture(noteCount=20){
  const binding=await loadTeacherSource(sourceRoot);
  const {retainedFixture}=await import(sourceRoot+'/apps/academy/dc-gang-a/tests/academy/retainedQueryFixtures.ts');
  const source=retainedFixture(1,noteCount);
  return {source,binding,selector:{kind:'student' as const,studentId:source.student.id,date:source.date},
    fetchPage:(request:unknown)=>source.app.retainedQuery(source.actor,request)};
}
export function trackBinding(binding:TeacherSourceBinding){
  let reads=0;
  return {binding:{...binding,assertCurrent:async()=>{reads++;await binding.assertCurrent();}},reads:()=>reads};
}
