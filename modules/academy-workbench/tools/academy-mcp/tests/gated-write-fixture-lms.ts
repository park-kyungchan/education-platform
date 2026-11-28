import {lmsRequestRole,lmsRoute,type LmsRequestRole} from './network-deny.ts';
import {wireSha256OfPage,type ClinicKind,type ExpectedWireHashes} from '../../../../../apps/academy/dc-gang-a/src/lms/clinicPaperWrite';
import type {ClinicPaperBackend} from '../src/clinic-write-tools.ts';

// A recorded synthetic LMS for tests/gated-writes.test.ts and tests/gated-write-fixture.ts: the two pages whose inline
// handlers are pinned (invented handler bodies, hashed by the test seam `expectedWireHashes`) and TestpageSelectExServlet. Invented
// numeric keys only; no private page, no student name, no live request. Each request is classed by the same table as
// tests/network-deny.ts, and a request classed write is answered `write_forbidden` (403) while `allowWrite` is false.
export const STUDENT='77001',COURSE='55001',BOOK='66001',TESTING='88001',TESTING2='88002',PAPER='99101';
export const NAME_CANARY='Invented Student Canary',COOKIE_CANARY='invented-cookie-canary-4471';
const ORIGIN='https://dc.gang-a.kr';
const handlerPage=(name:string,body:string)=>`<html><body>\r\n<script>\r\nfunction ${name}(kind) {\r\n  ${body}\r\n}\r\nfunction other() { return 1; }\r\n</script>\r\n</body></html>`;
export const bookPage=(body='var n = 1; return n + 1;')=>handlerPage('createBookIncorrectPapers',body);
export const clinicPage=(body='var m = 2; return m * 3;')=>handlerPage('externOnCreateOneClinicPaper',body);
export const pageHashes=():Required<ExpectedWireHashes>=>({bookIncorrect:wireSha256OfPage('book_incorrect',bookPage())!,clinic:wireSha256OfPage('clinic',clinicPage())!});

export interface FixtureRequest{method:string;route:string;role:LmsRequestRole;process:string;condition:Record<string,any>|null;body:string}
export const printList=(studentKey=STUDENT,papers=1)=>Array.from({length:papers},(_,i)=>({p_no:Number(PAPER)+i,pri_no:Number(studentKey),student_name:NAME_CANARY,sub_title:'Invented clinic paper '+i,
  exam_list:[{exam_no:1,lecture_key:5001,scoring_result:'X'},{exam_no:2,lecture_key:5002,scoring_result:'O'}]}));
export const createdAnswer=()=>JSON.stringify({result:'OK',print_list:printList()});
export const scoreAnswer=()=>JSON.stringify({result:'OK',print_list:printList()});

export function fixtureLms(){
  const requests:FixtureRequest[]=[];
  const state={
    pages:{book_incorrect:bookPage(),clinic:clinicPage()} as Record<ClinicKind,string>,
    allowWrite:true,
    noteTestingNos:[TESTING] as string[],
    /** The live LMS sends cls_no 0 on every wrong-note row (specs/academy-mcp/gated-writes.md). */
    noteClsNo:0,
    noteAnswer:null as null|(()=>string|Response),
    writeAnswer:(()=>createdAnswer()) as ()=>string|Response|Promise<string|Response>,
    scoreAnswer:(()=>scoreAnswer()) as ()=>string|Response,
    onRequest:null as null|((request:FixtureRequest)=>void|Promise<void>),
  };
  const transport=async(url:string|URL,init?:RequestInit):Promise<Response>=>{
    const body=typeof init?.body==='string'?init.body:'',form=new URLSearchParams(body),{path,operation}=lmsRoute(url,body);
    const role=lmsRequestRole(url,body,init?.method);
    let condition:Record<string,any>|null=null;try{const raw=form.get('condition');condition=raw===null?null:JSON.parse(raw);}catch{condition=null;}
    const request:FixtureRequest={method:(init?.method??'GET').toUpperCase(),route:operation?path+' '+operation:path,role,process:form.get('p_process')??operation,condition,body};
    requests.push(request);
    await state.onRequest?.(request);
    if(role==='write'&&!state.allowWrite)return new Response('write_forbidden',{status:403});
    if(request.method==='GET'&&operation==='getTextBookMain')return new Response(state.pages.book_incorrect);
    if(request.method==='GET'&&operation==='Main'&&path.endsWith('tutor.fa.TestPageListGrpServlet'))return new Response(state.pages.clinic);
    if(request.method==='POST'&&path.endsWith('common.TestpageSelectExServlet')){
      const answer=(out:string|Response)=>typeof out==='string'?new Response(out):out;
      if(request.process==='getWrongAnswerNoteResult'){
        if(state.noteAnswer)return answer(state.noteAnswer());
        return new Response(JSON.stringify({result:'ok',noteResultList:state.noteTestingNos.map(n=>({pri_no:Number(STUDENT),cls_no:state.noteClsNo,testing_no:Number(n),p_no:Number(PAPER),name:NAME_CANARY}))}));
      }
      if(role==='write')return answer(await state.writeAnswer());
      return answer(state.scoreAnswer());
    }
    throw Error('unexpected_fixture_request');
  };
  return {requests,state,transport,
    writes:()=>requests.filter(r=>r.role==='write'),reads:()=>requests.filter(r=>r.role==='read'),
    routes:()=>requests.map(r=>r.method+' '+r.route+(r.role==='write'?' [write]':''))};
}
export type FixtureLms=ReturnType<typeof fixtureLms>;

const text=async(response:Response)=>{if(!response.ok)throw Error('academy_transport_failed');return response.text();};
/** The port of the service over the recorded LMS: what AcademyHttpClient's two methods send, without the login exchange. */
export const fixturePort=(lms:FixtureLms):ClinicPaperBackend=>({
  readClinicWirePage:async path=>text(await lms.transport(ORIGIN+path,{method:'GET'})),
  postTestpageSelectEx:async fields=>text(await lms.transport(ORIGIN+'/servlet/controller.common.TestpageSelectExServlet',
    {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams(fields).toString()})),
});
