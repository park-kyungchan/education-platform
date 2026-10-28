import {expect,test} from 'bun:test';
import {NativeDailyRecordBackend} from '../src/native-dailyrecord-backend.ts';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {metadataAdmissionSchema} from '../src/metadata-admission.ts';
const launch={teacherId:'99001',teacherLabel:'Fictional Teacher',date:'2026-10-28',students:[{studentId:'77001',displayName:'Fictional One'}],sourceBundleSha256:'b'.repeat(64)};
const request={displayName:'Fictional Two',lessonDate:'2026-10-21',purpose:'Fictional history',currentRequestRef:'synthetic-request',queries:[{kind:'daily_inventory' as const}]};
export const metadataPolicy=metadataAdmissionSchema.parse({schemaVersion:'academy.metadata-admission/1',sourceNamespace:'academy.lms.metadata',teacherId:'99001',allowedFrom:null,allowedThrough:null,studentScope:'source_verified',operations:['daily_inventory'],relativeSelectors:['1']});
function fixture(policy:unknown=metadataPolicy,variant='normal'){
 const events:string[]=[];
 const port={authenticate:async()=>{events.push('auth');},discoverDayRecordGroups:async(i:any)=>{events.push('groups:'+i.date);return {groups:[{groupId:'3'}]};},
 execute:async(i:any)=>{events.push('identity:'+i.date);const row={studentKey:'77002',studentName:i.studentNames[0],teacherKey:variant==='foreign'?'99002':'99001',date:i.date,groupId:'3',courseKey:'5',recordKey:'13',membershipKey:'8',fields:{}};
  return {dayRecords:variant==='missing'?[]:variant==='duplicate'?[row,{...row,recordKey:'14'}]:[row]};},journalState:async()=>{throw Error('not_used');},close:()=>{},
 inspectDailyTestInventory:async(i:any)=>{events.push('metadata:'+i.studentKey);return {rows:[],operation:'DtResultSearch',page:1,sourcePeriod:null,observedAt:new Date().toISOString(),coverage:'one_observed_student_search_page_not_complete_history',generatedMembership:'unqualified',fixedSourceFilter:{sort_date:'1'},expectedPaperDefinitions:'not_observed'};}};
 const backend=new NativeDailyRecordBackend(port,launch,()=>({username:'fictional',password:'fictional'}),null,new Set(['Fictional One','Fictional Two']),policy?metadataAdmissionSchema.parse(policy):null);
 return {events,backend,service:new DailyRecordService(backend)};
}
test('metadata exact dated identity, namespace admission and read compose without DailyRecord policy or prior process memory',async()=>{
 for(const lessonDate of ['2026-10-21','2026-10-26','2024-02-29','2040-01-04']){
  const f=fixture();expect(await f.service.metadataByName({...request,lessonDate})).toMatchObject({status:'observed',scope:{sourceNamespace:'academy.lms.metadata',teacherId:'99001',studentId:'77002',lessonDate}});
  expect(f.events).toEqual(['auth','groups:'+lessonDate,'identity:'+lessonDate,'metadata:77002']);
 }
 // A second independent owner process starts with no remembered proof and succeeds by revalidation.
 const fresh=fixture();expect((await fresh.service.metadataByName(request)).status).toBe('observed');expect(fresh.events.filter(e=>e.startsWith('identity'))).toHaveLength(1);
});
test('metadata requires its own operations, dates, relative-selector and subject admission before any source read',async()=>{
 for(const policy of [null,{...metadataPolicy,operations:['daily_metadata']},{...metadataPolicy,allowedFrom:'2026-10-22'}, {...metadataPolicy,studentScope:'configured'}, {...metadataPolicy,relativeSelectors:[]}]){
  const f=fixture(policy);expect(await f.service.metadataByName(request)).toMatchObject({status:'unavailable',reasonCode:'metadata_namespace_not_admitted',failure:{category:'policy_denial'}});expect(f.events).toEqual([]);
 }
 const f=fixture();expect(await f.service.metadataByName({...request,displayName:'Foreign Student'})).toMatchObject({status:'unavailable'});expect(f.events).toEqual([]);
 await expect(f.service.metadataByName({...request,lessonDate:'2026-02-30'})).rejects.toThrow();expect(f.events).toEqual([]);
 await expect(f.service.metadataByName({...request,teacherId:'99002'})).rejects.toThrow();
});
test('dated collisions, foreign rows and missing occurrences do not reach metadata',async()=>{
 for(const [variant,category] of [['duplicate','identity_ambiguity'],['foreign','contract_drift'],['missing','partial_coverage']]){
  const f=fixture(metadataPolicy,variant);expect(await f.service.metadataByName(request)).toMatchObject({status:'unavailable',failure:{category}});expect(f.events.some(e=>e.startsWith('metadata:'))).toBe(false);
 }
});
test('DailyRecord proof and caller keys do not create metadata permission; keyed API never consumes dynamic proof',async()=>{
 const f=fixture(null);await expect(f.backend.readStudentMetadata({purpose:request.purpose,currentRequestRef:request.currentRequestRef,scope:{sourceNamespace:'academy.lms.metadata',teacherId:'99001',studentId:'77002',lessonDate:request.lessonDate},queries:request.queries})).rejects.toThrow('native_metadata_scope_refused');expect(f.events).toEqual([]);
});
