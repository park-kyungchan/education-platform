import './network-deny.ts';
import {appendFileSync} from 'node:fs';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {registerDailyRecordTools} from '../src/dailyrecord-tools.ts';
import {observation} from './dailyrecord-fixture.ts';
const events=process.argv[2]!;
appendFileSync(events,'start\n');
const service=new DailyRecordService({
  searchStudentsByName:async name=>{appendFileSync(events,'resolve\n');return name==='Invented Student'?[{studentKey:'77001',studentName:name}]:[];},
  readDailyRecord:async scope=>{
    appendFileSync(events,'intake\n');
    const value=observation();value.scope={...scope};value.target={...value.target,...scope};value.observedAt=new Date().toISOString();
    value.previousTarget={...value.previousTarget!,sourceNamespace:scope.sourceNamespace,teacherId:scope.teacherId,studentId:scope.studentId};value.toneSamples=[];
    return {status:'observed',observation:value};
  },
});
const server=new McpServer({name:'fictional-neutral-upstream',version:'1.0.0'});
registerDailyRecordTools(server,service);
await server.connect(new StdioServerTransport());
