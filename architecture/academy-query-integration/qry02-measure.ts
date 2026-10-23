/** Synthetic production-facade/HTTP measurements. No native latency or current source claim. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {retainedFixture} from '../../apps/academy/dc-gang-a/tests/academy/retainedQueryFixtures';
import {readRetainedDocument} from '../../apps/academy/dc-gang-a/src/academy/retainedQueryClient';
import {createTeacherServerHandler} from '../../apps/academy/dc-gang-a/src/academy/server';
import {signTeacherSession} from '../../apps/academy/dc-gang-a/src/academy/auth';
import {canonicalJson} from '../../apps/academy/dc-gang-a/src/learning/model';
import type {RetainedSelector,RetainedQueryReply} from '../../apps/academy/dc-gang-a/src/academy/contracts/retainedQuery';
const output=process.argv[2]??'architecture/academy-query-integration/observations/QRY-02-MEASUREMENTS-R1.json';
assert(/^architecture\/academy-query-integration\/observations\/QRY-02-MEASUREMENTS-R[123]\.json$/.test(output));
assert(!existsSync(output),'immutable measurement exists');
const measurements=[];
for(const kind of ['student','cohort','class_preparation'] as const){
  const f=retainedFixture(kind==='cohort'?700:1,120);
  const selector:RetainedSelector=kind==='student'?{kind,studentId:f.student.id,date:f.date}:kind==='cohort'?{kind}:{kind,date:f.date};
  let facadeCalls=0;
  for(const name of ['student','cohort','classPreparation'] as const){const original=f.app[name].bind(f.app) as (...args:any[])=>Promise<any>;(f.app as any)[name]=(...args:any[])=>{facadeCalls++;return original(...args);};}
  const expected=kind==='student'?await f.app.student(f.actor,f.student.id,f.date):kind==='cohort'?await f.app.cohort(f.actor):await f.app.classPreparation(f.actor,f.date);
  const single={facadeCalls,sourceLoads:{...f.counters},jsonBytes:Buffer.byteLength(JSON.stringify(expected))};
  for(const key of Object.keys(f.counters))f.counters[key]=0;facadeCalls=0;
  const origin='https://synthetic-query.invalid',key='synthetic-measurement-key';
  const handler=createTeacherServerHandler({app:f.app,origin,sessionKey:key,identity:{actorId:f.actor.actorId,username:'synthetic',passwordHash:'unused'},invitationDigest:null,saveIdentity:async()=>{throw Error('unexpected write');}});
  const pageBytes:number[]=[],recordCounts:number[]=[],retrievedAt:string[]=[],snapshots=new Set<string>();
  const actual=await readRetainedDocument(selector,async input=>{
    const response=await handler(new Request(origin+'/api/retained-query',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'dc_teacher='+signTeacherSession(key,f.owner,f.actor.actorId)},body:JSON.stringify(input)}));
    assert.equal(response.status,200);const text=await response.text(),bytes=Buffer.byteLength(text),reply=JSON.parse(text) as RetainedQueryReply;
    if(reply.status!=='page')throw Error(reply.code);
    assert.equal(bytes,reply.page.serializedBytes);assert(bytes<=reply.page.maxBytes);pageBytes.push(bytes);recordCounts.push(reply.records.length);retrievedAt.push(reply.retrievedAt);snapshots.add(reply.snapshot);return reply;
  });
  assert.equal(canonicalJson(actual),canonicalJson(expected));assert.equal(snapshots.size,1);assert.equal(facadeCalls,pageBytes.length);assert.equal(f.counters.snapshots,pageBytes.length);assert.equal(f.counters.append,0);
  measurements.push({selectorKind:kind,fixture:{students:f.students.length,notes:120,realData:false},equivalentCanonicalDocument:true,
    singleFacadeRead:single,pagedHttp:{pages:pageBytes.length,facadeCalls,sourceLoads:{...f.counters},pageBytes,totalJsonBytes:pageBytes.reduce((a,b)=>a+b,0),maxPageBytes:Math.max(...pageBytes),recordCounts,totalRecords:recordCounts.reduce((a,b)=>a+b,0),snapshotCount:snapshots.size},
    interpretation:'Stateless bounded delivery reloads the full canonical facade once per page; more calls/bytes than one unbounded JSON response are expected. No native source request, latency reduction or production latency measured.'});
}
await Bun.write(output,JSON.stringify({schema:'academy.qry02-measurements.v1',createdAt:new Date().toISOString(),sourceBase:'29510c7ee9a5f8e6fc68bb6dbe5cf320bb66fc95',nativeThreadId:process.env.CODEX_THREAD_ID,measurements,
  pageBudgetMeaning:'Actual UTF-8 JSON HTTP page including all metadata, fragments and cursor; default65536,max131072 bytes. This is NOT the downstream duplicated MCP CallToolResult512KiB budget.',
  downstreamRequirement:'Workbench CON must use its real production CallToolResult packager and qualify escaping, duplicated content and refusal under512KiB. Existing browser modelContext/CLI final aggregation is a separate output boundary.',
  currentness:'Authoritative source currentness unknown; source clocks remain in exact reconstructed document and retrievedAt is page delivery time.',nativeLatencyMeasured:false,nativeEffects:0},null,2)+'\n');
console.log(JSON.stringify({status:'pass',output,measurements:measurements.map(r=>({kind:r.selectorKind,pages:r.pagedHttp.pages,maxBytes:r.pagedHttp.maxPageBytes,totalBytes:r.pagedHttp.totalJsonBytes,facadeCalls:r.pagedHttp.facadeCalls}))}));
