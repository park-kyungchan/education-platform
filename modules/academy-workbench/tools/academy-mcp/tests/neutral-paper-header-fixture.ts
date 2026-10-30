import './network-deny.ts';
import {appendFileSync} from 'node:fs';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';
import {decodePaperCode} from '../../../../../apps/academy/dc-gang-a/src/lms/printedPaperCode.ts';
const events=process.argv[2]!;
appendFileSync(events,'paper-start\n');
const server=new McpServer({name:'fictional-paper-reader',version:'1.0.0'});
server.registerTool('academy_paper_headers',{inputSchema:z.object({studentId:z.string(),paperCodes:z.array(z.string())}).strict()},input=>{
  appendFileSync(events,'headers\n');
  const data={status:'observed',scope:{studentId:input.studentId},observation:{status:'observed',rows:input.paperCodes.map(paperCode=>({
    status:'observed',paperCode,requestedPaperKey:decodePaperCode(paperCode),observedAt:'2040-01-16T00:00:00Z',
    contentHeader:{sourceSha256:'a'.repeat(64),metadataRows:[{label:'시험지 제목',value:'Invented title'},{label:'평가구분',value:'DT/ZT'},{label:'총 문제수',value:'4'}]}}))}};
  return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
});
await server.connect(new StdioServerTransport());
