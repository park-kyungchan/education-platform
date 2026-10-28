import {expect,test} from 'bun:test';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {NativeDailyRecordBackend} from '../src/native-dailyrecord-backend.ts';

const request={labels:['12345','12346'],purpose:'Read fictional item answers',currentRequestRef:'fictional-request'};
const item=(key:string)=>({identity:{sourceNamespace:'academy_item',lectureKey:key,outerLectureKey:'100',sourceId:key},
  answerLiteral:'1|_|invented answer',answerAvailability:'literal_payload_not_rendered',
  answerMeaning:'source_official_item_answer_not_student_response',rendering:'not_qualified',paperMembership:'unqualified',
  secretLikeOtherField:'must not be projected'});
const source=(keys:string[],status='observed')=>({family:'item_answer',status,requestedAnswerLabels:keys,
  pendingAnswerLabels:[],answerBlockedReason:null,itemAnswers:keys.map(item),observedAt:'2040-01-01T00:00:00Z',
  coverage:'exact_requested_shared_answers_not_printed_versions',nativePrintInvoked:false,automaticRetryAllowed:false});

test('exact labels use authenticated owner read and project official literals without implying student or paper status',async()=>{
  const seen:unknown[]=[],auth:number[]=[];
  const port={authenticate:async()=>{auth.push(1);},discoverDayRecordGroups:async()=>({groups:[]}),
    execute:async(input:any)=>{seen.push(input);return {...source(input.lectureKeys),dayRecords:[]};},
    journalState:async()=>{throw Error('not_called');},close:()=>{}};
  const backend=new NativeDailyRecordBackend(port,{teacherId:'99001',teacherLabel:'Invented Teacher',date:'2040-01-01',
    students:[{studentId:'77001',displayName:'Invented Student'}],sourceBundleSha256:'b'.repeat(64)},()=>({username:'fictional',password:'fictional'}));
  const result=await new DailyRecordService(backend).itemAnswers(request);
  expect(result).toMatchObject({status:'observed',academyWrites:0,parentSends:0,nativePrintInvoked:false,
    answers:[{identity:{lectureKey:'12345'},answerLiteral:'1|_|invented answer',rendering:'not_qualified'},
      {identity:{lectureKey:'12346'},answerMeaning:'source_official_item_answer_not_student_response'}]});
  expect(auth).toHaveLength(1);expect(seen).toEqual([{family:'item_answer',teacherLabel:'Invented Teacher',teacherKey:'99001',
    lectureKeys:request.labels,answerReadAdmission:true}]);
  expect(JSON.stringify(result)).not.toContain('must not be projected');
  expect(JSON.stringify(result)).not.toContain('fictional\"password');
});

test('delimiter candidates preserve the full literal without asserting rendered meaning',async()=>{
  const literals:Record<string,string>={'111':'1|_|3','222':'1|_|4','333':'2|_|{`list`:[{`h`:`(1)`,`v`:`42`,`t`:`cm`}]}',
    '444':'3|_|서술형 문제의 답안은 정답,해설파일을 참조','555':'plain payload','666':'x|_|3','777':'1|_|a|_|b','888':'1|_|'};
  const keys=Object.keys(literals);
  const service=new DailyRecordService({readDailyRecord:async()=>({status:'unavailable',reasonCode:'not_configured'}),
    readItemAnswers:async()=>({family:'item_answer',status:'observed',requestedAnswerLabels:keys,pendingAnswerLabels:[],answerBlockedReason:null,
      itemAnswers:keys.map(k=>({identity:{sourceNamespace:'academy_item',lectureKey:k,outerLectureKey:'100',sourceId:k},answerLiteral:literals[k],
        answerAvailability:k==='444'?'external_solution_reference':'literal_payload_not_rendered',
        answerMeaning:'source_official_item_answer_not_student_response',rendering:'not_qualified',paperMembership:'unqualified'})),
      observedAt:'2040-01-01T00:00:00Z',coverage:'exact_requested_shared_answers_not_printed_versions',nativePrintInvoked:false,automaticRetryAllowed:false})});
  const result:any=await service.itemAnswers({labels:keys,purpose:'Fictional format read',currentRequestRef:'fictional-format'});
  const byKey=Object.fromEntries(result.answers.map((a:any)=>[a.identity.lectureKey,a]));
  expect(byKey['111']).toMatchObject({answerLiteral:'1|_|3',answerPrefixCandidate:'1',answerPayloadCandidate:'3'});
  expect(byKey['222']).toMatchObject({answerPrefixCandidate:'1',answerPayloadCandidate:'4'});
  expect(byKey['333'].answerPayloadCandidate).toContain('42');
  expect(byKey['444']).toMatchObject({answerPrefixCandidate:'3',answerAvailability:'external_solution_reference'});
  expect(byKey['555']).toMatchObject({answerPrefixCandidate:null,answerPayloadCandidate:'plain payload'});
  expect(byKey['666']).toMatchObject({answerPrefixCandidate:null,answerPayloadCandidate:'x|_|3'});
  expect(byKey['777']).toMatchObject({answerPrefixCandidate:'1',answerPayloadCandidate:'a|_|b'});
  expect(byKey['888']).toMatchObject({answerPrefixCandidate:null,answerPayloadCandidate:'1|_|'});
});

test('unconfigured, invalid, partial and conflicting sources remain explicit without automatic retry',async()=>{
  expect(await new DailyRecordService().itemAnswers(request)).toMatchObject({status:'unavailable',reasonCode:'item_answer_backend_not_configured'});
  let reads=0;
  const service=(response:unknown)=>new DailyRecordService({readDailyRecord:async()=>({status:'unavailable',reasonCode:'not_configured'}),
    readItemAnswers:async()=>{reads++;return response;}});
  const partial={...source(request.labels,'partial'),itemAnswers:[item('12345')],pendingAnswerLabels:['12346'],answerBlockedReason:'item_transport_failed'};
  expect(await service(partial).itemAnswers(request)).toMatchObject({status:'partial',pendingLabels:['12346'],reasonCode:'item_transport_failed',automaticRetryAllowed:false});
  const conflict={...source(request.labels),itemAnswers:[item('12346'),item('12345')]};
  expect(await service(conflict).itemAnswers(request)).toMatchObject({status:'unavailable',reasonCode:'item_answer_source_unqualified_no_automatic_retry'});
  const before=reads;
  for(const labels of [['001'],['0'],['1','1'],['9007199254740992'],Array(33).fill('1')])
    await expect(service(source([])).itemAnswers({...request,labels})).rejects.toThrow();
  expect(reads).toBe(before);
});
test('structured blocked and partial answer failures never publish unknown source exception text',async()=>{
 for(const partial of [false,true]){
  let reads=0;
  const raw={...source(request.labels,partial?'partial':'blocked'),itemAnswers:partial?[item('12345')]:[],pendingAnswerLabels:partial?['12346']:request.labels,answerBlockedReason:'private_secret_snake_case'};
  const service=new DailyRecordService({readDailyRecord:async()=>({status:'unavailable',reasonCode:'not_configured'}),readItemAnswers:async()=>{reads++;return raw;}});
  const result=await service.itemAnswers(request);
  expect(result).toMatchObject({status:partial?'partial':'blocked',reasonCode:'item_answer_source_unqualified_no_automatic_retry',failure:{category:'upstream_unavailable'}});
  expect(JSON.stringify(result)).not.toContain('private_secret_snake_case');expect(reads).toBe(1);
  if(partial)expect((result as any).answers[0].answerLiteral).toBe('1|_|invented answer');
 }
});
