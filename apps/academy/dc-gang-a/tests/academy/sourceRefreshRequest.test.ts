import {expect,test} from 'bun:test';
import {SourceRefreshRequest} from '../../src/academy/web/sourceRefreshRequest';
const scope={ownerId:'fixture-owner',actorId:'fixture-actor'};
const receipt=(requestId:string,status='pending',studentId:string|null='fixture-student')=>({...scope,requestId,status,studentId});
test('dated partial refresh retains actual scope and area outcomes across uncertain acknowledgement',async()=>{
 const date='2025-01-02';let original='',sends=0,sentDate:string|undefined;
 const make=(id:string)=>({...receipt(id,'partial'),date,areas:[{id:'fixture-area',family:'day_record',studentId:'fixture-student',status:'blocked',reason:'fixture_outage'}]});
 const request=new SourceRefreshRequest(scope,async input=>{sends++;original=input.requestId;sentDate=input.date;throw Error('fixture_lost_response');},async()=>null,async id=>make(id));
 expect(await request.refresh('fixture-student',date)).toMatchObject({requestId:original,date,status:'partial',areas:[{family:'day_record',status:'blocked'}]});expect(sends).toBe(1);expect(sentDate).toBe(date);
});
test('history is actor-bound, bounded and read-only without settling the original pending barrier',async()=>{
 const original=crypto.randomUUID(),terminal=crypto.randomUUID();let sends=0;
 const request=new SourceRefreshRequest(scope,async()=>{sends++;throw Error('unexpected');},async()=>receipt(original),async id=>receipt(id));
 await request.recover();
 const page={schemaVersion:1,kind:'source_refresh_history',...scope,order:'request_id_not_event_time',rows:[receipt(terminal,'observed')],nextCursor:null};
 expect(request.history(page).rows[0]!.requestId).toBe(terminal);
 for(const invalid of [{...page,actorId:'foreign'},{...page,rows:[{...receipt(terminal),actorId:'foreign'}]},{...page,rows:[...page.rows,...page.rows]},{...page,nextCursor:terminal}])expect(()=>request.history(invalid)).toThrow();
 expect(await request.recover()).toMatchObject({requestId:original,status:'pending'});expect(sends).toBe(0);
});
test('explicit recovery with no pending intent is read-only even without an acquisition connection',async()=>{
  let sends=0;const request=new SourceRefreshRequest(scope,async()=>{sends++;throw Error('unexpected');},async()=>null,async()=>null);
  expect(await request.recover()).toBeNull();expect(sends).toBe(0);
});
test('reconstruction discovers the protected pending request without browser storage or another acquisition',async()=>{
  const original=crypto.randomUUID();let sends=0,complete=false;
  const create=()=>new SourceRefreshRequest(scope,async()=>{sends++;throw Error('must_not_acquire');},async()=>receipt(original),async id=>receipt(id,complete?'observed':'pending'));
  expect(await create().refresh('another-student')).toMatchObject({requestId:original,status:'pending',studentId:'fixture-student'});
  complete=true;expect(await create().refresh(null)).toMatchObject({requestId:original,status:'observed'});expect(sends).toBe(0);
});
test('response loss recovers exact identity and does not silently repeat POST',async()=>{
  let sent='',sends=0;
  const request=new SourceRefreshRequest(scope,async input=>{sent=input.requestId;sends++;throw Error('response_lost');},async()=>null,async id=>receipt(id,'observed'));
  expect(await request.refresh('fixture-student')).toMatchObject({requestId:sent||expect.any(String),status:'observed'});expect(sends).toBe(1);
});
test('a coalesced other-tab receipt is validated and keeps the actual subject instead of claiming the selected student was refreshed',async()=>{
  const original=crypto.randomUUID();let sends=0;
  const request=new SourceRefreshRequest(scope,async()=>{sends++;return {...receipt(original,'pending','original-student'),coalesced:true};},async()=>null,async id=>receipt(id,'observed','original-student'));
  expect(await request.refresh('new-selection')).toMatchObject({requestId:original,status:'pending',studentId:'original-student'});
  expect(await request.refresh('new-selection')).toMatchObject({requestId:original,status:'observed',studentId:'original-student'});expect(sends).toBe(1);
});
test('foreign principal or unbound request response cannot clear the recovery barrier',async()=>{
  let original='',reads=0;
  const request=new SourceRefreshRequest(scope,async input=>{original=input.requestId;return {...receipt(original,'observed'),actorId:'foreign'};},async()=>null,async id=>{reads++;return receipt(id,'pending');});
  await expect(request.refresh('fixture-student')).rejects.toThrow('source_receipt_scope_conflict');
  expect(await request.refresh('fixture-student')).toMatchObject({status:'pending',requestId:original});expect(reads).toBe(1);
});
