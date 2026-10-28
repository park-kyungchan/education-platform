import {academyRoutingDescription} from './routing-context.ts';
import type {McpServer} from '@modelcontextprotocol/server';
import {queryInputSchema,queryResultSchema,readOnlyAnnotations,type SavedQueryResult} from './contracts.ts';
import {toolResult} from './tool-result.ts';
export function registerSavedQuery(server:McpServer,query:(input:unknown)=>SavedQueryResult) {
  server.registerTool('academy_query', {
    title: 'Query preserved teacher-managed academic evidence',
    description: academyRoutingDescription('academy_query','Historical saved evidence ONLY, never current/live DailyRecord. For today/current DailyRecord use academy_dailyrecord_get (or academy_student_resolve then academy_dailyrecord_intake). Read the preserved roster, selected facets or dated lesson context. student_history batches saved facets; lesson_context overlays are separate. Saved snapshot timestamps do not refresh the source or prove live access unavailable. Missing records do not prove nonperformance. No academy requests.'),
    inputSchema:queryInputSchema,outputSchema:queryResultSchema,annotations:readOnlyAnnotations,
  }, input => toolResult(query(input)));
}
