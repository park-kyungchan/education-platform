import './network-deny.ts';
import {appendFileSync,existsSync,readdirSync,readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {registerDailyRecordTools} from '../src/dailyrecord-tools.ts';
import {observation,safeguard,learningPolicy} from './dailyrecord-fixture.ts';
const events=process.argv[2]!;
appendFileSync(events,'start\n');
const base=dirname(events);
const injectSave=existsSync(resolve(base,'inject-save-receipt-failure'));
const injectUncertainSave=existsSync(resolve(base,'inject-uncertain-save'));
const service=new DailyRecordService({
  readRoutingAdmission:()=>({sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',allowedFrom:'2040-01-15',allowedThrough:process.argv[3]??'2040-01-17',
    ...(process.argv[4]?{studentScope:process.argv[4] as 'configured'|'source_verified'}:{})}),
  readItemAnswers:async labels=>{appendFileSync(events,'answer\n');return {family:'item_answer',status:'observed',
    requestedAnswerLabels:[...labels],pendingAnswerLabels:[],answerBlockedReason:null,
    itemAnswers:labels.map(lectureKey=>({identity:{sourceNamespace:'academy_item',lectureKey,outerLectureKey:'100',sourceId:lectureKey},
      answerLiteral:'invented answer',answerAvailability:'literal_payload_not_rendered',answerMeaning:'source_official_item_answer_not_student_response',
      rendering:'not_qualified',paperMembership:'unqualified'})),observedAt:new Date().toISOString(),
    coverage:'exact_requested_shared_answers_not_printed_versions',nativePrintInvoked:false,automaticRetryAllowed:false};},
  searchStudentsByName:async name=>{appendFileSync(events,'resolve\n');return name==='Invented Student'?[{studentKey:'77001',studentName:name}]:[];},
  readDailyRecord:async scope=>{
    appendFileSync(events,'intake\n');
    const value=observation();value.scope={...scope};value.target={...value.target,...scope};value.observedAt=new Date().toISOString();
    value.previousTarget={...value.previousTarget!,sourceNamespace:scope.sourceNamespace,teacherId:scope.teacherId,studentId:scope.studentId};value.toneSamples=[];
    return {status:'observed',observation:value};
  },
},safeguard,Date.now,learningPolicy,(injectSave||injectUncertainSave)?{saveConfigured:()=>true,saveDailyRecord:async(_scope,patches)=>{
  appendFileSync(events,'synthetic-save\n');
  if(injectUncertainSave)throw Error('synthetic_backend_uncertain');
  const receipts=resolve(base,'receipts');
  const dispatch=readdirSync(receipts).find(name=>name.endsWith('-dispatch.json')&&JSON.parse(readFileSync(resolve(receipts,name),'utf8')).tool==='academy_dailyrecord_save');
  if(!dispatch)throw Error('synthetic_dispatch_missing');
  mkdirSync(resolve(receipts,dispatch.replace('-dispatch.json','-result.json')));
  return patches.map(p=>({field:p.field,status:'persisted' as const,dispatched:true}));
}}:null);
const server=new McpServer({name:'fictional-neutral-upstream',version:'1.0.0'});
registerDailyRecordTools(server,service);
server.registerTool('academy_source_status',{inputSchema:z.object({}).strict()},input=>{
  appendFileSync(events,'source_status:'+JSON.stringify(input)+'\n');
  const data={sourceMode:'saved_context',synthetic:true,receivedArguments:input};
  return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
});
await server.connect(new StdioServerTransport());
