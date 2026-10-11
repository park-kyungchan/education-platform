import {expect,test} from 'bun:test';
import {bindStudentCourseRow,createStudentCourseRequest,readStudentCourses} from '../../src/lms/studentCourseRead';

const request=()=>({teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student'});
const row=()=>({cells:['Invented Student','Invented course','2099-01-01','2099-12-31','Source status','Control','Control'],
  handlers:['onChangeStatus(1,5101,9101,6101,7101);','onResetCourse(6101,9101,5101);','onDeleteCourse(5101,9101,6101,7101);']});

test('binds a course row through three independent passive literal tuples without invoking mutations',()=>{
  const bound=bindStudentCourseRow(row(),request());
  expect(bound.identity).toEqual({sourceNamespace:'academy_student_course',studentKey:'9101',collegeKey:'5101',courseKey:'6101',userCourseKey:'7101'});
  expect(bound.sourceCells).toEqual(row().cells);
  expect(bound.coverage).toBe('observed_row_not_all_assignments_or_pagination');
  expect(bound.handlersInvoked).toBe(false);
});

test('the observed started-row variant binds status/delete without inventing a missing reset control',()=>{
 const started={cells:['Invented grade','Invented Teacher','Invented Student','Invented course','Invented version','시작됨','Controls'],handlers:['onChangeStatus(0,5101,9101,6101,7101);','onDeleteCourse(5101,9101,6101,7101);']};
 expect(bindStudentCourseRow(started,request()).identity).toEqual({sourceNamespace:'academy_student_course',studentKey:'9101',collegeKey:'5101',courseKey:'6101',userCourseKey:'7101'});
 for(const bad of [{...started,cells:started.cells.map((cell,index)=>index===5?'진행중':cell)},{...started,cells:started.cells.map((cell,index)=>index===1?'Foreign Teacher':cell)},{...started,handlers:['onChangeStatus(1,5101,9101,6101,7101);',started.handlers[1]!]},{...started,handlers:[started.handlers[0]!,'onDeleteCourse(5101,9101,6101,7102);']}])expect(()=>bindStudentCourseRow(bad,request())).toThrow();
});

test('rejects foreign students, mismatched tuple identities and executable handler tails',()=>{
  for(const bad of [
    {...row(),handlers:['onChangeStatus(1,5101,9102,6101,7101);',...row().handlers.slice(1)]},
    {...row(),handlers:[row().handlers[0],'onResetCourse(6102,9101,5101);',row().handlers[2]]},
    {...row(),handlers:[row().handlers[0]+'save();',...row().handlers.slice(1)]},
    {...row(),handlers:[row().handlers[0],row().handlers[0],...row().handlers.slice(1)]},
  ])expect(()=>bindStudentCourseRow(bad,request())).toThrow();
});

test('literal request and native origin checks refuse malformed/secret-bearing inputs before network',async()=>{
  for(const bad of [{...request(),studentKey:'09101'},{...request(),cookie:'synthetic_marker'},{...request(),studentName:''}])expect(()=>createStudentCourseRequest(bad)).toThrow();
  let calls=0;
  await expect(readStudentCourses(request(),{origin:'https://foreign.example',authenticatedTeacherVisible:true,
    fetcher:async()=>{calls++;throw Error('not_called')}})).rejects.toThrow('authentication_required');
  expect(calls).toBe(0);
});
