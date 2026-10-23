import {describe,expect,test} from 'bun:test';
import {syntheticInputs} from './fixtures.ts';
import {SavedContext} from '../src/saved-context.ts';
import {MAX_QUERY_BYTES,queryInputSchema,queryResultSchema} from '../src/contracts.ts';
import {paginate} from '../src/pagination.ts';

describe('bounded large history queries',()=>{
 test('250 accepted, 251 rejected; old small-page clients keep working',()=>{
  expect(queryInputSchema.safeParse({query:{kind:'roster'},limit:250}).success).toBe(true);
  expect(queryInputSchema.safeParse({query:{kind:'roster'},limit:251}).success).toBe(false);
  expect(paginate(Array.from({length:300},(_,i)=>i),{},'a'.repeat(64),250).items).toHaveLength(250);
 });
 test('history contains every selected facet with unchanged classifications and source pointers',()=>{
  const inputs=syntheticInputs(),context=new SavedContext(inputs),studentId='synthetic-student-1';
  const facets=['books','sections','teacher_events','daily_record_drafts'] as const;
  const expected=facets.flatMap(facet=>context.query({query:{kind:'student_records',studentId,facet},limit:250}).records.map(r=>({...r,facet})));
  const result=context.query({query:{kind:'student_history',studentId,facets:[...facets]},limit:250});
  expect(result.records).toEqual(expected);expect(result.page.exhausted).toBe(true);
  expect(queryResultSchema.safeParse(result).success).toBe(true);
  expect(result.currentAcademyServerQueried).toBe(false);
  expect(context.query({query:{kind:'student_history',studentId:'foreign'},limit:250}).code).toBe('student_not_in_preserved_roster');
 });
 test('byte-limited Unicode pages continue at the first unread record without loss or duplication',()=>{
  const inputs=syntheticInputs();
  inputs.audit.students[0]!.sections=Array.from({length:37},(_,i)=>({id:'row-'+i,bookEditionId:'edition-a',note:'한'.repeat(18000)}));
  const context=new SavedContext(inputs),query={kind:'student_records',studentId:'synthetic-student-1',facet:'sections'};
  const ids:string[]=[];let cursor:string|undefined;let pages=0;
  do{const r=context.query({query,limit:250,...(cursor?{cursor}:{})});
   expect(r.status).toBe('partial');expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(MAX_QUERY_BYTES);
   expect(r.records.length).toBeGreaterThan(0);expect(queryResultSchema.safeParse(r).success).toBe(true);
   ids.push(...r.records.map(x=>(x.value as {id:string}).id));pages++;
   if(pages===1){expect(r.page.byteLimited).toBe(true);expect(r.page.exhausted).toBe(false);}
   cursor=r.page.nextCursor??undefined;expect(pages).toBeLessThan(30);
  }while(cursor);
  expect(ids).toEqual(Array.from({length:37},(_,i)=>'row-'+i));
 });
 test('one oversized record is refused explicitly rather than skipped',()=>{
  const inputs=syntheticInputs();inputs.audit.students[0]!.sections=[{id:'large',note:'한'.repeat(MAX_QUERY_BYTES)}];
  const r=new SavedContext(inputs).query({query:{kind:'student_records',studentId:'synthetic-student-1',facet:'sections'},limit:250});
  expect(r.code).toBe('single_record_exceeds_response_budget');expect(r.records).toEqual([]);expect(r.page.exhausted).toBe(false);
 });
 test('oversized fixed metadata is retained intact but never echoed as a large refusal',()=>{
  const inputs=syntheticInputs(),clock='2026-10-14T08:00:00.'+'1'.repeat(270000)+'Z';
  inputs.audit.collectedAt=clock;const context=new SavedContext(inputs);
  expect(()=>context.query({query:{kind:'roster'}})).toThrow('fixed_source_metadata_exceeds_response_budget');
  expect(context.inputs.audit.collectedAt).toBe(clock);expect(context.inputs.auditHash).toBe('a'.repeat(64));
 });
 test('a history cursor cannot change selected facets or student',()=>{
  const context=new SavedContext(syntheticInputs()),query={kind:'student_history',studentId:'synthetic-student-1',facets:['books','sections']};
  const r=context.query({query,limit:1});
  expect(context.query({query:{...query,facets:['sections']},cursor:r.page.nextCursor}).code).toBe('cursor_scope_or_snapshot_conflict');
  expect(context.query({query:{...query,studentId:'synthetic-student-2'},cursor:r.page.nextCursor}).code).toBe('cursor_scope_or_snapshot_conflict');
  expect(queryInputSchema.safeParse({query:{...query,facets:['books','books']}}).success).toBe(false);
 });
});
