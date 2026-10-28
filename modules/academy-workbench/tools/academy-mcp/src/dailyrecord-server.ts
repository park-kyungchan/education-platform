import {runtimeIdentityConfiguration,registerRuntimeIdentity} from './runtime-identity.ts';
import {installStdioDiagnostics,createAcademyStdioTransport} from './stdio-diagnostics.ts';
import {dailyRecordLearningConfiguration} from './dailyrecord-learning.ts';
import {McpServer} from '@modelcontextprotocol/server';
import {DailyRecordService} from './dailyrecord.ts';
import {dailyRecordToolConfiguration,registerDailyRecordTools} from './dailyrecord-tools.ts';
import {nativeDailyRecordConfiguration} from './native-dailyrecord-backend.ts';

const runtimeIdentity=await runtimeIdentityConfiguration(process.argv.slice(2));
const learning=await dailyRecordLearningConfiguration(runtimeIdentity.remainingArgs);
const config=await dailyRecordToolConfiguration(learning.remainingArgs);
const native=await nativeDailyRecordConfiguration(config.remainingArgs,config.ownerAdmission,config.metadataAdmission,config.saveAdmission,config.saveStoreDir,config.saveRequestPath);
const server=new McpServer({name:'academy-dailyrecord-review',version:'0.1.0'});
registerRuntimeIdentity(server,runtimeIdentity.identity);
registerDailyRecordTools(server,new DailyRecordService(native?.backend??null,config.parentSafeguard,Date.now,learning.learningPolicy,native?.backend??null));
if(native)process.once('exit',native.close);
installStdioDiagnostics(server.server);
await server.connect(createAcademyStdioTransport());
