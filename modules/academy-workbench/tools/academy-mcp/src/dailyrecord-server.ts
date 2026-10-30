import {runtimeIdentityConfiguration,registerRuntimeIdentity} from './runtime-identity.ts';
import {installStdioDiagnostics,createAcademyStdioTransport} from './stdio-diagnostics.ts';
import {dailyRecordLearningConfiguration} from './dailyrecord-learning.ts';
import {McpServer} from '@modelcontextprotocol/server';
import {DailyRecordService} from './dailyrecord.ts';
import {dailyRecordToolConfiguration,registerDailyRecordTools} from './dailyrecord-tools.ts';
import {nativeDailyRecordConfiguration,nativeOwnerArtifactsRoot} from './native-dailyrecord-backend.ts';
import {createDailyRecordWorkflow,dailyRecordWorkflowConfiguration} from './dailyrecord-workflow.ts';

const runtimeIdentity=await runtimeIdentityConfiguration(process.argv.slice(2));
const learning=await dailyRecordLearningConfiguration(runtimeIdentity.remainingArgs);
const config=await dailyRecordToolConfiguration(learning.remainingArgs);
// Native launches always run the owner workflow with its store inside the owner
// home, wherever the flags appear. The store is created only after the native
// owner launch is verified, so a refused launch leaves no directory behind.
const nativeLaunch=config.remainingArgs.includes('--dailyrecord-native');
const ownerRoot=nativeLaunch?{requiredRoot:nativeOwnerArtifactsRoot,nativeDefaultStore:nativeOwnerArtifactsRoot+'dailyrecord-workflow'}:{};
const workflowArgs=dailyRecordWorkflowConfiguration(config.remainingArgs,ownerRoot);
const native=await nativeDailyRecordConfiguration(workflowArgs.remainingArgs,config.ownerAdmission,config.metadataAdmission,config.saveAdmission,config.saveStoreDir,config.saveRequestPath);
const workflow=workflowArgs.storeDir?createDailyRecordWorkflow({storeDir:workflowArgs.storeDir,...(nativeLaunch?{requiredRoot:nativeOwnerArtifactsRoot}:{})}):null;
const server=new McpServer({name:'academy-dailyrecord-review',version:'0.1.0'});
registerRuntimeIdentity(server,runtimeIdentity.identity);
registerDailyRecordTools(server,new DailyRecordService(native?.backend??null,config.parentSafeguard,Date.now,learning.learningPolicy,native?.backend??null,workflow));
if(native)process.once('exit',native.close);
installStdioDiagnostics(server.server);
await server.connect(createAcademyStdioTransport());
