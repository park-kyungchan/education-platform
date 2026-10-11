import {createAcademyReadPlan,executeAcademyRead} from '../src/lms/academyReadProtocol';
import {currentDayRecordColumns} from '../src/lms/dayRecordColumnContract';
import type {ItemAnswerObservation} from '../src/lms/itemAnswerRead';

/** Executed only by the native browser, never by importing this entry in Bun. */
export async function runNativeAcademyRead(input:unknown) {
  const plan=createAcademyReadPlan(input);
  const recovery:{requestedLabels:string[];observations:ItemAnswerObservation[]}|undefined=plan.family==='item_answer'?{requestedLabels:[...plan.request.lectureKeys],observations:[]}:undefined;
  if(recovery)(globalThis as typeof globalThis&{__academyItemAnswerRecovery?:typeof recovery}).__academyItemAnswerRecovery=recovery;
  const principalKey=document.querySelector<HTMLInputElement>('form[name=userForm] [name=pri_no]')?.value;
  const coursePrincipal=document.querySelector<HTMLInputElement>('form[name=form1] [name=g_pri_no]')?.value;
  const courseCommands=new URLSearchParams(location.search).getAll('reqCmd');
  const answerRoute=location.pathname==='/servlet/controller.coursemanage.CourseManageServlet'
    &&courseCommands.length===1&&courseCommands[0]==='StudyCourse';
  const authenticated=location.origin===plan.origin&&!document.querySelector('input[type=password]')
    &&(plan.family==='item_answer'
      ?answerRoute&&principalKey===plan.request.teacherKey&&coursePrincipal===plan.request.teacherKey&&!!document.body?.innerText.includes('[로그아웃]')
      :!!document.body?.innerText.includes(plan.request.teacherLabel+'- [로그아웃]'));
  return executeAcademyRead(plan,{origin:location.origin,authenticatedTeacherVisible:authenticated,
    ...(recovery?{onItemAnswerObservation:(answer:ItemAnswerObservation)=>{recovery.observations.push(answer);}}:{}),
    ...(plan.family==='day_record'?{dayRecordColumnContract:currentDayRecordColumns}:{}),
    principalKey:plan.family==='item_answer'?principalKey:document.querySelector<HTMLInputElement>('[name=pri_no]')?.value,fetcher:(url,init)=>fetch(url,init)});
}
