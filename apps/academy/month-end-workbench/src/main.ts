import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createApplication, unavailableSourcePort } from './application.ts';
import { researchProjection } from './research.ts';
import { createRequestHandler } from './server.ts';
import { createSyntheticSourcePort } from './synthetic.ts';
import type { SourcePort } from './contracts.ts';
const port=Number(process.env.MONTH_END_PORT??'4327');if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('MONTH_END_PORT must be bounded1024–65535');
const mode=process.env.MONTH_END_SOURCE_MODE??'unavailable';let source:SourcePort=unavailableSourcePort;
if(mode==='synthetic')source=createSyntheticSourcePort();
else if(mode==='native-readonly'){
 const configPath=process.env.MONTH_END_SOURCE_CONFIG;if(!configPath)throw new Error('Operator-selected pinned server-only source configuration required');
 const {createMcpSourcePort}=await import('./integrations/mcp-source-port.ts');
 source=await createMcpSourcePort(JSON.parse(await readFile(resolve(configPath),'utf8')),researchProjection);
}else if(mode!=='unavailable')throw new Error('Unknown explicit source mode');
const origin=`http://127.0.0.1:${port}`;
const server=Bun.serve({hostname:'127.0.0.1',port,fetch:createRequestHandler({applicationFactory:()=>createApplication(researchProjection,source),allowedOrigin:origin,frontendRoot:resolve(import.meta.dir,'../../month-end-web/dist')})});
console.log(`Month-end research workbench ${origin}; Academy source mode=${source.mode}. No persistence or send routes.`);
async function close(){server.stop();await source.close?.();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
