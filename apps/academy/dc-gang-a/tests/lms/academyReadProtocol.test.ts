import {expect,test} from 'bun:test';
import {createAcademyReadPlan, executeAcademyRead} from '../../src/lms/academyReadProtocol';
import {endpointCli} from '../../harness/endpoints';
import {queryEndpoints} from '../../src/lms/endpointCatalog';
import {readDayRecordSource} from '../../src/lms/dayRecordReadProtocol';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('prepares the textbook existing-result family without grade or generation effects',()=>{
  const input={family:'textbook',teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student',
    courseKey:'6101',bookNo:'5101',sourceTitles:['Invented section'],gradeViewAdmission:true};
  const plan=createAcademyReadPlan(input);
  expect(plan).toMatchObject({kind:'prepared_scoped_native_browser_read',family:'textbook',effect:'read_only',
    credentialChannel:'native_browser_vault',origin:'https://dc.gang-a.kr'});
  expect(plan.operations.map(x=>x.selector)).toEqual(['getTextBookProgress','getWrongAnswerNoteResult','getStudyResultSingleTestingSingleUser']);
  expect(plan).not.toHaveProperty('sessionCookie');
  expect(plan).not.toHaveProperty('password');
});

test('reads exact existing textbook grades and never invokes a generation tail',async()=>{
  const plan=createAcademyReadPlan({family:'textbook',teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student',
    courseKey:'6101',bookNo:'5101',sourceTitles:['Invented section'],gradeViewAdmission:true});
  const calls:{url:string,body:URLSearchParams}[]=[];
  const fetcher=async(url:string,init:RequestInit)=>{
    const body=new URLSearchParams(String(init.body));calls.push({url,body});
    if(calls.length===1)return new Response(`<button onclick="createBookIncorrectPapers('6101','5101','9101')">Wrong note</button>`);
    if(calls.length===2)return Response.json({result:'ok',noteResultList:[{pri_no:9101,name:'Invented Student',p_no:7101,testing_no:8101,testing_name:'Invented section',apply_date:'09-27'}]});
    return Response.json({result:'OK',print_list:[{pri_no:9101,student_name:'Invented Student',score:60,sub_title:'Invented section',exam_list:[
      {exam_no:2,lecture_key:8202,outer_lecture_key:9202,scoring_result:'O'},
      {exam_no:1,lecture_key:8201,outer_lecture_key:9201,scoring_result:'X'}]}]});
  };
  const result=await executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher});
  expect(result.status).toBe('observed');
  expect(result.records[0]).toMatchObject({score:60,sourceTitle:'Invented section'});
  expect(result.records[0]!.items.map((x:any)=>x.originalOrdinal)).toEqual(['1','2']);
  const condition=JSON.parse(calls[2]!.body.get('condition')!);
  expect(condition).toMatchObject({testing_no:8101,pri_no:9101,incorrect:{create:0},similar:{create:0},advance:{create:0},report:{create:0}});
  expect(calls).toHaveLength(3);
});

test('zero-context public discovery explains the read consumer without source dumps',()=>{
  expect(endpointCli(['--help'])).toMatchObject({command:'bun run endpoint:query',nativeAuthentication:'direct_client_secure_authentication_required',
    requiredReadTransport:'direct_http_api',automaticBrowserFallback:false,preparedFamilies:[]});
});

test('explicit offline legacy preparation writes an exclusive private script and emits no student values',async()=>{
  const home=mkdtempSync(join(tmpdir(),'academy-read-cli-'));const previous=process.env.HERMES_HOME;
  try {
    process.env.HERMES_HOME=home;const dir=join(home,'cache','scratch');mkdirSync(dir,{recursive:true});
    const input=join(dir,'request.json'),output=join(dir,'prepared.js');
    writeFileSync(input,JSON.stringify({family:'textbook',teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student',
      courseKey:'6101',bookNo:'5101',sourceTitles:['Invented section'],gradeViewAdmission:true}));
    const receipt=await endpointCli(['--prepare-legacy-browser-read',input,'--output-script',output]);
    expect(receipt).toMatchObject({prepared:true,networkRequests:0,credentialValuesWritten:false,family:'textbook',legacyCompatibilityOnly:true,executionAdmission:'not_provided',effect:'offline_compilation_only'});
    expect(JSON.stringify(receipt)).not.toContain('Invented Student');
    expect(readFileSync(output,'utf8')).toContain('getWrongAnswerNoteResult');
    expect(statSync(output).mode&0o777).toBe(0o600);
    await expect(Promise.resolve().then(()=>endpointCli(['--prepare-legacy-browser-read',input,'--output-script',output]))).rejects.toThrow();
  } finally {if(previous===undefined)delete process.env.HERMES_HOME;else process.env.HERMES_HOME=previous;rmSync(home,{recursive:true,force:true});}
});

test('uses known daily-zero identities without HAR or textbook-family substitution',async()=>{
  const plan=createAcademyReadPlan({family:'daily_zero',teacherLabel:'Invented Teacher',targets:[{studentKey:'9101',studentName:'Invented Student',attemptKey:'8101'}],gradeViewAdmission:true});
  let calls=0;
  const fetcher=async()=>new Response(++calls===1?`<script>EXTERN_DIALOG={testResultList:JSON.parse('[{"pNo":7101,"priNo":9101,"testingNo":8101,"userName":"Invented Student","score":61}]')}</script>`
    :JSON.stringify({result:'OK',print_list:[{pri_no:9101,student_name:'Invented Student',score:61,exam_list:[{exam_no:1,scoring_result:'O'}]}]}));
  const result=await executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher});
  expect(result.family).toBe('daily_zero');
  expect(result.dailyResults[0]).toMatchObject({status:'observed',score:61,studentKey:'9101'});
  expect(calls).toBe(2);
});

test('prepares exact DayRecord date/group reads with independent occurrence verification',()=>{
  const plan=createAcademyReadPlan({family:'day_record',teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Student']});
  expect(plan.family).toBe('day_record');
  expect(plan.operations.map(x=>x.selector)).toEqual(['Main','SelSglRecord']);
  expect(plan.effect).toBe('read_only');
  expect(()=>createAcademyReadPlan({family:'day_record',teacherLabel:'Invented Teacher',date:'2099-02-30',groupIds:['3'],studentNames:['Invented Student']})).toThrow();
});

test('refuses DayRecord reads without an independently bound native principal',async()=>{
  const plan=createAcademyReadPlan({family:'day_record',teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Student']});
  let calls=0;
  await expect(executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>{calls++;throw Error('not_called')}})).rejects.toThrow('principal_binding_required');
  expect(calls).toBe(0);
});

test('whole-catalog coverage exposes scoped preparation without promoting unknown operations',()=>{
  const result=queryEndpoints({projection:'coverage'});
  expect(result.coverage?.readPreparation).toMatchObject({consumer:'bun run endpoint:query',families:['daily_zero','day_record','item_answer','item_metadata','student_course','textbook'],
    preparedFamilies:[],legacyOfflineFamilies:['daily_zero','day_record','item_answer','item_metadata','student_course','textbook'],
    authentication:'direct_client_secure_authentication_required',requiredTransport:'direct_http_api',automaticBrowserFallback:false,unattended:false});
  expect(result.coverage?.physicalBackendCompletenessEstablished).toBe(false);
  expect(queryEndpoints({effect:'unknown',projection:'full'}).rows.every(x=>'callable' in x&&x.callable===false)).toBe(true);
});

test('rejects secret-bearing, malformed, normalized and accessor requests before preparation',()=>{
  const valid={family:'textbook',teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student',courseKey:'6101',bookNo:'5101',sourceTitles:['Invented section'],gradeViewAdmission:true};
  for(const input of [null,[],{...valid,sessionCookie:'synthetic_sensitive_marker'},{...valid,password:'synthetic_sensitive_marker'},
    {...valid,studentKey:'09101'},{...valid,studentKey:' 9101'},{...valid,studentKey:'9007199254740992'},
    {...valid,gradeViewAdmission:false},{...valid,sourceTitles:[]},{...valid,sourceTitles:['a','a']},{...valid,family:'unreviewed'}])expect(()=>createAcademyReadPlan(input)).toThrow();
  let accessed=false;const accessor={...valid};Object.defineProperty(accessor,'studentKey',{get(){accessed=true;return '9101'}});
  expect(()=>createAcademyReadPlan(accessor)).toThrow('accessor_read_request');expect(accessed).toBe(false);
});

test('refuses authentication and mutated plans before any HTTP request',async()=>{
  const plan=createAcademyReadPlan({family:'textbook',teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student',courseKey:'6101',bookNo:'5101',sourceTitles:['Invented section'],gradeViewAdmission:true});
  let calls=0;const fetcher=async()=>{calls++;throw Error('unexpected_network')};
  await expect(executeAcademyRead(plan,{origin:'https://foreign.example',authenticatedTeacherVisible:true,fetcher})).rejects.toThrow('authentication_required');
  await expect(executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:false,fetcher})).rejects.toThrow('authentication_required');
  const drift=structuredClone(plan);drift.operations[0]!.selector='Save';
  await expect(executeAcademyRead(drift,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher})).rejects.toThrow('read_plan_drift');expect(calls).toBe(0);
});

test('scope mismatch and foreign note results cannot become empty or observed source success',async()=>{
  const plan=createAcademyReadPlan({family:'textbook',teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student',courseKey:'6101',bookNo:'5101',sourceTitles:['Invented section'],gradeViewAdmission:true});
  let calls=0;
  await expect(executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>{calls++;return new Response('<p>Unbound view</p>')}})).rejects.toThrow('exact_textbook_scope_not_observed');expect(calls).toBe(1);
  calls=0;
  await expect(executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>++calls===1
    ?new Response(`<button onclick="createBookIncorrectPapers('6101','5101','9101')">view</button>`)
    :Response.json({result:'ok',noteResultList:[{pri_no:9102,name:'Another invented student'}]})})).rejects.toThrow('source_subject_conflict');expect(calls).toBe(2);
});

test('direct exported DayRecord ingress cannot bypass origin authentication',async()=>{
  let calls=0;
  await expect(readDayRecordSource({family:'day_record',teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Student']},
    {origin:'https://foreign.example',authenticatedTeacherVisible:true,principalKey:'1101',fetcher:async()=>{calls++;throw Error('not_called')}})).rejects.toThrow('authentication_required');
  expect(calls).toBe(0);
});

test.each(['input','output'])('private preparation rejects a linked %s parent even inside the allowed tree',async(which)=>{
  const home=mkdtempSync(join(tmpdir(),'academy-parent-link-'));const previous=process.env.HERMES_HOME;
  try {
    process.env.HERMES_HOME=home;const base=join(home,'cache','scratch'),real=join(base,'real'),alias=join(base,'alias');
    mkdirSync(real,{recursive:true});symlinkSync(real,alias,'dir');
    const input=join(real,'request.json');writeFileSync(input,JSON.stringify({family:'textbook',teacherLabel:'Invented Teacher',studentKey:'9101',studentName:'Invented Student',courseKey:'6101',bookNo:'5101',sourceTitles:['Invented section'],gradeViewAdmission:true}));
    await expect(Promise.resolve().then(()=>endpointCli(['--prepare-legacy-browser-read',which==='input'?join(alias,'request.json'):input,'--output-script',join(which==='output'?alias:real,'prepared.js')]))).rejects.toThrow('private_read_path_required');
  }finally{if(previous===undefined)delete process.env.HERMES_HOME;else process.env.HERMES_HOME=previous;rmSync(home,{recursive:true,force:true});}
});

test('DayRecord principals use the canonical key contract before transport or native DOM',async()=>{
  expect(typeof DOMParser).toBe('undefined');
  const request={family:'day_record' as const,teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Student']};
  let calls=0;
  const environment={origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>{calls++;throw Error('unexpected_transport')}};
  await expect(readDayRecordSource(request,{...environment,principalKey:'1'})).rejects.toThrow('native_browser_dom_required');
  for(const principalKey of ['0','01',' 1101','9007199254740992','9'.repeat(30)]) {
    await expect(readDayRecordSource(request,{...environment,principalKey})).rejects.toThrow('principal_binding_required');
  }
  expect(calls).toBe(0);
});

test('item metadata uses the existing public plan and audit without a second consumer',async()=>{
  const plan=createAcademyReadPlan({family:'item_metadata',teacherLabel:'Invented Teacher',lectureKey:'8201'});
  const calls:string[]=[];
  const result=await executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,
    fetcher:async(url)=>{calls.push(url);return Response.json({result:'OK',rows:[{id:8201,lecture_key:8201,outer_lecture_key:9201,
      unit_name:'Invented unit',pat_name:'Invented pattern',difficulty:2,play_seconds:90,answer:'Omitted invented answer'}]});}});
  expect(result.family).toBe('item_metadata');
  expect(result).toMatchObject({status:'observed',coverage:'one_exact_verified_item_not_all_content_or_batch_encoding',
    itemMetadata:[{identity:{lectureKey:'8201',outerLectureKey:'9201'},conceptMapping:'unverified'}]});
  expect(JSON.stringify(result)).not.toContain('Omitted invented answer');
  expect(calls).toEqual(['/servlet/controller.common.TestPageShowExServlet?p_process=GetLectureList&lecture_list=8201']);
  const {createAcademySourceAudit}=await import('../../src/lms/academySourceAudit');
  const audit=createAcademySourceAudit(result);
  expect(audit.content.sourceNamespace).toBe('academy_item');
  expect(audit.productionWriteAuthorized).toBe(false);
});
