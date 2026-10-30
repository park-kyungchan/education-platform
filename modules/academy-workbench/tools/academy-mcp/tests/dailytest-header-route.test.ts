import {expect,test} from 'bun:test';
import {encodePaperCode} from '../../../../../apps/academy/dc-gang-a/src/lms/printedPaperCode.ts';
import {readDailyTestHeaders} from '../src/dailytest-header-route.ts';

const student='77001',name='Fictional Student',observedAt='2040-01-01T00:00:00Z';
const request={displayName:name,lessonDate:'2040-01-01',purpose:'Synthetic read',currentRequestRef:'synthetic-request',periods:['11','12']};
const item=(paperKey:string,attemptKey:string,score:number)=>({studentKey:student,studentName:name,paperKey,attemptKey,sourceRowId:null,sourceScore:score});
const page=(selector:string,rows:unknown[])=>({selector,rows,observedAt,operation:'DtResultSearch',page:1,coverage:'one_observed_student_search_page_not_complete_history',fixedSourceFilter:{sort_date:selector}});
const source=()=>({status:'observed',scope:{sourceNamespace:'academy.lms.metadata',studentId:student,lessonDate:'2040-01-01'},results:[{
  query:{kind:'daily_history',periods:['11','12']},observation:{status:'observed',studentKey:student,studentName:name,
    currentFilterQualification:{selector:'1',observedAt,rows:[item('7001','8001',75)]},
    observations:[page('11',[item('7001','8001',75),item('7002','8002',50)]),page('12',[item('7001','8001',75)])],
    coverage:'all_parsed_embedded_rows_on_each_observed_response_not_complete_history'}}]});
const header=(paperKey:string,title:string)=>({status:'observed',paperCode:encodePaperCode(paperKey),requestedPaperKey:paperKey,observedAt,
  contentHeader:{sourceSha256:'a'.repeat(64),metadataRows:[{label:'시험지 제목',value:title},{label:'평가구분',value:'DT/ZT'},{label:'총 문제수',value:'4'}]}});
const wrapper=(entries:unknown[])=>({status:'observed',scope:{studentId:student},observation:{status:'observed',rows:entries}});

test('joins only observed exact keys, deduplicates requests and preserves source periods and unknowns',async()=>{
  const calls:unknown[]=[];
  const result=await readDailyTestHeaders(request,{metadata:async x=>{calls.push(x);return source();},headers:async x=>{
    calls.push(x);return wrapper([header('7002','[발전] Sample B'),header('7001','Sample A')]);}});
  expect(calls[1]).toEqual({studentId:student,paperCodes:[encodePaperCode('7001'),encodePaperCode('7002')]});
  expect(result.periods[0]!.rows[0]).toMatchObject({paperKey:'7001',attemptKey:'8001',sourceScore:75,header:{title:'Sample A',questionCount:'4'}});
  expect(result.periods[2]!.rows[0]!.header?.title).toBe('Sample A');
  expect(result).toMatchObject({bookEdition:'unqualified',attemptDate:'unqualified',teacherCompletion:'unqualified',level:'source_title_only',academyWrites:0});
});
test('bounded header count preserves unrequested rows without guessing',async()=>{
  const result=await readDailyTestHeaders({...request,maxHeaders:1},{metadata:async()=>source(),headers:async()=>wrapper([header('7001','Sample A')])});
  expect(result.status).toBe('partial');expect(result.periods[1]!.rows[1]).toMatchObject({paperKey:'7002',header:null,headerStatus:'not_requested_limit'});
  const next=await readDailyTestHeaders({...request,maxHeaders:1,headerOffset:1,expectedSelectionSha256:result.selectionSha256},{metadata:async()=>source(),headers:async()=>wrapper([header('7002','Sample B')])});
  expect(next.periods[1]!.rows[1]!.header?.title).toBe('Sample B');expect(next.nextHeaderOffset).toBeNull();
  await expect(readDailyTestHeaders({...request,headerOffset:1,expectedSelectionSha256:'b'.repeat(64)},{metadata:async()=>source(),headers:async()=>{throw Error('must_not_call');}})).rejects.toThrow('dailytest_header_selection_changed');
});
test('rejects foreign student or paper identities before joining',async()=>{
  const bad=source();bad.results[0]!.observation.observations[0]!.rows=[item('7001','8001',75)];bad.results[0]!.observation.studentKey='77002';
  await expect(readDailyTestHeaders(request,{metadata:async()=>bad,headers:async()=>{throw Error('must_not_call');}})).rejects.toThrow('dailytest_header_scope_conflict');
  await expect(readDailyTestHeaders(request,{metadata:async()=>source(),headers:async()=>wrapper([header('7001','A'),header('7003','B')])})).rejects.toThrow('dailytest_header_identity_conflict');
});


test('composite route error codes have safe finite public locators',async()=>{
 const {publicReadFailure}=await import('../src/read-failure.ts');
 for(const code of ['dailytest_header_upstream_not_configured','dailytest_header_scope_conflict','dailytest_header_identity_conflict','dailytest_header_duplicate_field','dailytest_header_selection_changed','dailytest_header_offset_out_of_range','dailytest_header_result_too_large']){
  expect(publicReadFailure(Error(code))).toMatchObject({code,automaticRetryAllowed:false});
 }
 expect(JSON.stringify(publicReadFailure(Error('PRIVATE_CANARY')))).not.toContain('PRIVATE_CANARY');
});
