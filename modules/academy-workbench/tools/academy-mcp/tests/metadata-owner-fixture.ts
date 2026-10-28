import './network-deny.ts';
import {appendFileSync} from 'node:fs';
import {McpServer} from '@modelcontextprotocol/server';
import {runtimeIdentityConfiguration,registerRuntimeIdentity} from '../src/runtime-identity.ts';
import {installStdioDiagnostics,createAcademyStdioTransport} from '../src/stdio-diagnostics.ts';
import {registerDailyRecordTools,dailyRecordToolConfiguration} from '../src/dailyrecord-tools.ts';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {NativeDailyRecordBackend} from '../src/native-dailyrecord-backend.ts';
const identity=await runtimeIdentityConfiguration(process.argv.slice(2)),config=await dailyRecordToolConfiguration(identity.remainingArgs);
const events=config.remainingArgs[0],variant=config.remainingArgs[1]??'normal';
const event=(op:string)=>appendFileSync(events,JSON.stringify({op,pid:process.pid})+'\n');event('start');
const previousDate=(date:string)=>new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const row=(name:string,date:string)=>({studentName:name,studentKey:'77002',teacherKey:'99001',date,groupId:'3',courseKey:'5',recordKey:date.replaceAll('-',''),membershipKey:'8',fields:{progress:'- Fictional Algebra A 2040, unit 2 lesson.',homework:'- Fictional assigned items 1-3.',lessonMemo:'- Fictional notebook.',attendance:'Y',dailyTestAssessment:'0',previousHomeworkAssessment:'3'}});
const metadata=(selector='1')=>({rows:[{studentKey:'77002',studentName:'Fictional Two',paperKey:'81001',attemptKey:'91001',sourceRowId:'fictional-attempt',sourceScore:0,titles:{title:'Fictional attempt; assignment and grading unknown'}}],operation:'DtResultSearch',page:1,sourcePeriod:null,observedAt:new Date().toISOString(),coverage:'one_observed_student_search_page_not_complete_history',generatedMembership:'unqualified',fixedSourceFilter:{sort_date:selector},expectedPaperDefinitions:'not_observed'});
const port={authenticate:async()=>{event('auth');if(variant==='expired')throw Error('SECRET_AUTH_CANARY');},
 discoverDayRecordGroups:async()=>{event('groups');return {groups:[{groupId:'3'}]};},
 execute:async(i:any)=>{event('identity');return {dayRecords:[row(i.studentNames[0],i.date)]};},
 journalState:async(t:any)=>{event('journal');if(variant==='drift')throw Error('script_digest_drift');return {target:t,fields:row(t.studentName,t.date).fields,previousRecordKey:previousDate(t.date).replaceAll('-',''),previousDate:previousDate(t.date),wireDigest:'a'.repeat(64)};},close:()=>{},
 searchDailyTestMetadata:async()=>{event('metadata');return metadata();},
 readDailyTestHistory:async(i:any)=>{event('history');return {status:'observed',studentKey:'77002',studentName:'Fictional Two',currentFilterQualification:{observedAt:new Date().toISOString(),selector:'1',rows:metadata().rows},observations:i.periods.map((selector:string)=>({...metadata(selector),selector})),calendarBounds:'source_relative_labels_only_not_exact_calendar_bounds',expectedPaperDefinitions:'not_observed',coverage:'all_parsed_embedded_rows_on_each_observed_response_not_complete_history'};},
 inspectDailyTestInventory:async()=>{event('metadata');if(variant==='drift')throw Error('script_digest_drift');if(variant==='truncated')throw new SyntaxError('PRIVATE_RESPONSE_CANARY');return metadata();},
};
const launch={teacherId:'99001',teacherLabel:'Fictional Teacher',date:'2026-10-28',students:[{studentId:'77001',displayName:'Fictional One'}],sourceBundleSha256:'b'.repeat(64)};
const backend=new NativeDailyRecordBackend(port,launch,()=>({username:'fictional',password:'fictional'}),config.ownerAdmission,new Set(['Fictional One','Fictional Two']),config.metadataAdmission);
const server=new McpServer({name:'fictional-owner-packaged',version:'1.0.0'});
registerRuntimeIdentity(server,identity.identity);registerDailyRecordTools(server,new DailyRecordService(backend));installStdioDiagnostics(server.server);
await server.connect(createAcademyStdioTransport());
