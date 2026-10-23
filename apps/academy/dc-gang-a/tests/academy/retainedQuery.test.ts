import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {canonicalJson} from '../../src/learning/model';
import {createRetainedQueryReader} from '../../src/academy/retainedQuery';
import {readRetainedDocument} from '../../src/academy/retainedQueryClient';
import {retainedQueryLimits,type RetainedQueryPage,type RetainedSelector,type RetainedQueryReply} from '../../src/academy/contracts/retainedQuery';
import {createTeacherServerHandler} from '../../src/academy/server';
import {signTeacherSession} from '../../src/academy/auth';
import {known,unknown} from '../../src/learning/model';
import type {StudentWorkspaceVersion} from '../../src/academy/ownerWorkspaceStore';
import {retainedFixture} from './retainedQueryFixtures';

const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value));
async function collect(f:ReturnType<typeof retainedFixture>,selector:RetainedSelector){const pages:RetainedQueryPage[]=[];const result=await readRetainedDocument<any>(selector,async request=>{const page=await f.app.retainedQuery(f.actor,request);if(page.status==='page')pages.push(page);return page;});return {result,pages};}
function handler(f:ReturnType<typeof retainedFixture>){
  let current:{identity:{actorId:string;username:string;passwordHash:string}|null;sessionKey:string}={identity:{actorId:f.actor.actorId,username:'synthetic',passwordHash:'unused'},sessionKey:'synthetic-session-key'};
  const fetch=createTeacherServerHandler({app:f.app,origin:'https://query.invalid',sessionKey:current.sessionKey,identity:current.identity,invitationDigest:null,saveIdentity:async()=>{throw Error('unexpected');},currentAuthentication:()=>current});
  const call=(body:unknown,change:Record<string,string>={},cookie=true)=>fetch(new Request('https://query.invalid/api/retained-query',{method:'POST',headers:{Origin:'https://query.invalid','Content-Type':'application/json',...(cookie?{Cookie:'dc_teacher='+signTeacherSession('synthetic-session-key',f.owner,f.actor.actorId)}:{}),...change},body:JSON.stringify(body)}));
  return {call,setCurrent:(value:typeof current)=>{current=value;},fetch};
}
describe('retained current-state production query path',()=>{
  test('reconstructs every requested student field through real facade/snapshot/projections with exact DOM02 meaning',async()=>{
    const f=retainedFixture(),expected=await f.app.student(f.actor,f.student.id,f.date);f.counters.snapshots=0;
    const {result,pages}=await collect(f,{kind:'student',studentId:f.student.id,date:f.date});
    expect(canonicalJson(result)).toBe(canonicalJson(expected));expect(pages.length).toBeGreaterThan(1);expect(f.counters.snapshots).toBe(pages.length);expect(f.counters.append).toBe(0);
    const exact=result.workContext.data.exactWork,attempt=exact.assignments.find((r:any)=>r.record.entityId==='work-A').attempts[0];
    expect(attempt.defaultClinicTargets).toEqual({wrong:'excluded_exact_100',similar:'excluded_exact_100'});expect(attempt.completed).toBe(false);
    expect(exact.currentObligations.some((r:any)=>r.assignmentRevisionId==='explicit-r1')).toBe(true);expect(exact.currentObligations.some((r:any)=>r.assignmentRevisionId==='withdrawn-r1')).toBe(false);
    expect(result.student.sourceKey.namespace).toBe('academy_student');expect(result.officialSaved).toBe(false);expect(pages[0]!.coverage.authoritativeCurrentness).toBe('unknown');
    for(const page of pages){expect(bytes(page)).toBe(page.page.serializedBytes);expect(bytes(page)).toBeLessThanOrEqual(page.page.maxBytes);expect(page.omissions.length).toBeGreaterThan(0);}
  });
  test.each(['cohort','class_preparation'] as const)('%s preserves canonical fields and original source clocks',async kind=>{
    const f=retainedFixture(350,0),selector=kind==='cohort'?{kind} as const:{kind,date:f.date} as const;
    const original=kind==='cohort'?await f.app.cohort(f.actor):await f.app.classPreparation(f.actor,f.date);
    const {result}=await collect(f,selector);expect(canonicalJson(result)).toBe(canonicalJson(original));
  });
  test('class selector uses exact observed group without equating missing rows to absence',async()=>{
    const f=retainedFixture(1,0);const {result,pages}=await collect(f,{kind:'class_preparation',date:f.date,groupId:'2'});
    expect(result.rows).toHaveLength(1);expect(result.rows[0].occurrence.groupId).toBe('2');expect(result.rowCount).toBe(1);expect(pages[0]!.coverage.sourceRowCount).toBe(2);expect(result.knowledge.completeCurrentRoster).toBe('not_established');
    expect((await collect(f,{kind:'class_preparation',date:f.date,groupId:'missing'})).result.knowledge.missingRows).toBe('not_evidence_of_absence_or_nonperformance');
  });
  // Operational check budget: observed 13.234s; 5x former 5s, not a product/business deadline.
  test('page JSON bytes include fixed metadata, Unicode, escapes and actual continuation without truncation',async()=>{
    const f=retainedFixture(),selector={kind:'student',studentId:f.student.id,date:f.date} as const;let cursor:string|null=null,offset=0,pages=0;const all:any[]=[];
    do{const page=await f.app.retainedQuery(f.actor,{selector,cursor,limit:250,maxBytes:4096});expect(page.status).toBe('page');if(page.status!=='page')throw Error(page.code);expect(bytes(page)).toBe(page.page.serializedBytes);expect(bytes(page)).toBeLessThanOrEqual(4096);expect(page.page.offset).toBe(offset);all.push(...page.records);offset+=page.records.length;cursor=page.page.nextCursor;pages++;if(pages>1000)throw Error('no progress');}while(cursor);
    expect(all.map(r=>r.ordinal)).toEqual(Array.from({length:all.length},(_,i)=>i));expect(new Set(all.map(r=>JSON.stringify(r.path))).size).toBe(all.length);expect(pages).toBeGreaterThan(1);
  },25000);
  test.each(['actor','owner','selector','date','limit','budget','forged'] as const)('cursor refuses changed %s before facade read',async change=>{
    const f=retainedFixture(),input:any={selector:{kind:'student',studentId:f.student.id,date:f.date},limit:1,maxBytes:4096};const first=await f.app.retainedQuery(f.actor,input);expect(first.status).toBe('page');if(first.status!=='page')return;
    const actor={...f.actor};input.cursor=first.page.nextCursor;if(change==='actor')actor.actorId='other';if(change==='owner')actor.ownerId='other';if(change==='selector')input.selector.studentId='other';if(change==='date')input.selector.date='2090-01-04';if(change==='limit')input.limit=2;if(change==='budget')input.maxBytes=8192;if(change==='forged')input.cursor=input.cursor.slice(0,-5)+'aaaaa';
    const before=f.counters.snapshots,reply=await f.app.retainedQuery(actor,input);expect(reply.status).toBe('refused');expect(f.counters.snapshots).toBe(before);
  });
  test('source/verification/teacher revision drift refuses an old continuation after one canonical snapshot',async()=>{
    const f=retainedFixture(),input={selector:{kind:'student',studentId:f.student.id,date:f.date},limit:1,maxBytes:4096};const first=await f.app.retainedQuery(f.actor,input);if(first.status!=='page')throw Error('first page expected');
    f.rows[0]!.lastVerifiedAt='2090-01-04T00:00:00.000Z';const next=await f.app.retainedQuery(f.actor,{...input,cursor:first.page.nextCursor});expect(next).toMatchObject({status:'refused',code:'retained_snapshot_conflict'});
  });
  test('caller mutation during a yielded read does not redirect the selection',async()=>{
    const f=retainedFixture(),input={selector:{kind:'student',studentId:f.student.id,date:f.date},limit:1,maxBytes:4096},actor={...f.actor};f.setDuringRead(()=>{input.selector.studentId='other';actor.actorId='other';});
    const reply=await f.app.retainedQuery(actor,input);expect(reply.status).toBe('page');if(reply.status==='page')expect(reply.selector).toEqual({kind:'student',studentId:f.student.id,date:f.date});
  });
  test.each([{ownerId:'override'},{url:'https://invalid'}, {cursor:'x',maxBytes:1},{limit:251},{selector:{kind:'student',studentId:'x',date:'2090-02-30'}},{selector:{kind:'cohort',ownerId:'x'}}])('rejects exact input violations before source loads: %j',async extra=>{
    const f=retainedFixture();const reply=await f.app.retainedQuery(f.actor,{selector:{kind:'cohort'},...extra});expect(reply.status).toBe('refused');expect(f.counters.snapshots).toBe(0);
  });
  test('accessor request is refused without invocation or source loads',async()=>{
    const f=retainedFixture();let called=false;const input={get selector(){called=true;return {kind:'cohort'};}};expect((await f.app.retainedQuery(f.actor,input)).status).toBe('refused');expect(called).toBe(false);expect(f.counters.snapshots).toBe(0);
  });
  test('fixed metadata and oversized atomic record refusals themselves stay small',async()=>{
    const f=retainedFixture(),facade:any={ownerId:f.owner,student:async()=>({sceneRevision:'😀'.repeat(5000)}),cohort:async()=>({rowCount:1,rows:['😀'.repeat(40_000)]}),classPreparation:async()=>{throw Error('unused');}};
    const reader=createRetainedQueryReader(facade);const fixed=await reader.page(f.actor,{selector:{kind:'student',studentId:'s',date:f.date},maxBytes:4096});expect(fixed).toMatchObject({code:'retained_fixed_metadata_exceeds_json_page_budget'});expect(bytes(fixed)).toBeLessThan(1024);
    const first=await reader.page(f.actor,{selector:{kind:'cohort'},maxBytes:4096});if(first.status!=='page')throw Error('container page expected');
    const atomic=await reader.page(f.actor,{selector:{kind:'cohort'},maxBytes:4096,cursor:first.page.nextCursor});expect(atomic).toMatchObject({code:'retained_record_exceeds_json_page_budget'});expect(bytes(atomic)).toBeLessThan(1024);
  });
  test('HTTP authenticated production route and shared client retain the exact document',async()=>{
    const f=retainedFixture(),h=handler(f),selector={kind:'student',studentId:f.student.id,date:f.date} as const;
    const original=await f.app.student(f.actor,f.student.id,f.date);const result=await readRetainedDocument(selector,async request=>{const response=await h.call(request);expect(response.status).toBe(200);const text=await response.text();expect(Buffer.byteLength(text)).toBeLessThanOrEqual(retainedQueryLimits.pageBytes);return JSON.parse(text);});expect(canonicalJson(result)).toBe(canonicalJson(original));
    const legacy=await h.fetch(new Request('https://query.invalid/api/student?id='+f.student.id+'&date='+f.date,{headers:{Cookie:'dc_teacher='+signTeacherSession('synthetic-session-key',f.owner,f.actor.actorId)}}));expect(legacy.status).toBe(200);expect(canonicalJson(await legacy.json())).toBe(canonicalJson(original));
  });
  test('anonymous/origin/owner override inputs cannot authenticate themselves or read source',async()=>{
    const f=retainedFixture(),h=handler(f),body={selector:{kind:'cohort'}};expect((await h.call(body,{},false)).status).toBe(401);expect((await h.call(body,{Origin:'https://other.invalid'})).status).toBe(403);expect((await (await h.call({...body,ownerId:f.owner})).json()).status).toBe('refused');expect(f.counters.snapshots).toBe(0);
  });
  test('identity rotation during awaited facade read prevents HTTP result disclosure',async()=>{
    const f=retainedFixture(),h=handler(f);f.setDuringRead(()=>h.setCurrent({identity:null,sessionKey:'rotated'}));expect((await h.call({selector:{kind:'cohort'}})).status).toBe(401);
  });
  test('HTTP malformed JSON refuses with bounded fixed metadata and no source load',async()=>{
    const f=retainedFixture(),h=handler(f),response=await h.fetch(new Request('https://query.invalid/api/retained-query',{method:'POST',headers:{Origin:'https://query.invalid','Content-Type':'application/json',Cookie:'dc_teacher='+signTeacherSession('synthetic-session-key',f.owner,f.actor.actorId)},body:'{"synthetic-untrusted":"'+ 'x'.repeat(1000)}));
    expect(response.status).toBe(400);const text=await response.text();expect(text).not.toContain('synthetic-untrusted');expect(Buffer.byteLength(text)).toBeLessThan(1024);expect(f.counters.snapshots).toBe(0);
  });
  test('pagination client refuses reordered, changed or replayed pages',async()=>{
    const f=retainedFixture(),selector={kind:'student',studentId:f.student.id,date:f.date} as const;
    await expect(readRetainedDocument(selector,async input=>{const reply=await f.app.retainedQuery(f.actor,input);if(reply.status==='page')reply.records[0]!.ordinal=999;return reply;})).rejects.toThrow();
  });
  test('web/CLI production consumers use common reader; legacy GET and final WebMCP packaging remain distinct',()=>{
    const root=resolve(import.meta.dir,'../..'),web=readFileSync(resolve(root,'src/academy/web/client.ts'),'utf8'),cli=readFileSync(resolve(root,'harness/academy_query.ts'),'utf8');
    expect(web).toContain("post<RetainedQueryReply>('/api/retained-query'");expect(web).not.toMatch(/api<Scene>\('\/api\/student/);expect(web).not.toMatch(/api<Cohort>\('\/api\/cohort/);expect(cli).toContain('request=>app.retainedQuery(actor,request)');expect(web).toContain('modelContext.registerTool');
  });
  test('new reader instances refuse old cursors without storing a scene or session',async()=>{
    const f=retainedFixture(),input={selector:{kind:'student',studentId:f.student.id,date:f.date},limit:1};const first=await f.app.retainedQuery(f.actor,input);if(first.status!=='page')throw Error('page expected');
    const before=f.counters.snapshots;expect(await createRetainedQueryReader(f.app).page(f.actor,{...input,cursor:first.page.nextCursor})).toMatchObject({code:'retained_cursor_scope_conflict'});expect(f.counters.snapshots).toBe(before);
  });
  test('oversized retained documents refuse with bounded metadata and no truncation',async()=>{
    const f=retainedFixture(),reader=createRetainedQueryReader({ownerId:f.owner,cohort:async()=>({value:'x'.repeat(retainedQueryLimits.documentBytes+1)})} as any);
    const reply=await reader.page(f.actor,{selector:{kind:'cohort'}});expect(reply).toMatchObject({code:'retained_document_scope_too_large'});expect(bytes(reply)).toBeLessThan(1024);
  });
  test('transport digest detects content changes even if page serialization size still matches',async()=>{
    const f=retainedFixture(1,0);await expect(readRetainedDocument({kind:'cohort'},async input=>{
      const reply=await f.app.retainedQuery(f.actor,input);if(reply.status==='page'){const value=(reply.records[0] as any).value;value.students[0].displayName=value.students[0].displayName.replace('Invented','Xnvented');reply.page.serializedBytes=bytes(reply);}
      return reply;
    })).rejects.toThrow('retained_document_digest_conflict');
  });
  test('canonical replacement, exact attempt teacher final and independent physical stages survive paging',async()=>{
    const f=retainedFixture(1,10),work=f.rows.find(r=>r.entityId==='work-A')!,attempt=f.rows.find(r=>r.entityId==='attempt-A')!,explicit=f.rows.find(r=>r.entityId==='explicit')!,withdrawn=f.rows.find(r=>r.entityId==='withdrawn')!;
    if(explicit.payload.kind!=='learning_work_assignment'||work.payload.kind!=='learning_work_assignment')throw Error('fixture assignment');
    explicit.payload={...explicit.payload,replaces:known({assignmentRevisionId:withdrawn.revisionId},[withdrawn.revisionId]),evidenceRefs:[...explicit.payload.evidenceRefs,withdrawn.revisionId]};
    const payload:any={kind:'teacher_activity_review',studentBinding:{studentId:f.student.id,sourceStudent:f.student.sourceKey},sourceStudent:f.student.sourceKey,reportedAt:f.time,evidenceRevisionIds:[work.revisionId,attempt.revisionId],assignmentRevisionId:work.revisionId,selectedItemIds:work.payload.items.map(i=>i.assignedItemId),coverage:'whole_assigned_items',originalScore:100,originalWrong:'not_applicable',similarPrinted:'unknown',similar:'unknown',appEntry:'not_entered',paper:{issuance:work.payload.paper,corrections:[],stages:{printed:unknown('Not observed'),distributed:known({issuanceKey:(work.payload.paper as any).value.issuanceKey,state:'done',observedAt:f.time},['synthetic-distribution'])}},video:{upload:'unknown',reference:'',review:'not_reviewed',note:''},mindmap:{state:'not_requested',note:'',explanation:null},final:{decision:'accepted',checkedSolutionAndUnderstanding:true,note:'Invented scoped final'},attemptBinding:known({attemptEntityId:attempt.entityId,attemptRevisionId:attempt.revisionId},[attempt.revisionId])};
    const workspace={ownerId:f.owner,studentId:f.student.id,entityId:'synthetic-review',revisionId:'synthetic-review-r1',payload,sequence:1,recordedAt:f.time} as StudentWorkspaceVersion;
    // Test-only store extension; the production adapter still calls the same canonical facade.
    const original=f.store.readSnapshot.bind(f.store);f.store.readSnapshot=callback=>original(read=>callback({...read,studentWorkspaces:async()=>[workspace]}));
    const expected=await f.app.student(f.actor,f.student.id,f.date),{result}=await collect(f,{kind:'student',studentId:f.student.id,date:f.date});
    expect(canonicalJson(result)).toBe(canonicalJson(expected));expect(result.teacherWorkspaces[0].payload.attemptBinding.value.attemptRevisionId).toBe(attempt.revisionId);
    expect(result.teacherWorkspaces[0].payload.paper.stages.printed.state).toBe('unknown');expect(result.teacherWorkspaces[0].payload.paper.stages.distributed.state).toBe('known');expect(result.teacherWorkspaces[0].payload.final.decision).toBe('accepted');
    expect(result.evidence.find((r:any)=>r.entityId==='explicit').payload.replaces.value.assignmentRevisionId).toBe(withdrawn.revisionId);
  });
});
