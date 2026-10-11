import {expect,test} from 'bun:test';
import {createAcademySourceAudit} from '../../src/lms/academySourceAudit';
import {endpointCli} from '../../harness/endpoints';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const snapshot=()=>({schemaVersion:1,family:'textbook',status:'observed',records:[{sourceTitle:'Invented section',studentKey:'9101',studentName:'Invented Student',
  courseKey:'6101',bookNo:'5101',paperKey:'7101',attemptKey:'8101',score:60,items:[{originalOrdinal:'2',lectureKey:'8202',outerLectureKey:null,scoring:'O'},
    {originalOrdinal:'1',lectureKey:'8201',outerLectureKey:null,scoring:'X'}],sourceDate:{literal:'09-27',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}}],
  observedAt:'2099-01-01T00:00:00Z',coverage:'exact_selected_existing_records_not_whole_book',unknownStates:['clinic_solving','durable_print_receipt'],nativePrintInvoked:false,automaticRetryAllowed:false});
test('content fingerprint is deterministic across observation time and source ordering',()=>{
  const a=snapshot(),b=snapshot();b.observedAt='2099-01-02T00:00:00Z';b.records[0]!.items.reverse();b.unknownStates.reverse();
  const left=createAcademySourceAudit(a),right=createAcademySourceAudit(b);
  expect(left.contentDigest).toBe(right.contentDigest);
  expect(left.observedAt).not.toBe(right.observedAt);
  expect(left.entities[0]).toMatchObject({kind:'source_assessment_attempt',sourceNamespace:'academy_textbook'});
  expect(left.semanticClaims).toMatchObject({mastery:'not_established',clinicSolving:'unknown',durablePrintReceipt:'unknown'});
});

test('DayRecord audit uses independent occurrence keys, not assessment aliases',()=>{
  const input={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{studentName:'Invented Student',date:'2099-01-01',groupId:'3',teacherKey:'1101',studentKey:'9101',courseKey:'6101',recordKey:'7101',membershipKey:'5101',fields:{progress:'Reported lesson',attendance:'Y'}}],
    observedAt:'2099-01-01T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['teacher_finalization'],nativePrintInvoked:false,automaticRetryAllowed:false};
  const result=createAcademySourceAudit(input);
  expect(result.entities[0]).toMatchObject({kind:'source_lesson_occurrence',sourceNamespace:'academy_dayrecord'});
  expect(result.contentDigest).toHaveLength(64);
  expect(result.productionWriteAuthorized).toBe(false);
});

test('partial DayRecord audit retains requested scope and unobserved students without declaring absence',()=>{
  const input={schemaVersion:1,family:'day_record',status:'partial',records:[],dailyResults:[],dayRecords:[{studentName:'Invented Student',date:'2099-01-01',groupId:'3',teacherKey:'1101',studentKey:'9101',courseKey:'6101',recordKey:'7101',membershipKey:'5101',fields:{progress:'Reported lesson',attendance:'Y'}}],
    requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Student','Another invented student']},
    observedAt:'2099-01-01T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['teacher_finalization'],nativePrintInvoked:false,automaticRetryAllowed:false};
  const result=createAcademySourceAudit(input);
  expect(result.content).toMatchObject({status:'partial',requestedScope:{...input.requestedScope,studentNames:[...input.requestedScope.studentNames].sort()},
    unobservedTargets:[{studentName:'Another invented student',meaning:'not_observed_not_absent_or_incomplete'}]});
  expect(()=>createAcademySourceAudit({...input,status:'observed'})).toThrow('source_status_count_conflict');
  expect(()=>createAcademySourceAudit({...input,dayRecords:[{...input.dayRecords[0],date:'2099-01-02'}]})).toThrow('source_scope_conflict');
  const blocked=createAcademySourceAudit({...input,status:'blocked',dayRecords:[]});
  expect(blocked.entities).toHaveLength(0);
  const reordered=structuredClone(input);reordered.requestedScope.studentNames.reverse();
  expect(createAcademySourceAudit(reordered).contentDigest).toBe(result.contentDigest);
});

test('daily result audit retains blocked targets and excludes fetch timing from meaning',()=>{
  const input={schemaVersion:1,family:'daily_zero',status:'partial',records:[],dayRecords:[],dailyResults:[
    {status:'observed',studentKey:'9101',studentName:'Invented Student',attemptKey:'8101',paperKey:'7101',paperCode:null,score:61,itemCount:2,correctCount:1,wrongCount:1,observedAt:'2099-01-01T00:00:00Z',durationMs:15},
    {status:'blocked',studentKey:'9102',studentName:'Another invented student',attemptKey:'8102',reason:'contract_rejected',observedAt:'2099-01-01T00:00:00Z'}],
    observedAt:'2099-01-01T00:00:00Z',coverage:'requested_daily_targets',unknownStates:['source_grade_timestamp'],nativePrintInvoked:false,automaticRetryAllowed:false};
  const a=createAcademySourceAudit(input);const copy=structuredClone(input);copy.dailyResults[0]!.durationMs=40;
  const b=createAcademySourceAudit(copy);
  expect(a.contentDigest).toBe(b.contentDigest);
  expect(a.content).toHaveProperty('blockedTargets');
  expect(a.entities[0]).toMatchObject({sourceNamespace:'academy_daily_zero'});
});

test('public audit consumer writes a private normalized result without transcript or credential output',async()=>{
  const home=mkdtempSync(join(tmpdir(),'academy-audit-'));const previous=process.env.HERMES_HOME;
  try{process.env.HERMES_HOME=home;const dir=join(home,'cache','scratch');mkdirSync(dir,{recursive:true});
    const input=join(dir,'snapshot.json'),output=join(dir,'audit.json');writeFileSync(input,JSON.stringify(snapshot()));
    const receipt=await endpointCli(['--audit-read',input,'--output-audit',output]);
    expect(receipt).toMatchObject({audited:true,sourceFamily:'textbook',networkRequests:0});
    expect(JSON.stringify(receipt)).not.toContain('Invented Student');
    expect(JSON.parse(readFileSync(output,'utf8')).contentDigest).toHaveLength(64);
  }finally{if(previous===undefined)delete process.env.HERMES_HOME;else process.env.HERMES_HOME=previous;rmSync(home,{recursive:true,force:true});}
});

const scopedDay=()=>({schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],
  dayRecords:[{studentName:'Invented Student',date:'2099-01-01',groupId:'3',teacherKey:'1101',studentKey:'9101',courseKey:'6101',recordKey:'7101',membershipKey:'5101',fields:{progress:'Reported lesson',attendance:'Y'}}],
  requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Student']},
  observedAt:'2099-01-01T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['teacher_finalization'],nativePrintInvoked:false,automaticRetryAllowed:false});
const dailySnapshot=()=>({schemaVersion:1,family:'daily_zero',status:'observed',records:[],dayRecords:[],dailyResults:[
  {status:'observed',studentKey:'9101',studentName:'Invented Student',attemptKey:'8101',paperKey:'7101',paperCode:null,score:61,itemCount:2,correctCount:1,wrongCount:1}],
  observedAt:'2099-01-01T00:00:00Z',coverage:'requested_daily_targets',unknownStates:['source_grade_timestamp'],nativePrintInvoked:false,automaticRetryAllowed:false});

test('audit refuses secret-like envelope fields and populated foreign-family lanes',()=>{
  for(const value of [snapshot(),scopedDay(),dailySnapshot()]) {
    expect(()=>createAcademySourceAudit({...value,sessionCookie:'synthetic_sensitive_marker'})).toThrow('unexpected_source_audit_field');
    const foreign=value.family==='textbook'?'dayRecords':'records';
    expect(()=>createAcademySourceAudit({...value,[foreign]:[{unexpected:'synthetic'}]})).toThrow('source_family_conflict');
    expect(()=>createAcademySourceAudit({...value,[foreign]:'synthetic'})).toThrow('source_family_conflict');
    expect(createAcademySourceAudit({...value,[foreign]:[]}).productionWriteAuthorized).toBe(false);
  }
});

test('DayRecord audit rejects mixed principals and unsupported journal fields',()=>{
  const input=scopedDay();input.requestedScope.studentNames.push('Another invented student');
  input.dayRecords.push({...input.dayRecords[0]!,studentName:'Another invented student',studentKey:'9102',recordKey:'7102'});
  expect(createAcademySourceAudit(input).entities).toHaveLength(2);
  input.dayRecords[1]!.teacherKey='1102';
  expect(()=>createAcademySourceAudit(input)).toThrow('source_principal_conflict');
  const unsupported=scopedDay();
  Object.assign(unsupported.dayRecords[0]!.fields,{sessionCookie:'synthetic_sensitive_marker'});
  expect(()=>createAcademySourceAudit(unsupported)).toThrow('invalid_journal_source_fields');
});

test('daily audit preserves opaque nonrenderable paper identities and refuses zero-item grades',()=>{
  const digests=new Set<string>();
  for(const key of ['7101','0007101','9007199254740992']) {
    const input=dailySnapshot();input.dailyResults[0]!.paperKey=key;
    const result=createAcademySourceAudit(input);
    expect(result.content).toMatchObject({outcomes:[{paperKey:key}]});digests.add(result.contentDigest);
  }
  expect(digests.size).toBe(3);
  const empty=dailySnapshot();Object.assign(empty.dailyResults[0]!,{itemCount:0,correctCount:0,wrongCount:0});
  expect(()=>createAcademySourceAudit(empty)).toThrow('invalid_source_grade');
  for(const key of ['','0','000','-1','1e3',' 7101']) {
    const input=dailySnapshot();input.dailyResults[0]!.paperKey=key;
    expect(()=>createAcademySourceAudit(input)).toThrow('invalid_source_paper_key');
  }
});
