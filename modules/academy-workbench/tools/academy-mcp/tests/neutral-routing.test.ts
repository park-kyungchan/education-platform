import {expect,test} from 'bun:test';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {context,fact} from './dailyrecord-fixture.ts';
async function withNeutralClient(run:(fixture:{base:string;events:string;client:Client})=>Promise<void>){
  const base=await mkdtemp(resolve(tmpdir(),'academy-neutral-synthetic-'));
  const entry=resolve(import.meta.dir,'../src/neutral-server.ts'),deny=resolve(import.meta.dir,'network-deny.ts'),events=resolve(base,'events.txt');
  const admission={schemaVersion:'academy.owner-admission/1',decider:'user',decidedAt:'2040-01-16',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',
    allowedFrom:'2040-01-15',allowedThrough:'2040-01-17',failClosedDefault:'2026-10-23'};
  const bytes=JSON.stringify(admission),admissionPath=resolve(base,'admission.json');
  const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
  let client:Client|undefined,transport:StdioClientTransport|undefined;
  try{
    await writeFile(admissionPath,bytes);await writeFile(resolve(base,'routing.json'),JSON.stringify({admissionPath,admissionSha256:createHash('sha256').update(bytes).digest('hex')}));
    await writeFile(resolve(base,'endpoints.json'),JSON.stringify({dailyrecord:{command:process.execPath,args:['--preload',deny,resolve(import.meta.dir,'neutral-upstream-fixture.ts'),events]}}));
    const discovery=Bun.spawn([process.execPath,'--preload',deny,entry,'--discover'],{env,stdout:'pipe',stderr:'pipe'});
    expect(await discovery.exited).toBe(0);expect((await readFile(events,'utf8')).trim().split('\n')).toEqual(['start']);
    client=new Client({name:'fictional-neutral-client',version:'1.0.0'});
    transport=new StdioClientTransport({command:process.execPath,args:['--preload',deny,entry],env,stderr:'pipe'});await client.connect(transport);
    await run({base,events,client});
  }finally{await client?.close();await transport?.close();await rm(base,{recursive:true,force:true});}
}
test('neutral MCP runs resolve and intake in one upstream lifetime and logs metadata only',async()=>{
  await withNeutralClient(async({base,events,client})=>{
    const tools=(await client.listTools()).tools,tool=tools.find(t=>t.name==='academy_dailyrecord_get')!;
    expect(tools.filter(t=>t.name===tool.name)).toHaveLength(1);expect(tool.inputSchema.required).not.toContain('lessonDate');
    expect(tool.inputSchema.additionalProperties).toBe(false);
    const request={displayName:'Invented Student',purpose:'Read a fictional source',currentRequestRef:'fictional-neutral-request',lessonDate:'2040-01-16'};
    const result=await client.callTool({name:tool.name,arguments:request});
    expect(result.isError).not.toBe(true);expect(result.structuredContent).toMatchObject({status:'observed',sourceAvailability:'observed',academyWrites:0,parentSends:0});
    expect((await readFile(events,'utf8')).trim().split('\n')).toEqual(['start','start','resolve','intake']);
    const receipts=await readdir(resolve(base,'receipts')),saved=await Promise.all(receipts.map(n=>readFile(resolve(base,'receipts',n),'utf8')));
    expect(saved).toHaveLength(2);
    expect(saved.join('')).not.toContain('Invented Student');expect(saved.join('')).not.toContain('기존 준비물');
    expect(JSON.parse(saved.find(s=>s.includes('completedAt'))!)).toMatchObject({sourceAvailability:'observed',steps:[{tool:'academy_student_resolve',status:'resolved'},{tool:'academy_dailyrecord_intake',sourceAvailability:'observed'}]});
    const denied=await client.callTool({name:tool.name,arguments:{...request,teacherId:'99002'}});expect(denied.isError).toBe(true);
    expect((await readFile(events,'utf8')).match(/intake/g)).toHaveLength(1);
  });
},20000);
test('neutral review accepts an identical scope in a different key order and still refuses foreign scope/request',async()=>{
  await withNeutralClient(async({events,client})=>{
    const input={...context(),selectedFields:['attendance'],facts:[{...fact('attendance','Fictional explicit attendance'),explicitValue:'Y'}]};
    const reordered={lessonDate:input.scope.lessonDate,studentId:input.scope.studentId,teacherId:input.scope.teacherId,sourceNamespace:input.scope.sourceNamespace};
    expect(Object.keys(reordered)).not.toEqual(Object.keys(input.scope));
    // Exercise both issuance orders: the ticket and the submitted scope must be normalized.
    for(const [issued,reviewed] of [[input.scope,reordered],[reordered,input.scope]]){
      const intake=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:{...input,scope:issued}}});
      const handle=(intake.structuredContent as any).observationHandle;
      expect(handle).toStartWith('muse-academy-observation:');
      const args={context:{...input,scope:reviewed},observationHandle:handle,
        proposals:[{field:'attendance',value:'Y',factRefs:['user-fact:attendance'],decision:{kind:'replace',requestRef:input.currentRequestRef}}]};
      const review=await client.callTool({name:'academy_dailyrecord_review',arguments:args});
      expect(review.isError).not.toBe(true);expect(review.structuredContent).toMatchObject({status:'prepared',patch:[],academyWrites:0,parentSends:0});
      for(const foreignContext of [{...args.context,scope:{...reviewed,teacherId:'other-fictional-teacher'}},{...args.context,currentRequestRef:'other-fictional-request'}]){
        const before=await readFile(events,'utf8');
        const refused=await client.callTool({name:'academy_dailyrecord_review',arguments:{...args,context:foreignContext}});
        expect(refused.isError).toBe(true);expect(JSON.parse((refused.content as any)[0].text).code).toBe('observation_ticket_expired_or_foreign');
        expect((await readFile(events,'utf8')).slice(before.length)).toBe('start\n');
      }
    }
  });
},20000);
test('neutral no-argument calls normalize omitted arguments before dispatch hashing and forward the empty object',async()=>{
  await withNeutralClient(async({base,events,client})=>{
    const result=await client.callTool({name:'academy_source_status'});
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({sourceMode:'saved_context',synthetic:true,receivedArguments:{}});
    expect((await readFile(events,'utf8')).trim().split('\n')).toEqual(['start','start','source_status:{}']);
    const receipts=await readdir(resolve(base,'receipts'));
    const dispatch=JSON.parse(await readFile(resolve(base,'receipts',receipts.find(n=>n.endsWith('-dispatch.json'))!),'utf8'));
    expect(dispatch.argumentsSha256).toBe(createHash('sha256').update('{}').digest('hex'));
    expect(receipts.some(n=>n.endsWith('-result.json'))).toBe(true);expect(receipts.some(n=>n.endsWith('-failure.json'))).toBe(false);
  });
},20000);
