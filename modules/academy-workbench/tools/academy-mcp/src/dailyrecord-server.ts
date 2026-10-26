import {dailyRecordLearningConfiguration} from './dailyrecord-learning.ts';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {DailyRecordService} from './dailyrecord.ts';
import {dailyRecordToolConfiguration,registerDailyRecordTools} from './dailyrecord-tools.ts';
import {nativeDailyRecordConfiguration} from './native-dailyrecord-backend.ts';

const learning=await dailyRecordLearningConfiguration(process.argv.slice(2));
const config=await dailyRecordToolConfiguration(learning.remainingArgs);
const native=await nativeDailyRecordConfiguration(config.remainingArgs,config.ownerAdmission);
const server=new McpServer({name:'academy-dailyrecord-review',version:'0.1.0'});
registerDailyRecordTools(server,new DailyRecordService(native?.backend??null,config.parentSafeguard,Date.now,learning.learningPolicy));
if(native)process.once('exit',native.close);
await server.connect(new StdioServerTransport());
