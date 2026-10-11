/** A displayed actor expectation is a concurrency condition, never authentication. */
export interface TeacherActionScope {readonly ownerId:string;readonly actorId:string}
export function sameTeacherScope(expected:TeacherActionScope,actual:TeacherActionScope):boolean{
  return expected.ownerId===actual.ownerId&&expected.actorId===actual.actorId;
}
export function teacherActionHeaders(scope:TeacherActionScope):Record<string,string>{
  for(const value of [scope.ownerId,scope.actorId])if(typeof value!=='string'||!value||value.length>200||/[\r\n]/.test(value))throw Error('invalid_teacher_action_scope');
  return {'X-Teacher-Owner':scope.ownerId,'X-Teacher-Actor':scope.actorId};
}
export function matchesTeacherActionHeaders(headers:Headers,authenticated:TeacherActionScope):boolean{
  return headers.get('X-Teacher-Owner')===authenticated.ownerId&&headers.get('X-Teacher-Actor')===authenticated.actorId;
}
