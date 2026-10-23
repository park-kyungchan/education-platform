import type {McpServer} from '@modelcontextprotocol/server';
import {readOnlyAnnotations} from './contracts.ts';
import {toolResult} from './tool-result.ts';
import {TeacherRetainedService,teacherQuerySchema,teacherReportSchema} from './teacher-retained.ts';
import {boundedTeacherSchema} from './teacher-schema.ts';

export function registerTeacherTools(server:McpServer,service:TeacherRetainedService):void{
  server.registerTool('academy_teacher_query',{
    title:'Read one canonical retained teacher page',
    description:'Navigate business date -> observed class/cohort -> student preparation. Returns one canonical JSON fragment page through a source-owner authenticated callback; consume every page with the canonical strict reader. No native login, source refresh, all/current history, writes, printing or sending. Saved student_history facets and separate dated lesson_context observations remain distinct.',
    inputSchema:boundedTeacherSchema(teacherQuerySchema),annotations:readOnlyAnnotations,
  },async input=>toolResult(await service.query(input)));
  server.registerTool('academy_teacher_report',{
    title:'Read a bounded numbered Korean internal lesson report',
    description:'Reconstructs all canonical pages with the shared strict reader, then pages Korean date/class/student -> day flow -> exact book/edition/unit/activity -> homework/direction. Preserves source scores, scoped teacher judgments, distinct attempts/stages, unknowns, cancelled/replaced assignments and print/distribution uncertainty. Current assignment lists are not pending counts. Continue report pages until exhausted; no parent report send, official save or source acquisition.',
    inputSchema:boundedTeacherSchema(teacherReportSchema),annotations:readOnlyAnnotations,
  },async input=>toolResult(await service.report(input)));
}
