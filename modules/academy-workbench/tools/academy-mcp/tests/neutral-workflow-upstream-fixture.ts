import './network-deny.ts';
import {appendFileSync,existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {registerDailyRecordTools} from '../src/dailyrecord-tools.ts';
import {dailyRecordWorkflowConfiguration} from '../src/dailyrecord-workflow.ts';
import {nativeWorkflowService} from './dailyrecord-workflow-fixture.ts';

// Fictional upstream owner process: one per bridge call, sharing the owner
// store and the file-backed synthetic source through the launch flags.
const base=process.argv[2]!;
appendFileSync(resolve(base,'events.txt'),'start\n');
const configured=await dailyRecordWorkflowConfiguration(process.argv.slice(3));
if(configured.remainingArgs.length)throw Error('fixture_unexpected_arguments');
const receipts=resolve(base,'receipts');
const {service}=nativeWorkflowService(base,configured.workflow,()=>{
  // Model a bridge whose post-dispatch result receipt cannot be written.
  if(!existsSync(resolve(base,'inject-save-receipt-failure')))return;
  for(const name of readdirSync(receipts).filter(n=>n.endsWith('-dispatch.json'))){
    const result=resolve(receipts,name.replace('-dispatch.json','-result.json'));
    if(JSON.parse(readFileSync(resolve(receipts,name),'utf8')).tool==='academy_dailyrecord_save'&&!existsSync(result))mkdirSync(result);
  }
});
const server=new McpServer({name:'fictional-workflow-upstream',version:'1.0.0'});
registerDailyRecordTools(server,service);
await server.connect(new StdioServerTransport());
