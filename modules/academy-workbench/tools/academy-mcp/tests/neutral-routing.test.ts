import {expect,test} from 'bun:test';
import {mkdtemp,readFile,writeFile,readdir,rm,rename,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {context,fact} from './dailyrecord-fixture.ts';
async function withNeutralClient(run:(fixture:{base:string;events:string;client:Client})=>Promise<void>,includeSaved=false,includeNativePool=false,saveAlias=false){
  const base=await mkdtemp(resolve(tmpdir(),'academy-neutral-synthetic-'));
  const entry=process.env.ACADEMY_NEUTRAL_TEST_BUNDLE??resolve(import.meta.dir,'../src/neutral-server.ts');
  const deny=resolve(import.meta.dir,'network-deny.ts'),events=resolve(base,'events.txt');
  const admission={schemaVersion:'academy.owner-admission/1',decider:'user',decidedAt:'2040-01-16',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',
    allowedFrom:'2040-01-15',allowedThrough:'2040-01-17',failClosedDefault:'2026-10-23'};
  const bytes=JSON.stringify(admission),admissionPath=resolve(base,'admission.json');
  const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
  let client:Client|undefined,transport:StdioClientTransport|undefined;
  try{
    await writeFile(admissionPath,bytes);await writeFile(resolve(base,'routing.json'),JSON.stringify({admissionPath,admissionSha256:createHash('sha256').update(bytes).digest('hex')}));
    const endpoints:any={dailyrecord:{command:process.execPath,args:['--preload',deny,resolve(import.meta.dir,'neutral-upstream-fixture.ts'),events]}};
    if(includeSaved)endpoints.saved={command:process.execPath,args:['--preload',deny,resolve(import.meta.dir,'neutral-saved-fixture.ts')]};
    if(includeNativePool)endpoints.paper1={command:process.execPath,args:['--preload',deny,resolve(import.meta.dir,'../src/pool-server.ts')]};
    await writeFile(resolve(base,'endpoints.json'),JSON.stringify(endpoints));
    const discovery=Bun.spawn([process.execPath,'--preload',deny,entry,'--discover'],{env,stdout:'pipe',stderr:'pipe'});
    expect(await discovery.exited).toBe(0);expect((await readFile(events,'utf8')).trim().split('\n')).toEqual(['start']);
    if(saveAlias){const path=resolve(base,'registry.json'),registry=JSON.parse(await readFile(path,'utf8'));registry.find((r:any)=>r.upstreamName==='academy_dailyrecord_save').tool.name='fictional_save_alias';await writeFile(path,JSON.stringify(registry));}
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
test('neutral save composes intake, review and save in one upstream lifetime',async()=>{
  await withNeutralClient(async({events,client})=>{
    const c=context();
    const intake:any=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:c}});
    expect(intake.structuredContent?.observationHandle).toContain('muse-academy-observation:');
    const startsBefore=((await readFile(events,'utf8')).match(/start/g)??[]).length;
    const saved:any=await client.callTool({name:'academy_dailyrecord_save',arguments:{context:c,observationHandle:intake.structuredContent.observationHandle,
      reviewDigest:'9'.repeat(64),proposals:[{field:'progress',value:'- 지정 문제 12문항 풀이 진행.',factRefs:['user-fact:progress'],decision:{kind:'replace',requestRef:c.currentRequestRef}}]}});
    // The fixture upstream has no write backend: reaching its fail-closed
    // save response (instead of a process-local handle error) proves the
    // bridge recomposed intake/review/save inside one upstream process.
    expect(saved.structuredContent).toMatchObject({reasonCode:'dailyrecord_save_backend_not_configured',academyWrites:0});
    const startsAfter=((await readFile(events,'utf8')).match(/start/g)??[]).length;
    expect(startsAfter-startsBefore).toBe(1);
  });
},20000);
test('save receipt failure preserves uncertainty after an issued synthetic write',async()=>{
  await withNeutralClient(async({base,events,client})=>{
    await writeFile(resolve(base,'inject-save-receipt-failure'),'enabled');
    const c=context();
    const intake:any=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:c}});
    const saved:any=await client.callTool({name:'academy_dailyrecord_save',arguments:{context:c,observationHandle:intake.structuredContent.observationHandle,
      reviewDigest:'9'.repeat(64),proposals:[{field:'progress',value:'- 지정 문제 12문항 풀이 진행.',factRefs:['user-fact:progress'],decision:{kind:'replace',requestRef:c.currentRequestRef}}]}});
    expect(await readFile(events,'utf8')).toContain('synthetic-save');
    expect(saved.isError).toBe(true);
    expect(saved.structuredContent).toMatchObject({academyWrites:null,effectStatus:'unknown',automaticRetryAllowed:false});
    const names=await readdir(resolve(base,'receipts'));
    const failure=JSON.parse(await readFile(resolve(base,'receipts',names.find(n=>n.endsWith('-failure.json'))!),'utf8'));
    expect(failure).toMatchObject({academyWrites:null,effectStatus:'unknown',automaticRetryAllowed:false});
  });
},20000);
test('save result receipt preserves an uncertain synthetic backend result',async()=>{
  await withNeutralClient(async({base,events,client})=>{
    await writeFile(resolve(base,'inject-uncertain-save'),'enabled');
    const c=context();
    const intake:any=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:c}});
    const saved:any=await client.callTool({name:'academy_dailyrecord_save',arguments:{context:c,observationHandle:intake.structuredContent.observationHandle,
      reviewDigest:'9'.repeat(64),proposals:[{field:'progress',value:'- 지정 문제 12문항 풀이 진행.',factRefs:['user-fact:progress'],decision:{kind:'replace',requestRef:c.currentRequestRef}}]}});
    expect(await readFile(events,'utf8')).toContain('synthetic-save');
    expect(saved.structuredContent).toMatchObject({academyWrites:null,automaticRetryAllowed:false});
    const names=await readdir(resolve(base,'receipts'));
    const results=await Promise.all(names.filter(n=>n.endsWith('-result.json')).map(async n=>JSON.parse(await readFile(resolve(base,'receipts',n),'utf8'))));
    expect(results.find(r=>r.tool==='academy_dailyrecord_save')).toMatchObject({academyWrites:null,automaticRetryAllowed:false});
  });
},20000);
test('save alias records the upstream uncertain write count',async()=>{
  await withNeutralClient(async({base,client})=>{
    await writeFile(resolve(base,'inject-uncertain-save'),'enabled');
    const c=context();
    const intake:any=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:c}});
    const saved:any=await client.callTool({name:'fictional_save_alias',arguments:{context:c,observationHandle:intake.structuredContent.observationHandle,
      reviewDigest:'9'.repeat(64),proposals:[{field:'progress',value:'- 지정 문제 12문항 풀이 진행.',factRefs:['user-fact:progress'],decision:{kind:'replace',requestRef:c.currentRequestRef}}]}});
    expect(saved.structuredContent).toMatchObject({academyWrites:null});
    const names=await readdir(resolve(base,'receipts'));
    const results=await Promise.all(names.filter(n=>n.endsWith('-result.json')).map(async n=>JSON.parse(await readFile(resolve(base,'receipts',n),'utf8'))));
    expect(results.find(r=>r.tool==='fictional_save_alias')).toMatchObject({academyWrites:null});
  },false,false,true);
},20000);
test('neutral MCP exposes exact item-answer reads and does not write answer literals to receipts',async()=>{
  await withNeutralClient(async({base,events,client})=>{
    expect((await client.listTools()).tools.filter(t=>t.name==='academy_item_answer_lookup')).toHaveLength(1);
    const result=await client.callTool({name:'academy_item_answer_lookup',arguments:{labels:['12345'],purpose:'Fictional item read',currentRequestRef:'fictional'}});
    expect(result.structuredContent).toMatchObject({status:'observed',answers:[{identity:{lectureKey:'12345'},answerLiteral:'invented answer'}],nativePrintInvoked:false});
    expect(await readFile(events,'utf8')).toContain('answer');
    const receipts=await readdir(resolve(base,'receipts'));
    expect((await Promise.all(receipts.map(n=>readFile(resolve(base,'receipts',n),'utf8')))).join('')).not.toContain('invented answer');
  });
},20000);
test('neutral discovery retains available read tools and suppresses duplicate native routes',async()=>{
  await withNeutralClient(async({client})=>{
    const names=(await client.listTools()).tools.map(t=>t.name);
    for(const name of ['academy_item_label_scope','academy_find_item_labels','academy_review_type_questions','academy_cism_section',
      'academy_item_answer_lookup','academy_runtime_read_admission','academy_dailyrecord_get'])expect(names.filter(v=>v===name)).toHaveLength(1);
    const result=await client.callTool({name:'academy_item_label_scope',arguments:{}});
    expect(result.structuredContent).toMatchObject({status:'unavailable'});
  },true);
},20000);
test('saved/native label discovery preserves both sources under unique names in a pinned release',async()=>{
 await withNeutralClient(async({base,client})=>{
  const registry=JSON.parse(await readFile(resolve(base,'registry.json'),'utf8'));
  for(const name of ['academy_item_label_scope','academy_find_item_labels','academy_review_type_questions']){
   expect(registry.find((entry:any)=>entry.tool.name===name)?.endpoint).toBe('paper1');
   expect(registry.find((entry:any)=>entry.tool.name==='saved_'+name)).toMatchObject({endpoint:'saved',upstreamName:name});
  }
  const pin=async(path:string)=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
  await writeFile(resolve(base,'release.json'),JSON.stringify({schemaVersion:'academy.mcp-release/1',generation:'native-saved-labels',routing:await pin(resolve(base,'routing.json')),endpoints:await pin(resolve(base,'endpoints.json')),registry:await pin(resolve(base,'registry.json'))}),{mode:0o600,flag:'wx'});
  const names=(await client.listTools()).tools.map(tool=>tool.name);expect(new Set(names).size).toBe(names.length);
  for(const name of ['academy_item_label_scope','saved_academy_item_label_scope']){
   const result=await client.callTool({name,arguments:{}});expect(result.isError).not.toBe(true);expect(result.structuredContent).toMatchObject({status:'unavailable'});
  }
 },true,true);
},30000);
test('an existing session atomically switches pinned release generations and never falls back after removal',async()=>{
  await withNeutralClient(async({base,events,client})=>{
    const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
    const pinned=async(name:string,value:unknown)=>{
      const bytes=typeof value==='string'?value:JSON.stringify(value),path=resolve(base,name);
      await writeFile(path,bytes,{mode:0o600});return {path,sha256:hash(bytes)};
    };
    const endpointTemplate=JSON.parse(await readFile(resolve(base,'endpoints.json'),'utf8'));
    const registry=await pinned('registry-v1.json',await readFile(resolve(base,'registry.json'),'utf8'));
    const publish=async(generation:string,through:string,upstreamThrough=through,invalidDigest=false,scope?:'configured'|'source_verified',upstreamScope=scope,registryRef=registry)=>{
      const endpoints=await pinned(`endpoints-${generation}.json`,{...endpointTemplate,dailyrecord:{...endpointTemplate.dailyrecord,
        args:[...endpointTemplate.dailyrecord.args,upstreamThrough,...(upstreamScope?[upstreamScope]:[])]}});
      const admission=await pinned(`admission-${generation}.json`,{schemaVersion:scope?'academy.owner-admission/2':'academy.owner-admission/1',decider:'user',decidedAt:'2040-01-16',
        sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',allowedFrom:'2040-01-15',allowedThrough:through,failClosedDefault:'2026-10-23',...(scope?{studentScope:scope}:{})});
      const routing=await pinned(`routing-${generation}.json`,{admissionPath:admission.path,admissionSha256:admission.sha256});
      const next=resolve(base,`release-${generation}.tmp`);
      await writeFile(next,JSON.stringify({schemaVersion:'academy.mcp-release/1',generation,
        routing:invalidDigest?{...routing,sha256:'0'.repeat(64)}:routing,endpoints,registry:registryRef}),{mode:0o600});
      await rename(next,resolve(base,'release.json'));
    };
    const request={displayName:'Invented Student',purpose:'Synthetic read',currentRequestRef:'synthetic-release',lessonDate:'2040-01-16'};
    await publish('v1','2040-01-15');
    const denied=await client.callTool({name:'academy_dailyrecord_get',arguments:request});
    expect(denied.structuredContent).toMatchObject({status:'unavailable',reasonCode:'lesson_date_out_of_admitted_scope'});
    expect(await readFile(events,'utf8')).not.toContain('resolve');
    await publish('v2','2040-01-17');
    const observed=await client.callTool({name:'academy_dailyrecord_get',arguments:request});
    expect(observed.structuredContent).toMatchObject({status:'observed',sourceAvailability:'observed'});
    await publish('v3','2040-01-17','2040-01-15');
    const before=await readFile(events,'utf8');
    const mismatch=await client.callTool({name:'academy_dailyrecord_get',arguments:request});
    expect(mismatch.isError).toBe(true);
    expect(JSON.parse((mismatch.content as any)[0].text).code).toBe('release_upstream_admission_mismatch');
    expect((await readFile(events,'utf8')).slice(before.length)).toBe('start\n');
    await publish('bad-digest','2040-01-17','2040-01-17',true);
    const badDigest=await client.callTool({name:'academy_dailyrecord_get',arguments:request});
    expect(badDigest.isError).toBe(true);
    expect(JSON.parse((badDigest.content as any)[0].text).code).toBe('label_snapshot_hash_mismatch');
    await publish('v4','2040-01-17');
    expect((await client.callTool({name:'academy_dailyrecord_get',arguments:request})).structuredContent).toMatchObject({status:'observed'});
    await publish('v5','2040-01-17','2040-01-17',false,'source_verified','configured');
    const scopeMismatch=await client.callTool({name:'academy_dailyrecord_get',arguments:request});
    expect(scopeMismatch.isError).toBe(true);
    expect(JSON.parse((scopeMismatch.content as any)[0].text).code).toBe('release_upstream_admission_mismatch');
    const entries=JSON.parse(await readFile(resolve(base,'registry.json'),'utf8'));
    const duplicate=await pinned('registry-duplicate.json',[...entries,entries[0]]);
    await publish('duplicate','2040-01-17','2040-01-17',false,undefined,undefined,duplicate);
    const malformed=await client.callTool({name:'academy_dailyrecord_get',arguments:request});
    expect(malformed.isError).toBe(true);
    expect(JSON.parse((malformed.content as any)[0].text).code).toBe('release_payload_unqualified');
    await publish('v6','2040-01-17','2040-01-17',false,'source_verified','source_verified');
    expect((await client.callTool({name:'academy_dailyrecord_get',arguments:request})).structuredContent).toMatchObject({status:'observed'});
    await unlink(resolve(base,'release.json'));
    const held=await client.callTool({name:'academy_dailyrecord_get',arguments:request});
    expect(held.isError).toBe(true);
    expect(JSON.parse((held.content as any)[0].text).code).toBe('release_pointer_missing');
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
