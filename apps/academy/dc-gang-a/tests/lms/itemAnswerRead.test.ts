import {expect,test} from 'bun:test';
import {parseItemAnswer,readItemAnswer} from '../../src/lms/itemAnswerRead';
const response=()=>({result:'OK',rows:[{id:8101,lecture_key:8101,outer_lecture_key:8201,unit_name:'Invented unit',pat_name:'Invented pattern',play_seconds:0,difficulty:1,answer:'2|_|{`list`:[{`h`:`(1)`,`v`:`42`,`t`:`cm`}]}'}]});
test('exact item answers preserve official literals and distinct source keys',()=>{
  const answer=parseItemAnswer(response(),'8101');
  expect(answer.identity).toEqual({sourceNamespace:'academy_item',lectureKey:'8101',outerLectureKey:'8201',sourceId:'8101'});
  expect(answer.answerLiteral).toBe(response().rows[0]!.answer);
  expect(answer.rendering).toBe('not_qualified');
  expect(answer.paperMembership).toBe('unqualified');
});
test('a source solution-file pointer is not presented as acquired answer content',()=>{
  const body=response();body.rows[0]!.answer='3|_|서술형 문제의 답안은 정답,해설파일을 참조';
  expect(parseItemAnswer(body,'8101').answerAvailability).toBe('external_solution_reference');
  expect(parseItemAnswer(response(),'8101').answerAvailability).toBe('literal_payload_not_rendered');
});
test('answer requests reject nonliteral keys before any fetch',async()=>{
  let calls=0;
  const env={origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>{calls++;return Response.json(response());}};
  for(const value of ['08101','8101,8201',8101,null])await expect(readItemAnswer(value as string,env)).rejects.toThrow('invalid_item_request_key');
  expect(calls).toBe(0);
});
test('answer acquisition fails closed on foreign identities, schema drift and authentication',async()=>{
  for(const body of [{...response(),rows:[{...response().rows[0],id:8102}]},{...response(),rows:[{...response().rows[0],answer:''}]},{...response(),rows:[...response().rows,...response().rows]}])expect(()=>parseItemAnswer(body,'8101')).toThrow();
  let calls=0;
  await expect(readItemAnswer('8101',{origin:'https://foreign.example',authenticatedTeacherVisible:true,fetcher:async()=>{calls++;return Response.json(response());}})).rejects.toThrow('authentication_required');
  expect(calls).toBe(0);
});
test('one exact answer uses only the reviewed fixed operation',async()=>{
  const calls:{url:string;init:RequestInit}[]=[];
  await readItemAnswer('8101',{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async(url,init)=>{calls.push({url,init});return Response.json(response());}});
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe('/servlet/controller.common.TestPageShowExServlet?p_process=GetLectureList&lecture_list=8101');
  expect(calls[0]!.init).toMatchObject({method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});
});
