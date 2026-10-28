import {installStdioDiagnostics,createAcademyStdioTransport} from './stdio-diagnostics.ts';
import {runtimeIdentityConfiguration,registerRuntimeIdentity} from './runtime-identity.ts';
import {dailyRecordLearningConfiguration} from './dailyrecord-learning.ts';
import {McpServer} from '@modelcontextprotocol/server';
import {loadItemLabelIndex} from './item-label-store.ts';
import {registerItemLabelTools} from './item-label-tools.ts';
import {loadNativePoolBackend} from './native-pool-backend.ts';
import {dailyRecordToolConfiguration,registerDailyRecordTools} from './dailyrecord-tools.ts';
import {DailyRecordService} from './dailyrecord.ts';

// This entry point never initializes the preserved-student context reader.
const runtimeIdentity=await runtimeIdentityConfiguration(process.argv.slice(2));
const learning=await dailyRecordLearningConfiguration(runtimeIdentity.remainingArgs);
const configuration=await dailyRecordToolConfiguration(learning.remainingArgs);
const args=configuration.remainingArgs;
const index=args[0]==='--native-bridge'?await loadNativePoolBackend(args):await loadItemLabelIndex(args);
const server=new McpServer({name:'academy-item-labels',version:'0.1.0'});
registerItemLabelTools(server,index);
registerRuntimeIdentity(server,runtimeIdentity.identity);
registerDailyRecordTools(server,new DailyRecordService(null,configuration.parentSafeguard,Date.now,learning.learningPolicy));
installStdioDiagnostics(server.server);
await server.connect(createAcademyStdioTransport());
