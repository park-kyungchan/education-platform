import {dailyRecordLearningConfiguration} from './dailyrecord-learning.ts';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { capabilitiesInputSchema, loadService, sourceStatusInputSchema } from './service.ts';
import { readOnlyAnnotations } from './contracts.ts';
import {toolResult as result} from './tool-result.ts';
import {registerSavedQuery} from './query-tool.ts';
import { repoRoot } from './paths.ts';
import {loadItemLabelIndex} from './item-label-store.ts';
import {registerItemLabelTools} from './item-label-tools.ts';
import {dailyRecordToolConfiguration,registerDailyRecordTools} from './dailyrecord-tools.ts';
import {DailyRecordService} from './dailyrecord.ts';

const service = await loadService(repoRoot);
const server = new McpServer({ name: 'academy-operations', version: '0.1.0' });
const learning=await dailyRecordLearningConfiguration(process.argv.slice(2));
const configuration=await dailyRecordToolConfiguration(learning.remainingArgs);
registerItemLabelTools(server,await loadItemLabelIndex(configuration.remainingArgs));
registerDailyRecordTools(server,new DailyRecordService(null,configuration.parentSafeguard,Date.now,learning.learningPolicy));
server.registerTool('academy_capabilities', {
  title: 'Academy operational hierarchy and source contracts',
  description: 'Discover hierarchical academy workflows, page the complete pinned source inventory, or inspect one exact source contract. Source metadata is not an executable operation. No source requests.',
  inputSchema: capabilitiesInputSchema,
  annotations: readOnlyAnnotations,
}, input => result(service.capabilities(input)));
registerSavedQuery(server,input=>service.query(input));
server.registerTool('academy_source_status', {
  title: 'Source availability, visibility and preservation limits',
  description: 'Read saved-source coverage and the user-reported two-week website visibility limit and direct-access permission restriction. No live probe, refresh or authentication.',
  inputSchema: sourceStatusInputSchema,
  annotations: readOnlyAnnotations,
}, input => result(service.sourceStatus(input)));
await server.connect(new StdioServerTransport());
