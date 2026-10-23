import type {McpServer} from '@modelcontextprotocol/server';
import {queryInputSchema,queryResultSchema,readOnlyAnnotations,type SavedQueryResult} from './contracts.ts';
import {toolResult} from './tool-result.ts';
export function registerSavedQuery(server:McpServer,query:(input:unknown)=>SavedQueryResult) {
  server.registerTool('academy_query', {
    title: 'Query preserved teacher-managed academic evidence',
    description: 'Read the preserved managed-student roster, bounded selected evidence facets or dated lesson context. student_history batches the selected saved facets; dated lesson_context source observations remain a separate query. Missing records do not prove nonperformance. No academy requests.',
    inputSchema:queryInputSchema,outputSchema:queryResultSchema,annotations:readOnlyAnnotations,
  }, input => toolResult(query(input)));
}
