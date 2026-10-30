import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {appendFileSync} from 'node:fs';
import {z} from 'zod';
const [endpoint,studentId,events]=process.argv.slice(2);
const server=new McpServer({name:'fictional-paper',version:'1'});
server.registerTool('academy_paper_headers',{description:'Fictional header',inputSchema:z.object({studentId:z.string(),paperCodes:z.array(z.string())}).strict()},async input=>{
  appendFileSync(events!,endpoint+'\n');
  const data=input.studentId===studentId?{status:'observed',endpoint}:{status:'blocked',code:'read_scope_not_admitted'};
  return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
});
await server.connect(new StdioServerTransport());
