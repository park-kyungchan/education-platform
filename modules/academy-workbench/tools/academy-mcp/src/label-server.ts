import {dailyRecordLearningConfiguration} from './dailyrecord-learning.ts';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {loadItemLabelIndex} from './item-label-store.ts';
import {registerItemLabelTools} from './item-label-tools.ts';
import {loadNativePoolBackend} from './native-pool-backend.ts';
import {dailyRecordToolConfiguration,registerDailyRecordTools} from './dailyrecord-tools.ts';
import {DailyRecordService} from './dailyrecord.ts';

// This entry point never initializes the preserved-student context reader.
const learning=await dailyRecordLearningConfiguration(process.argv.slice(2));
const configuration=await dailyRecordToolConfiguration(learning.remainingArgs);
const args=configuration.remainingArgs;
const index=args[0]==='--native-bridge'?await loadNativePoolBackend(args):await loadItemLabelIndex(args);
const server=new McpServer({name:'academy-item-labels',version:'0.1.0'});
registerItemLabelTools(server,index);
registerDailyRecordTools(server,new DailyRecordService(null,configuration.parentSafeguard,Date.now,learning.learningPolicy));
await server.connect(new StdioServerTransport());
