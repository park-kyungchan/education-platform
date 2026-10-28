import {expect,test} from 'bun:test';
import {DailyRecordService,type DailyRecordReadBackend,type TextbookSectionObservation} from '../src/dailyrecord.ts';
import {NativeDailyRecordBackend} from '../src/native-dailyrecord-backend.ts';

const request={displayName:'Invented Student',purpose:'Read fictional section grading',currentRequestRef:'synthetic-textbook-request',
  courseKey:'5',bookNo:'7',sourceTitles:['Unit A 필수예제','Unit A 유형다지기']};
const observation:TextbookSectionObservation={student:{studentId:'77001',displayName:'Invented Student'},courseKey:'5',bookNo:'7',
  records:[
    {sourceTitle:'Unit A 필수예제',score:88,correctCount:7,itemCount:8,items:[{ordinal:'1',scoring:'O'},{ordinal:'2',scoring:'X'}],sourceDate:{literal:'10-23',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}},
    {sourceTitle:'Unit A 유형다지기',score:89,correctCount:8,itemCount:9,items:[{ordinal:'1',scoring:'O'}],sourceDate:{literal:null,precision:'unknown',meaning:'source_apply_date_not_exact_grade_time'}},
  ],observedAt:'2040-01-16T09:00:00.000Z',coverage:'exact_selected_existing_records_not_whole_book'};

test('textbook section results project exact titles, scores and item outcomes',async()=>{
  const backend:DailyRecordReadBackend={readDailyRecord:async()=>({status:'unavailable',reasonCode:'not_used'}),
    readTextbookSections:async input=>{expect(input.sourceTitles).toEqual(request.sourceTitles);return observation;}};
  const result=await new DailyRecordService(backend).textbookSections(request);
  expect(result).toMatchObject({status:'observed',academyWrites:0,parentSends:0,
    records:[{sourceTitle:'Unit A 필수예제',correctCount:7,itemCount:8},{sourceTitle:'Unit A 유형다지기',correctCount:8,itemCount:9}]});
});

test('textbook section results fail closed without a backend or on scope drift',async()=>{
  expect(await new DailyRecordService().textbookSections(request))
    .toMatchObject({status:'unavailable',reasonCode:'textbook_section_backend_not_configured',academyWrites:0});
  const drifting:DailyRecordReadBackend={readDailyRecord:async()=>({status:'unavailable',reasonCode:'not_used'}),
    readTextbookSections:async()=>({...observation,courseKey:'9'})};
  expect(await new DailyRecordService(drifting).textbookSections(request)).toMatchObject({status:'unavailable',academyWrites:0});
});

test('native backend binds textbook execute output to the admitted student and request',async()=>{
  const admission={teacherId:'99001',teacherLabel:'Invented Teacher',date:'2040-01-04',
    students:[{studentId:'77001',displayName:'Invented Student'}],sourceBundleSha256:'b'.repeat(64)};
  const target={studentName:'Invented Student',date:'2040-01-04',groupId:'3',teacherKey:'99001',studentKey:'77001',courseKey:'5',recordKey:'13',membershipKey:'8'};
  const port={authenticate:async()=>{},discoverDayRecordGroups:async()=>({groups:[{groupId:'3'}]}),
    execute:async(input:any)=>{expect(input).toMatchObject({family:'textbook',studentKey:'77001',courseKey:'5',bookNo:'7',gradeViewAdmission:true});
      return {family:'textbook',status:'observed',observedAt:'2040-01-16T09:00:00.000Z',coverage:'x',records:request.sourceTitles.map((t,i)=>({
        sourceTitle:t,studentKey:'77001',studentName:'Invented Student',courseKey:'5',bookNo:'7',score:80+i,
        items:[{originalOrdinal:'1',scoring:'O'},{originalOrdinal:'2',scoring:'X'}],sourceDate:{literal:null,precision:'unknown',meaning:'source_apply_date_not_exact_grade_time'}}))};},
    journalState:async()=>({target,fields:{},previousRecordKey:'12',previousDate:'2040-01-02',wireDigest:'a'.repeat(64)}),close:()=>{}};
  const backend=new NativeDailyRecordBackend(port as never,admission,()=>({username:'fictional',password:'fictional'}));
  const result=await backend.readTextbookSections(request);
  expect(result.records).toHaveLength(2);expect(result.records[0]).toMatchObject({correctCount:1,itemCount:2});
  await expect(backend.readTextbookSections({...request,displayName:'Foreign Student'})).rejects.toThrow('textbook_student_not_admitted');
});
