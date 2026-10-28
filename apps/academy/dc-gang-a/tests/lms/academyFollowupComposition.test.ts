import {expect,test} from 'bun:test';
import {AcademyHttpClient} from '../../src/lms/academyHttpClient';
import {inspectAssessmentSearchMetadata} from '../../src/lms/assessmentReadProtocol';
import {sourceFixture,credential,principal,principalHtml,target,resultHtml,row} from './followupSyntheticFixtures';
import {NativeDailyRecordBackend} from '../../../../../modules/academy-workbench/tools/academy-mcp/src/native-dailyrecord-backend';
import {dailyRecordMemory} from '../../../../../modules/academy-workbench/tools/academy-mcp/tests/dailyrecord-memory';
import {JOURNAL_HTTP_SOURCE_CONTRACT} from '../../src/lms/lessonJournalHttp';
import {encodePaperCode} from '../../src/lms/printedPaperCode';

// Coordinator technical Q and A: no admitted fixture contains the pinned onSearchPage bytes.
// Direct-client cases below establish client contracts; registered-tool cases exercise the maintained caller.
// Native deployment/actual-use qualification is HELD; no account, configuration or source bundle is activated.
// Positive student-paper date-override wire requests remain unqualified; preserve the fixed pin.
const reads=[
  (client:AcademyHttpClient)=>client.searchDailyTestMetadata(target),
  (client:AcademyHttpClient)=>client.inspectDailyTestInventory(target),
  (client:AcademyHttpClient)=>client.readDailyTestHistory({...target,periods:['11','12']}),
];
test('C0/C1 direct client only: one login across the DT-family batch; fresh-client-per-read fails',async()=>{
  const f=sourceFixture();
  try{
    await f.client.authenticate(credential);
    for(const read of reads)await read(f.client);
    expect(f.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1});
    expect(f.calls).toHaveLength(8); // 3 authentication + 1 + 1 + (qualification + 2 selectors).
    f.client.close();const before=f.calls.length;
    for(const read of reads)await expect(read(f.client)).rejects.toThrow('authentication_required');
    expect(f.calls).toHaveLength(before);
    await expect(f.client.authenticate(credential)).rejects.toThrow('fresh_authentication_attempt_required');
    expect(f.calls).toHaveLength(before);
  }finally{f.client.close();}
  const fresh=sourceFixture();
  for(const read of reads){
    const client=new AcademyHttpClient(principal,fresh.transport);
    try{await client.authenticate(credential);await read(client);}finally{client.close();}
  }
  expect(fresh.authCounts()).toEqual({documents:3,submissions:3,principalChecks:3});
  const requireOneLogin=()=>expect(fresh.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1});
  expect(requireOneLogin).toThrow();
});

test('C2: foreign teacher and caller college overrides stop before transport; exact-student filtering persists across the batch',async()=>{
  const foreign={...row,priNo:77002,userName:'Foreign Invented Learner',testingNo:81002,testName:'Excluded foreign title'};
  const f=sourceFixture(()=>new Response(resultHtml([row,foreign])));
  try{
    await f.client.authenticate(credential);const before=f.calls.length;
    for(const method of ['searchDailyTestMetadata','inspectDailyTestInventory'] as const){
      await expect(f.client[method]({...target,teacherLabel:'Foreign Teacher'})).rejects.toThrow('daily_search_principal_conflict');
      await expect(f.client[method]({...target,collegeKey:'88002'} as any)).rejects.toThrow();
    }
    await expect(f.client.readDailyTestHistory({...target,teacherLabel:'Foreign Teacher',periods:['11']})).rejects.toThrow('daily_search_principal_conflict');
    expect(f.calls).toHaveLength(before);
    for(const read of reads){const result=await read(f.client);expect(JSON.stringify(result)).not.toContain('Foreign Invented');expect(JSON.stringify(result)).not.toContain('Excluded foreign title');}
  }finally{f.client.close();}
  const f2=sourceFixture();const mismatched=new AcademyHttpClient({...principal,collegeKey:'88002'},f2.transport);
  try{
    await expect(mismatched.authenticate(credential)).rejects.toThrow('teacher_college_conflict');
    await expect(mismatched.searchDailyTestMetadata(target)).rejects.toThrow('authentication_required');
    expect(f2.calls).toHaveLength(3);
  }finally{mismatched.close();}
});

for(const challenge of ['<input type="password">','webUserPass','세션이 만료']){
  test('C3: '+challenge+' fences the shared session without retry or replay',async()=>{
    for(const read of reads){
      const f=sourceFixture(()=>new Response(challenge));
      try{
        await f.client.authenticate(credential);await expect(read(f.client)).rejects.toThrow('authentication_required');
        expect(f.client.authenticated).toBe(false);expect(f.calls).toHaveLength(4);
        await expect(f.client.searchDailyTestMetadata(target)).rejects.toThrow('authentication_required');
        expect(f.calls).toHaveLength(4);expect(f.authCounts().submissions).toBe(1);
      }finally{f.client.close();}
    }
  });
}

test('C4: one observed DT page per requested selector; page-2 target is never traversed or called globally absent',async()=>{
  const f=sourceFixture((url,init)=>{
    expect(url.searchParams.get('reqCmd')).toBe('DtResultSearch');expect(init.method).toBe('POST');
    const body=new URLSearchParams(init.body as string);
    expect([...body.keys()].sort()).toEqual(['sort_date','stu_name']);expect(body.get('stu_name')).toBe(target.studentName);
    // The invented target would exist on page 2 if a caller tried to traverse it.
    return new Response(resultHtml(url.searchParams.get('page')==='2'?[row]:[]));
  });
  try{
    await f.client.authenticate(credential);
    const first=await f.client.searchDailyTestMetadata(target);
    expect(first.rows).toEqual([]);expect(first.page).toBe(1);expect(first.sourcePeriod).toBeNull();
    expect(first.coverage).toBe('one_observed_student_search_page_not_complete_history');expect(first.generatedMembership).toBe('unqualified');
    expect(first.fixedSourceFilter).toEqual({sort_date:'1'});expect(f.calls).toHaveLength(4);
    const inventory=await f.client.inspectDailyTestInventory(target);expect(inventory.expectedPaperDefinitions).toBe('not_observed');expect(inventory.rows).toEqual([]);
    const history=await f.client.readDailyTestHistory({...target,periods:['11','12']});
    expect(history.coverage).toBe('all_parsed_embedded_rows_on_each_observed_response_not_complete_history');
    expect(history.observations.every(o=>o.page===1&&o.rows.length===0)).toBe(true);
    expect(f.calls.slice(3).map(c=>new URLSearchParams(c.init.body as string).get('sort_date'))).toEqual(['1','1','1','11','12']);
    expect(f.calls).toHaveLength(8);
  }finally{f.client.close();}
});

test('invented UserByMain bytes cannot bypass the unchanged pinned student-paper wire guard',async()=>{
  const f=sourceFixture(url=>{
    expect(url.searchParams.get('p_process')).toBe('UserByMain');
    return new Response(principalHtml+'<form name="search" method="post"></form><script>function onSearchPage(){return "invented";}</script>');
  });
  try{
    await f.client.authenticate(credential);
    await expect(f.client.searchStudentPaperMetadata({...target,period:{from:'2098-09-01',through:'2099-01-05'}})).rejects.toThrow('student_paper_search_wire_drift');
    expect(f.calls).toHaveLength(4);expect(f.calls.some(c=>c.url.searchParams.get('p_process')==='UserBySearchTestResult')).toBe(false);
  }finally{f.client.close();}
});

test('admitted sourceRowId remains nullable, bounded and independent from paper/attempt identity',()=>{
  for(const id of ['row_1-A',123,'x'.repeat(64),'x'.repeat(65),'bad id','<script>',null,{}]){
    const result=inspectAssessmentSearchMetadata(resultHtml([{...row,_id:id}]),target).rows[0]!;
    const valid=(typeof id==='string'||typeof id==='number')&&/^[A-Za-z0-9_-]{1,64}$/.test(String(id));
    expect(result.sourceRowId).toBe(valid?String(id):null);expect(result.paperKey).toBe('82001');expect(result.attemptKey).toBe('81001');
  }
});

const metadataScope={sourceNamespace:'academy.lms.metadata',teacherId:principal.teacherKey,studentId:target.studentKey,lessonDate:'2099-01-05'};
const admission={teacherId:principal.teacherKey,teacherLabel:principal.teacherLabel,date:metadataScope.lessonDate,
  students:[{studentId:target.studentKey,displayName:target.studentName}],sourceBundleSha256:'b'.repeat(64)};
const metadataInput=(queries:unknown[]=[{kind:'daily_metadata'},{kind:'daily_inventory'},{kind:'daily_history',periods:['11','12']}])=>({
  purpose:'Invented bounded student metadata review',currentRequestRef:'invented-metadata-request',scope:metadataScope,queries,
});
const backendFor=(client:AcademyHttpClient)=>new NativeDailyRecordBackend(client as any,admission,()=>credential);
type Connection=Awaited<ReturnType<typeof dailyRecordMemory>>;
const callMetadata=(connection:Connection,input:unknown=metadataInput())=>connection.client.callTool({name:'academy_student_metadata',arguments:input as Record<string,unknown>});

test('MCP C0/C1: actual registered tool/service/backend executes a DT-family batch with one login; fresh caller per read fails',async()=>{
  const f=sourceFixture(),connection=await dailyRecordMemory(backendFor(f.client));
  try{
    const listed=(await connection.client.listTools()).tools.find(t=>t.name==='academy_student_metadata')!;
    expect(listed.annotations?.readOnlyHint).toBe(true);expect(listed.annotations?.destructiveHint).toBe(false);
    expect(listed.inputSchema.required).toEqual(['purpose','currentRequestRef','scope','queries']);
    const result=await callMetadata(connection);expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({status:'observed',scope:metadataScope,academyWrites:0,parentSends:0,automaticRetryAllowed:false});
    const data=result.structuredContent as any;
    expect(data.results.map((r:any)=>r.query.kind)).toEqual(['daily_metadata','daily_inventory','daily_history']);
    expect(data.results[0].observation.coverage).toBe('one_observed_student_search_page_not_complete_history');
    expect(data.results[1].observation.expectedPaperDefinitions).toBe('not_observed');
    expect(data.results[2].observation.calendarBounds).toBe('source_relative_labels_only_not_exact_calendar_bounds');
    expect(data).not.toHaveProperty('fields');expect(data).not.toHaveProperty('userContext');
    expect(f.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1});expect(f.calls).toHaveLength(8);
    await callMetadata(connection,metadataInput([{kind:'daily_metadata'}]));expect(f.authCounts().submissions).toBe(1);
  }finally{await connection.close();f.client.close();}
  const transport=sourceFixture();
  for(const query of metadataInput().queries){
    const client=new AcademyHttpClient(principal,transport.transport),fresh=await dailyRecordMemory(backendFor(client));
    try{expect((await callMetadata(fresh,metadataInput([query]))).structuredContent).toMatchObject({status:'observed'});}
    finally{await fresh.close();client.close();}
  }
  expect(transport.authCounts()).toEqual({documents:3,submissions:3,principalChecks:3});
  expect(()=>expect(transport.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1})).toThrow();
});

test('MCP C2: strict unknown/foreign/principal/date/query inputs stop before authentication or source reads',async()=>{
  const f=sourceFixture(),connection=await dailyRecordMemory(backendFor(f.client));
  try{
    const valid=metadataInput();
    for(const input of [{...valid,teacherLabel:'Foreign Teacher'},{...valid,collegeKey:'88002'},{...valid,studentName:'Foreign Learner'},
      {...valid,fields:{progress:'must_not_be_metadata_transport'}},{...valid,scope:{...metadataScope,sourceNamespace:'academy.lms.dayrecord'}},
      metadataInput([{kind:'unknown'}]),metadataInput([{kind:'daily_metadata',approved:true}]),
      metadataInput([{kind:'daily_history',periods:['99']}]),metadataInput([{kind:'daily_history',periods:['11','11']}]),
      metadataInput([{kind:'student_papers',period:{from:'2099-01-06',through:'2099-01-05'}}]),
      metadataInput([{kind:'student_papers',period:{from:'2099-02-29',through:'2099-03-01'}}]),
      metadataInput([{kind:'printed_paper_metadata',paperCode:'#INVALID',period:{from:'2099-01-01',through:'2099-01-05'}}]),
      metadataInput(Array.from({length:9},()=>({kind:'daily_metadata'})))]){
      expect((await callMetadata(connection,input)).isError).toBe(true);expect(f.calls).toHaveLength(0);
    }
    // Invalid caller input does not poison the owned source-read fence.
    expect((await callMetadata(connection,valid)).structuredContent).toMatchObject({status:'observed'});
  }finally{await connection.close();f.client.close();}
  for(const delta of [{teacherId:'99002'},{studentId:'77002'},{lessonDate:'2099-01-06'}]){
    const source=sourceFixture(),foreign=await dailyRecordMemory(backendFor(source.client));
    try{
      const result=await callMetadata(foreign,{...metadataInput(),scope:{...metadataScope,...delta}});
      expect(result.structuredContent).toMatchObject({status:'unavailable'});expect(source.calls).toHaveLength(0);
      expect(result.structuredContent).toMatchObject({reasonCode:'native_metadata_scope_refused',failure:{category:'policy_denial',code:'native_metadata_scope_refused'}});
    }finally{await foreign.close();source.client.close();}
  }
});

function dayRecordPort(client:AcademyHttpClient,probe:<T>(value:T)=>Promise<T>=async value=>value){
  const current={studentName:target.studentName,date:admission.date,groupId:'3',teacherKey:principal.teacherKey,studentKey:target.studentKey,courseKey:'5',recordKey:'13',membershipKey:'88001'};
  const fields={progress:'- Invented progress',homework:'- Invented homework',lessonMemo:'- Invented memo',attendance:'Y',dailyTestAssessment:'-1',previousHomeworkAssessment:'-1'};
  // Only the DayRecord source-read boundary is stubbed; metadata/authentication keep the actual HTTP client.
  Object.assign(client,{discoverDayRecordGroups:()=>probe({groups:[{groupId:'3'}]}),
    execute:(input:{date:string})=>probe({dayRecords:[{...current,date:input.date,recordKey:input.date===admission.date?'13':'12',fields}]}),
    journalState:()=>probe({target:current,fields,previousRecordKey:'12',previousDate:'2099-01-02',wireDigest:JOURNAL_HTTP_SOURCE_CONTRACT.staticWireDigest})});
}
const intakeInput=()=>({context:{schemaVersion:'academy.dailyrecord-user-context/1',purpose:'Invented intake',currentRequestRef:'invented-intake-request',
  scope:{...metadataScope,sourceNamespace:'academy.lms.dayrecord'},selectedFields:['progress','homework','lessonMemo','attendance','dailyTestAssessment','previousHomeworkAssessment'],
  memoAnswer:{kind:'no_addition',requestRef:'invented-intake-request'},facts:[]}});

test('MCP concurrency: metadata batches and DailyRecord reads share one auth promise and the same serialized boundary',async()=>{
  let active=0,max=0;
  async function probe<T>(value:T){active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return value;}
  const f=sourceFixture(()=>probe(new Response(resultHtml())));dayRecordPort(f.client,probe);
  const connection=await dailyRecordMemory(backendFor(f.client));
  try{
    const [a,b,intake]=await Promise.all([callMetadata(connection),callMetadata(connection,metadataInput([{kind:'daily_inventory'}])),
      connection.client.callTool({name:'academy_dailyrecord_intake',arguments:intakeInput()})]);
    expect(a.structuredContent).toMatchObject({status:'observed'});expect(b.structuredContent).toMatchObject({status:'observed'});
    expect(intake.structuredContent).toMatchObject({sourceAvailability:'observed'});expect(max).toBe(1);
    expect((intake.structuredContent as any).fields).toHaveLength(6);expect(JSON.stringify((intake.structuredContent as any).fields)).not.toContain('Invented assessment');
    expect(f.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1});
  }finally{await connection.close();f.client.close();}
});

test('MCP failures close per request across concurrent metadata and subsequent DailyRecord calls without retry or error leakage',async()=>{
  for(const html of ['<input type="password">','webUserPass','세션이 만료','malformed INVENTED_ERROR_MUST_NOT_LEAK']){
    const f=sourceFixture(()=>new Response(html));dayRecordPort(f.client);
    const connection=await dailyRecordMemory(backendFor(f.client));
    try{
      const [a,b]=await Promise.all([callMetadata(connection),callMetadata(connection)]);
      for(const result of [a,b])expect(result.structuredContent).toMatchObject({status:'unavailable',automaticRetryAllowed:false});
      const calls=f.calls.length;expect(calls).toBeGreaterThanOrEqual(4);
      const intake=await connection.client.callTool({name:'academy_dailyrecord_intake',arguments:intakeInput()});
      expect(intake.structuredContent).toMatchObject({sourceAvailability:'observed'});
      expect(JSON.stringify([a,b,intake])).not.toContain('INVENTED_ERROR');expect(f.authCounts().submissions).toBe(1);
    }finally{await connection.close();f.client.close();}
  }
});

test('MCP retains failed auth once, closes reverse DailyRecord failure per request, and refuses missing metadata capability before login',async()=>{
  const f=sourceFixture(undefined,'invented-invalid-login-document'),backend=backendFor(f.client),connection=await dailyRecordMemory(backend);
  try{
    expect((await callMetadata(connection)).structuredContent).toMatchObject({status:'unavailable'});
    expect((await callMetadata(connection)).structuredContent).toMatchObject({status:'unavailable'});
    // A new service cannot erase the backend instance authentication failure promise.
    const other=await dailyRecordMemory(backend);
    try{expect((await callMetadata(other)).structuredContent).toMatchObject({status:'unavailable'});}finally{await other.close();}
    expect(f.calls).toHaveLength(1);expect(f.authCounts().documents).toBe(1);expect(f.authCounts().submissions).toBe(0);
  }finally{await connection.close();f.client.close();}
  const broken=sourceFixture();dayRecordPort(broken.client);Object.assign(broken.client,{execute:async()=>{throw Error('invented_source_failure');}});
  const reverse=await dailyRecordMemory(backendFor(broken.client));
  try{
    expect((await reverse.client.callTool({name:'academy_dailyrecord_intake',arguments:intakeInput()})).structuredContent).toMatchObject({sourceAvailability:'unavailable'});
    const calls=broken.calls.length;expect((await callMetadata(reverse)).structuredContent).toMatchObject({status:'observed'});expect(broken.calls.length).toBeGreaterThan(calls);
  }finally{await reverse.close();broken.client.close();}
  const absent=sourceFixture();Object.assign(absent.client,{readDailyTestHistory:undefined});const unsupported=await dailyRecordMemory(backendFor(absent.client));
  try{expect((await callMetadata(unsupported)).structuredContent).toMatchObject({status:'unavailable'});expect(absent.calls).toHaveLength(0);}
  finally{await unsupported.close();absent.client.close();}
});

test('MCP student-paper/printed-lookup routes reach the fixed wire guard; the positive date-override fixture gap remains explicit',async()=>{
  for(const query of [{kind:'student_papers',period:{from:'2098-09-01',through:'2099-01-05'}},
    {kind:'printed_paper_metadata',paperCode:encodePaperCode('82001'),period:{from:'2098-09-01',through:'2099-01-05'}}]){
    const f=sourceFixture(url=>{
      expect(url.searchParams.get('p_process')).toBe('UserByMain');
      return new Response(principalHtml+'<form name="search" method="post"></form><script>function onSearchPage(){return "invented";}</script>');
    }),connection=await dailyRecordMemory(backendFor(f.client));
    try{
      const result=await callMetadata(connection,metadataInput([query]));expect(result.structuredContent).toMatchObject({status:'unavailable'});
      expect(f.calls).toHaveLength(4);expect(f.calls.some(c=>c.url.searchParams.get('p_process')==='UserBySearchTestResult')).toBe(false);
    }finally{await connection.close();f.client.close();}
  }
});

test('MCP C4: empty DT pages retain partial coverage through the actual registered route without traversal',async()=>{
  const f=sourceFixture(()=>new Response(resultHtml([]))),connection=await dailyRecordMemory(backendFor(f.client));
  try{
    const result=(await callMetadata(connection)).structuredContent as any;
    expect(result.status).toBe('observed');expect(result.results[0].observation.rows).toEqual([]);
    expect(result.results[0].observation.page).toBe(1);expect(result.results[0].observation.generatedMembership).toBe('unqualified');
    expect(result.results[0].observation.coverage).toBe('one_observed_student_search_page_not_complete_history');
    expect(f.calls).toHaveLength(8);expect(f.calls.slice(3).every(c=>!c.url.searchParams.has('page'))).toBe(true);
  }finally{await connection.close();f.client.close();}
});

test('MCP metadata bounds its actual dual result before publication and closes refusal per request',async()=>{
  const large=Array.from({length:400},(_,i)=>({...row,pNo:82001+i,testingNo:81001+i,testName:'Invented bounded title '+String(i)+'x'.repeat(1700)}));
  const f=sourceFixture(()=>new Response(resultHtml(large))),connection=await dailyRecordMemory(backendFor(f.client));
  try{
    const first=await callMetadata(connection,metadataInput([{kind:'daily_metadata'}]));
    expect(first.structuredContent).toMatchObject({status:'unavailable',reasonCode:'student_metadata_unqualified_no_automatic_retry'});
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(1024);expect(first.structuredContent).not.toHaveProperty('results');
    const calls=f.calls.length;expect(calls).toBe(4);
    expect((await callMetadata(connection)).structuredContent).toMatchObject({status:'unavailable'});expect(f.calls.length).toBeGreaterThan(calls);
  }finally{await connection.close();f.client.close();}
},20000);

test('MCP M1: inventory and history omit foreign page anchors, controls, functions and selected-row TR cells',async()=>{
  const foreign={...row,priNo:77002,userName:'FOREIGN_STUDENT',testingNo:81002,testName:'FOREIGN_TITLE'};
  const html=resultHtml([row,foreign]).replace('Invented month','FOREIGN_SELECTOR_LABEL')+
    '<form name="FOREIGN_FORM"><input name="page_foreign" value="FOREIGN_CONTROL"></form>'+
    '<script src="/FOREIGN_SCRIPT.js"></script><script>function onSearchForeign(){return "FOREIGN_FUNCTION";}</script>'+
    '<a href="/servlet/controller.dailyzerotest.DailyZeroTestServlet">FOREIGN_ANCHOR</a>'+
    '<table><tr id="invented-row_1"><td>FOREIGN_TR_CELL</td></tr></table>';
  const f=sourceFixture(()=>new Response(html)),connection=await dailyRecordMemory(backendFor(f.client));
  try{
    const result=await callMetadata(connection,metadataInput([{kind:'daily_inventory'},{kind:'daily_history',periods:['11']}]))
    expect(result.structuredContent).toMatchObject({status:'observed'});
    const encoded=JSON.stringify(result);expect(encoded).not.toContain('FOREIGN_');
    for(const key of ['filterContracts','functions','controls','scriptSources','forms','navigation','displayRows','cells','fieldNames'])expect(encoded).not.toContain('"'+key+'"');
    const data=result.structuredContent as any;
    expect(data.results[0].observation.rows[0]).toMatchObject({studentKey:target.studentKey,studentName:target.studentName,paperKey:'82001'});
    expect(data.results[1].observation.observations[0].selector).toBe('11');
    expect(data.results[1].observation.observations[0].rows).toHaveLength(1);
    expect(data.results[1].observation.currentFilterQualification.rows).toHaveLength(1);
    // The rich source API remains available internally, proving the export projection did the work.
    const internal=await f.client.inspectDailyTestInventory(target);expect(JSON.stringify(internal)).toContain('FOREIGN_ANCHOR');
    expect(JSON.stringify(internal.displayRows)).toContain('FOREIGN_TR_CELL');
  }finally{await connection.close();f.client.close();}
});

test('MCP M1: owner admission independently rejects a client-returned foreign row before publication',async()=>{
  for(const identity of [{studentKey:'77002'},{studentName:'FOREIGN_STUDENT'}]){
    const f=sourceFixture();f.client.searchDailyTestMetadata=async()=>({operation:'DtResultSearch',page:1,sourcePeriod:null,
      fixedSourceFilter:{sort_date:'1'},observedAt:new Date().toISOString(),coverage:'one_observed_student_search_page_not_complete_history',generatedMembership:'unqualified',
      rows:[{studentKey:target.studentKey,studentName:target.studentName,paperKey:'82001',attemptKey:'81001',sourceRowId:'invented-row_1',sourceScore:0,titles:{},...identity}]}) as any;
    const connection=await dailyRecordMemory(backendFor(f.client));
    try{
      const result=await callMetadata(connection,metadataInput([{kind:'daily_metadata'}]));expect(result.structuredContent).toMatchObject({status:'unavailable'});
      expect(JSON.stringify(result)).not.toContain('FOREIGN_STUDENT');expect(result.structuredContent).not.toHaveProperty('results');
    }finally{await connection.close();f.client.close();}
  }
});

test('MCP M2: resolved invalid/unavailable DailyRecord and CISM results close per request before queued metadata enters the backend fresh',async()=>{
  for(const family of ['dailyrecord','cism'] as const)for(const outcome of ['invalid','unavailable'] as const){
    const f=sourceFixture();dayRecordPort(f.client);const backend=backendFor(f.client),originalRead=backend.readDailyRecord.bind(backend);
    const context=intakeInput().context,selection={reportId:'invented-report',periodStart:'2099-01-01',periodEnd:'2099-01-05',section:'learning_support'};
    let reads=0,metadataCalls=0;
    const metadataRead=backend.readStudentMetadata.bind(backend);
    backend.readStudentMetadata=async input=>{metadataCalls++;return metadataRead(input);};
    if(family==='dailyrecord')backend.readDailyRecord=async scope=>{
      reads++;const value=await originalRead(scope);
      return outcome==='unavailable'?{status:'unavailable',reasonCode:'INVENTED_ERROR_MUST_NOT_LEAK'} as any:
        {...value,observation:{...value.observation,target:{...value.observation.target,studentId:'77002'}}};
    };
    else Object.assign(backend,{readCismSection:async(scope:typeof context.scope,selected:unknown)=>{
      reads++;await originalRead(scope);
      return outcome==='unavailable'?{status:'unavailable',reasonCode:'INVENTED_ERROR_MUST_NOT_LEAK'}:
        {status:'observed',observation:{scope:{...scope,studentId:'77002'},selection:selected,observedAt:new Date().toISOString(),sourceRevision:'c'.repeat(64),
          sourceReferenceDate:'2099-01-04',sectionLabel:'학습부진아 지도',text:'Invented CISM text',evidenceRefs:['invented-cism']}};
    }});
    const connection=await dailyRecordMemory(backend);
    try{
      const request=family==='dailyrecord'?{name:'academy_dailyrecord_intake',arguments:{context}}:{name:'academy_cism_section',arguments:{context,selection}};
      const [first,second]=await Promise.all([connection.client.callTool(request),callMetadata(connection)]);
      expect(reads).toBe(1);expect(metadataCalls).toBe(1);expect(second.structuredContent).toMatchObject({status:'observed'});
      expect(f.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1});
      expect(JSON.stringify([first,second])).not.toContain('INVENTED_ERROR');
      await callMetadata(connection);expect(metadataCalls).toBe(2);
    }finally{await connection.close();f.client.close();}
  }
});

test('MCP M3: finite raw metadata scores outside a grading scale stay raw and leave all six official fields unchanged',async()=>{
  const scores=[-1,150,null];
  const f=sourceFixture(()=>new Response(resultHtml(scores.map((score,i)=>({...row,pNo:82001+i,testingNo:81001+i,score})))));
  dayRecordPort(f.client);const connection=await dailyRecordMemory(backendFor(f.client));
  const official=async()=>{
    const result=await connection.client.callTool({name:'academy_dailyrecord_intake',arguments:intakeInput()});
    expect(result.structuredContent).toMatchObject({sourceAvailability:'observed'});
    return (result.structuredContent as any).fields.map((field:any)=>({field:field.field,value:field.before.value,disposition:field.disposition,target:field.target}));
  };
  try{
    const before=await official(),result=await callMetadata(connection),data=result.structuredContent as any;
    expect(data.status).toBe('observed');
    for(const rows of [data.results[0].observation.rows,data.results[1].observation.rows,data.results[2].observation.observations[0].rows]){
      expect(rows.map((r:any)=>r.sourceScore)).toEqual(scores);
      for(const row of rows)for(const field of ['completion','exemption','dailyTestAssessment','previousHomeworkAssessment','attendance'])expect(row).not.toHaveProperty(field);
    }
    expect(await official()).toEqual(before);expect(before).toHaveLength(6);
    expect(before.find((field:any)=>field.field==='dailyTestAssessment').value).toBe('-1');
    expect(f.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1});
  }finally{await connection.close();f.client.close();}
});
