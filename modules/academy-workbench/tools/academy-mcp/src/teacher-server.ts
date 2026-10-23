import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {loadTeacherSource,type AuthenticatedFetchPage} from './teacher-source-binding.ts';
import {TeacherRetainedService} from './teacher-retained.ts';
import {registerTeacherTools} from './teacher-query-tools.ts';

export interface TeacherServerConfiguration {sourceRoot:string;authenticatedFetchPage:AuthenticatedFetchPage}
/** Explicit owner-local composition entrypoint. No standalone CLI, private default loader or native registration. */
export async function createTeacherServer(configuration:TeacherServerConfiguration):Promise<McpServer>{
  if(typeof configuration?.authenticatedFetchPage!=='function')throw Error('teacher_source_authenticated_transport_required');
  const binding=await loadTeacherSource(configuration.sourceRoot);
  const server=new McpServer({name:'academy-teacher-consumer',version:'0.1.0'});
  registerTeacherTools(server,new TeacherRetainedService(binding,configuration.authenticatedFetchPage));
  return server;
}
export async function startTeacherStdio(configuration:TeacherServerConfiguration):Promise<McpServer>{
  const server=await createTeacherServer(configuration);
  await server.connect(new StdioServerTransport());
  return server;
}
