import {test,expect} from 'bun:test';
import {z} from 'zod';
import {teacherFixture,sourceRoot} from './teacher-fixture.ts';
import {teacherMemory} from './teacher-memory.ts';
import {reviewedTeacherFixture,branchedTeacherFixture} from './teacher-repair-fixture.ts';
import {renderTeacherReport} from '../src/teacher-report.ts';
import {TeacherRetainedService,teacherQuerySchema,teacherReportSchema,MAX_TEACHER_MCP_BYTES} from '../src/teacher-retained.ts';
import {toolResultBytes} from '../src/tool-result.ts';

test('F1 actual SDK/wire invalid inputs stay fixed-size before either tool handler, without caller-key echo',async()=>{
  const f=await teacherFixture(0);let callbacks=0;
  const connection=await teacherMemory({sourceRoot,authenticatedFetchPage:request=>{callbacks++;return f.fetchPage(request);}});
  try{
    const tools=(await connection.client.listTools()).tools;
    for(const [name,schema] of [['academy_teacher_query',teacherQuerySchema],['academy_teacher_report',teacherReportSchema]] as const){
      const listed=tools.find(tool=>tool.name===name)!;
      const advertised:unknown=z.toJSONSchema(schema,{io:'input'});
      expect(listed.inputSchema as unknown).toEqual(advertised);
      expect(listed.inputSchema.additionalProperties).toBe(false);
      expect(listed.inputSchema.required).toEqual(['selector']);
      const giant='invented_private_key_'+'k'.repeat(550000);
      const cases=[
        {selector:f.selector,[giant]:true},
        {selector:{...f.selector,[giant]:true}},
        {selector:{...f.selector,date:'invented_private_invalid_date'}},
        {selector:{kind:'invented_private_invalid_kind'}},
        {selector:f.selector,['invented_private_key_a_'+'a'.repeat(300000)]:1,['invented_private_key_b_'+'b'.repeat(300000)]:2},
        {invented_private_key_missing_selector:true},
      ];
      const texts:string[]=[];
      for(const args of cases){
        expect(schema.safeParse(args).success).toBe(false);
        const result=await connection.client.callTool({name,arguments:args});
        expect(result.isError).toBe(true);expect(callbacks).toBe(0);
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(1024);
        const encoded=JSON.stringify(result);expect(encoded).toContain('teacher_request_invalid');expect(encoded).not.toContain('invented_private');
        texts.push(encoded);
      }
      expect(new Set(texts).size).toBe(1);
    }
    expect(f.source.counters.snapshots).toBe(0);
    const query=await connection.client.callTool({name:'academy_teacher_query',arguments:{selector:{kind:'cohort'}}});
    expect(query.isError).not.toBe(true);expect((query.structuredContent as any).status).toBe('page');expect(callbacks).toBe(1);
    const report=await connection.client.callTool({name:'academy_teacher_report',arguments:{selector:f.selector}});
    expect(report.isError).not.toBe(true);expect((report.structuredContent as any).status).toBe('page');
    for(const frame of connection.results){expect(frame.resultBytes).toBeLessThanOrEqual(MAX_TEACHER_MCP_BYTES);expect(frame.frameBytes).toBeGreaterThan(frame.resultBytes);}
  }finally{await connection.close();}
},20000);

test('F2 canonical sibling problems and separate branches render only their actual parent paths',async()=>{
  const regular=await teacherFixture(0),doc:any=await regular.binding.readDocument(regular.selector,regular.fetchPage);
  const sourceCatalog=doc.workContext.data.exactWork.assignments[0].catalog;
  expect(sourceCatalog.find((node:any)=>node.id==='problem-1').parent.value).toBe('page');
  expect(sourceCatalog.find((node:any)=>node.id==='problem-2').parent.value).toBe('page');
  const originalLines=renderTeacherReport(doc,regular.selector);
  expect(originalLines.some(line=>line.includes('형제 항목')&&line.includes('[page]'))).toBe(true);
  const paths=originalLines.filter(line=>line.includes('계층 경로:'));
  expect(paths.some(line=>line.includes('[problem-1]')&&line.includes('[problem-2]'))).toBe(false);
  expect(paths.some(line=>line.includes('Invented page [page] > Invented problem-1 [problem-1]'))).toBe(true);
  expect(paths.some(line=>line.includes('Invented page [page] > Invented problem-2 [problem-2]'))).toBe(true);
  const branched=await branchedTeacherFixture(),branchDoc=await branched.binding.readDocument(branched.selector,branched.fetchPage);
  const branches=renderTeacherReport(branchDoc,branched.selector).filter(line=>line.includes('계층 경로:'));
  expect(branches.some(line=>line.includes('Sibling section [section-2] > Separate branch page [page-2] > Invented problem-2 [problem-2]'))).toBe(true);
  expect(branches.some(line=>line.includes('[problem-1]')&&line.includes('[section-2]'))).toBe(false);
  expect(branches.some(line=>line.includes('[section-3]')&&line.includes('상위 노드 not-returned-parent 미확인'))).toBe(true);
  expect(branches.some(line=>line.includes('[section] > Sibling section [section-2]'))).toBe(false);
});

test('F3 canonical print/distribution observations remain independent and issuance-bound',async()=>{
  for(const [printed,distributed] of [['done','unknown'],['unknown','done'],['unknown','unknown'],['not_done','done']] as const){
    const f=await reviewedTeacherFixture(printed,distributed),doc:any=await f.binding.readDocument(f.selector,f.fetchPage);
    const review=doc.workContext.data.exactWork.assignments[0].attempts[0].activityReviews[0];
    expect(review.attemptBindingQualified).toBe(true);
    const lines=renderTeacherReport(doc,f.selector),report=lines.join('\n');
    const printLines=lines.filter(line=>line.includes('- 출력:')),distributionLines=lines.filter(line=>line.includes('- 배부:'));
    expect(printLines.length).toBeGreaterThan(0);expect(distributionLines.length).toBeGreaterThan(0);
    expect(printLines.every(line=>line.includes(printed==='done'?'출력: 교사 보고 완료':printed==='not_done'?'출력: 교사 보고 미실행':'출력: 미확인'))).toBe(true);
    expect(distributionLines.every(line=>line.includes(distributed==='done'?'배부: 교사 보고 완료':'배부: 미확인'))).toBe(true);
    expect(report).not.toContain('실제 출력·배부 미확인');
    if(printed!=='unknown')expect(printLines.every(line=>line.includes('현재 응시·발행 연결 확인'))).toBe(true);
    if(distributed!=='unknown')expect(distributionLines.every(line=>line.includes('현재 응시·발행 연결 확인'))).toBe(true);
    expect(f.source.counters.append).toBe(0);
  }
  const foreign=await reviewedTeacherFixture('done','unknown',true),foreignDoc:any=await foreign.binding.readDocument(foreign.selector,foreign.fetchPage);
  const lines=renderTeacherReport(foreignDoc,foreign.selector).filter(line=>line.includes('- 출력:'));
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.every(line=>line.includes('-different')&&line.includes('현재 응시·발행 연결 미확인'))).toBe(true);
  expect(lines.some(line=>line.includes('현재 응시·발행 연결 확인'))).toBe(false);
});

test('F4 actual canonical report keeps teacher-reported, recorded, stage-observed and query-retrieved clocks separate across academy date boundary',async()=>{
  const f=await reviewedTeacherFixture('done','unknown');
  const connection=await teacherMemory({sourceRoot,authenticatedFetchPage:f.fetchPage});
  try{
    const result=await connection.client.callTool({name:'academy_teacher_report',arguments:{selector:f.selector,maxBytes:524288}});
    const report:any=result.structuredContent;
    expect(report.status).toBe('page');expect(report.page.exhausted).toBe(true);
    expect(report.text).toContain('교사 보고 '+f.reportedAt);expect(report.text).toContain('기록 '+f.recordedAt);
    expect(report.text).toContain('관측 '+f.observedAt);expect(report.text).toContain('원천 관측 '+f.source.time);
    expect(report.provenance.retrievedFirstAt).not.toBe(f.reportedAt);expect(report.provenance.retrievedFirstAt).not.toBe(f.recordedAt);
    expect(report.provenance.retrievedLastAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.provenance.retrievedLastAt).not.toBe(f.reportedAt);expect(report.provenance.retrievedLastAt).not.toBe(f.recordedAt);
    const academyDate=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
    expect(academyDate(f.reportedAt)).toBe('2090-01-01');expect(academyDate(f.recordedAt)).toBe('2090-01-02');
    expect(report.provenance.sourceClockMeaning).toContain('retrieval is not source refresh');
  }finally{await connection.close();}
});

test('actual SDK/wire retains Unicode pages, canonical refusals/drift and source guards without stdio child startup',async()=>{
  for(const mode of ['normal','malformed','snapshot','caller','refusal','transport'] as const){
    const f=await teacherFixture(30);let calls=0;
    const connection=await teacherMemory({sourceRoot,authenticatedFetchPage:async request=>{
      calls++;
      if(mode==='transport')throw Error('invented_private_exception');
      if(mode==='refusal')return {schema:'academy.retained-query.v1',status:'refused',code:'owner_scope_conflict',records:[],automaticRetry:false};
      const reply=await f.fetchPage(request);
      if(mode==='malformed')return {...reply,extra:'invented_private_field'};
      if(reply.status==='page'&&calls===2){if(mode==='snapshot')reply.snapshot='b'.repeat(64);if(mode==='caller')reply.callerBinding='c'.repeat(64);}
      return reply;
    }});
    try{
      if(mode==='normal'){
        const document:any=await f.binding.readDocument(f.selector,async request=>{
          const result=await connection.client.callTool({name:'academy_teacher_query',arguments:request as Record<string,unknown>});return result.structuredContent;
        });
        expect(calls).toBeGreaterThan(1);const notes=document.evidence.filter((r:any)=>r.payload.kind==='teacher_reported_note');
        expect(notes).toHaveLength(30);expect(new Set(notes.map((r:any)=>r.revisionId)).size).toBe(30);expect(notes[0].payload.text).toContain('가😀');
      }else{
        const result=await connection.client.callTool({name:'academy_teacher_report',arguments:{selector:f.selector}});
        const data:any=result.structuredContent;expect(data.status).toBe('refused');expect(data.automaticRetry).toBe(false);
        const expected=mode==='malformed'?'retained_page_contract_conflict':mode==='snapshot'||mode==='caller'?'retained_page_snapshot_conflict':mode==='refusal'?'owner_scope_conflict':'teacher_source_authenticated_transport_unavailable';
        expect(data.code).toBe(expected);expect(calls).toBe(mode==='snapshot'||mode==='caller'?2:1);expect(JSON.stringify(result)).not.toContain('invented_private');
      }
      for(const frame of connection.results)expect(frame.resultBytes).toBeLessThanOrEqual(MAX_TEACHER_MCP_BYTES);
    }finally{await connection.close();}
  }
  for(const failAt of [1,2]){
    const f=await teacherFixture(0);let guards=0,fetches=0;
    const binding={...f.binding,assertCurrent:async()=>{if(++guards===failAt)throw Error('teacher_source_bytes_conflict');}};
    const service=new TeacherRetainedService(binding,request=>{fetches++;return f.fetchPage(request);});
    const result:any=await service.report({selector:f.selector});expect(result.code).toBe('teacher_source_bytes_conflict');expect(fetches).toBe(failAt===1?0:1);
  }
},20000);

test('near-cap accepted CallToolResult stays within512KiB while its separately measured JSONRPC frame may exceed it',async()=>{
  const f=await teacherFixture(160),notes=f.source.rows.filter((record:any)=>record.payload.kind==='teacher_reported_note') as any[];
  notes.forEach((record,index)=>{record.payload.text=`near-cap-note-${index}:`+record.payload.text+'a'.repeat(1000);});
  const service=new TeacherRetainedService(f.binding,f.fetchPage),request={selector:f.selector,maxBytes:MAX_TEACHER_MCP_BYTES,limit:250};
  const initial:any=await service.report(request);expect(initial.status).toBe('page');expect(initial.page.exhausted).toBe(false);
  const last=[...initial.text.matchAll(/near-cap-note-(\d+):/g)].at(-1)!;
  const padding=Math.max(0,Math.floor((MAX_TEACHER_MCP_BYTES-toolResultBytes(initial)-1)/2));
  notes[Number(last[1])].payload.text+='a'.repeat(padding);
  const connection=await teacherMemory({sourceRoot,authenticatedFetchPage:f.fetchPage});
  try{
    const result=await connection.client.callTool({name:'academy_teacher_report',arguments:request});
    expect((result.structuredContent as any).status).toBe('page');
    const measured=connection.results.at(-1)!;
    expect(measured.resultBytes).toBeLessThanOrEqual(MAX_TEACHER_MCP_BYTES);
    expect(measured.resultBytes).toBeGreaterThan(MAX_TEACHER_MCP_BYTES-32);
    expect(measured.frameBytes).toBeGreaterThan(MAX_TEACHER_MCP_BYTES);expect(measured.frameBytes).toBeGreaterThan(measured.resultBytes);
    console.log(JSON.stringify({measurement:'teacher-near-cap-result-and-frame',resultBytes:measured.resultBytes,frameBytes:measured.frameBytes,frameOverheadBytes:measured.frameBytes-measured.resultBytes,frameAccepted:true,universalFrameCapClaim:false}));
    expect(f.source.counters.append).toBe(0);
  }finally{await connection.close();}
},20000);
