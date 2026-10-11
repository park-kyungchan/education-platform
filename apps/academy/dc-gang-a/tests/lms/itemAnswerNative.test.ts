import {expect,test} from 'bun:test';
import {runNativeAcademyRead} from '../../harness/native_read_entry';

const request={family:'item_answer',teacherLabel:'Invented teacher',teacherKey:'7001',lectureKeys:['8101'],answerReadAdmission:true};
const body={result:'OK',rows:[{id:'8101',lecture_key:'8101',outer_lecture_key:'8201',unit_name:'Invented unit',pat_name:'Invented pattern',play_seconds:0,difficulty:1,answer:'1|_|42'}]};
const route='/servlet/controller.coursemanage.CourseManageServlet';
async function exercise(options:{userPrincipal?:string;coursePrincipal?:string;password?:boolean;origin?:string;pathname?:string;search?:string;header?:string}={}){
  const names=['document','location','fetch','__academyItemAnswerRecovery'] as const;
  const prior=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const);
  let calls=0;
  try{
    Object.defineProperty(globalThis,'document',{configurable:true,value:{body:{innerText:options.header??'Different header layout [로그아웃]'},querySelector:(selector:string)=>selector==='input[type=password]'?(options.password?{}:null):selector==='form[name=userForm] [name=pri_no]'?{value:options.userPrincipal??'7001'}:selector==='form[name=form1] [name=g_pri_no]'?{value:options.coursePrincipal??'7001'}:null}});
    Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:options.origin??'https://dc.gang-a.kr',pathname:options.pathname??route,search:options.search??'?reqCmd=StudyCourse'}});
    Object.defineProperty(globalThis,'fetch',{configurable:true,value:async()=>{calls++;return Response.json(body);}});
    const result=await runNativeAcademyRead(request).catch(error=>({status:'refused',reason:error instanceof Error?error.message:'unknown'}));
    const recovery=(globalThis as typeof globalThis&{__academyItemAnswerRecovery?:{observations:unknown[]}}).__academyItemAnswerRecovery;
    return {result,calls,recovered:recovery?.observations.length};
  }finally{for(const [name,descriptor] of prior){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}}
}

test('exact dual-principal native binding does not depend on a decorative teacher-name header',async()=>{
  const {result,calls,recovered}=await exercise();
  expect(result.status).toBe('observed');expect(calls).toBe(1);expect(recovered).toBe(1);
});
test('foreign course principal, login form, wrong origin and name-only shell make no source read',async()=>{
  for(const options of [{coursePrincipal:'7002'},{password:true},{origin:'https://foreign.example'},{header:'Invented teacher in a class dropdown'}]){
    const {result,calls}=await exercise(options);expect(result.status).toBe('refused');expect(calls).toBe(0);
  }
});
test('item answers require the qualified StudyCourse route rather than an arbitrary same-origin shell',async()=>{
  for(const options of [{pathname:'/unqualified'},{search:'?reqCmd=StudyMain'},{search:'?reqCmd=StudyCourse&reqCmd=StudyMain'}]){
    const {result,calls}=await exercise(options);expect(result.status).toBe('refused');expect(calls).toBe(0);
  }
});
