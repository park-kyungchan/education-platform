import {runtimeIdentityConfiguration,registerRuntimeIdentity} from './runtime-identity.ts';
import {installStdioDiagnostics,createAcademyStdioTransport} from './stdio-diagnostics.ts';
import {dailyRecordLearningConfiguration} from './dailyrecord-learning.ts';
import { McpServer } from '@modelcontextprotocol/server';
import { capabilitiesInputSchema, loadService, sourceStatusInputSchema } from './service.ts';
import { readOnlyAnnotations } from './contracts.ts';
import {toolResult as result} from './tool-result.ts';
import {registerSavedQuery} from './query-tool.ts';
import { repoRoot } from './paths.ts';
import {loadItemLabelIndex} from './item-label-store.ts';
import {registerItemLabelTools} from './item-label-tools.ts';
import {dailyRecordToolConfiguration,registerDailyRecordTools} from './dailyrecord-tools.ts';
import {DailyRecordService} from './dailyrecord.ts';
import {nativeDailyRecordConfiguration} from './native-dailyrecord-backend.ts';

const service = await loadService(repoRoot);
const server = new McpServer({ name: 'academy-operations', version: '0.1.0' });
const runtimeIdentity=await runtimeIdentityConfiguration(process.argv.slice(2));
const learning=await dailyRecordLearningConfiguration(runtimeIdentity.remainingArgs);
const configuration=await dailyRecordToolConfiguration(learning.remainingArgs);
// P3: read backend is injected once by the owner launch configuration, the
// same path as dailyrecord-server.ts. Without owner args the backend stays
// null and read tools return unavailable; runtimes only connect.
// Partition arguments per backend before invoking either loader: the
// native triple belongs to the DailyRecord backend only; the label loader
// accepts only its own four arguments.
const hasNativeTriple=configuration.remainingArgs[0]==='--dailyrecord-native';
const native=await nativeDailyRecordConfiguration(hasNativeTriple?configuration.remainingArgs.slice(0,3):[],configuration.ownerAdmission,configuration.metadataAdmission);
const labelArgs=hasNativeTriple?configuration.remainingArgs.slice(3):configuration.remainingArgs;
registerItemLabelTools(server,await loadItemLabelIndex(labelArgs));
registerRuntimeIdentity(server,runtimeIdentity.identity);
registerDailyRecordTools(server,new DailyRecordService(native?.backend??null,configuration.parentSafeguard,Date.now,learning.learningPolicy));
if(native)process.once('exit',native.close);
server.registerTool('academy_capabilities', {
  title: 'Academy operational hierarchy and source contracts',
  description: 'Discover hierarchical academy workflows, page the complete pinned source inventory, or inspect one exact source contract. Source metadata is not an executable operation. No source requests.',
  inputSchema: capabilitiesInputSchema,
  annotations: readOnlyAnnotations,
}, input => result(service.capabilities(input)));
registerSavedQuery(server,input=>service.query(input));
server.registerTool('academy_source_status', {
  title: 'Historical saved-context coverage and preservation limits',
  description: 'Saved-context coverage ONLY. Historical user-reported website/access limits do not describe the configured live DailyRecord backend. For today/current DailyRecord use academy_dailyrecord_get or academy_student_resolve then academy_dailyrecord_intake; only that call establishes live availability. This tool performs no live probe, refresh or authentication.',
  inputSchema: sourceStatusInputSchema,
  annotations: readOnlyAnnotations,
}, input => result(service.sourceStatus(input)));
installStdioDiagnostics(server.server);
await server.connect(createAcademyStdioTransport());
