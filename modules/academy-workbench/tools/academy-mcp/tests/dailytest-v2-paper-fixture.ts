import './network-deny.ts';
import {appendFileSync} from 'node:fs';
import {McpServer} from '@modelcontextprotocol/server';
import {z} from 'zod';
import {runtimeIdentityConfiguration,registerRuntimeIdentity} from '../src/runtime-identity.ts';
import {installStdioDiagnostics,createAcademyStdioTransport} from '../src/stdio-diagnostics.ts';
import {decodePaperCode} from '../../../../../apps/academy/dc-gang-a/src/lms/printedPaperCode.ts';
const identity=await runtimeIdentityConfiguration(process.argv.slice(2));
const [endpoint,events,mode]=identity.remainingArgs;
const server=new McpServer({name:'fictional-paper',version:'1'});
registerRuntimeIdentity(server,identity.identity);
server.registerTool('academy_paper_headers',{inputSchema:z.object({studentId:z.string(),paperCodes:z.array(z.string())}).strict()},input=>{
 appendFileSync(events!,endpoint+'\n');
 const data=mode==='deny'?{status:'blocked',code:'read_scope_not_admitted',sourceRequests:0,private:'PRIVATE_CANARY'}:mode==='latched'?{status:'blocked',code:'source_failure_latched_no_retry'}:mode==='private'?{status:'blocked',code:'private_canary',metrics:{sourceRequests:2}}:{status:'observed',scope:{studentId:input.studentId},observation:{status:'observed',rows:input.paperCodes.map(paperCode=>({status:'observed',paperCode,requestedPaperKey:mode==='identity'?'99999':decodePaperCode(paperCode),observedAt:'2040-01-16T00:00:00Z',contentHeader:{sourceSha256:'a'.repeat(64),metadataRows:[{label:'시험지 제목',value:'Fictional test'}]}}))}};
 return {isError:false,content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
});
installStdioDiagnostics(server.server);await server.connect(createAcademyStdioTransport());
