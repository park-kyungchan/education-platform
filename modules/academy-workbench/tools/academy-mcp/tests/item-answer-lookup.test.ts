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
