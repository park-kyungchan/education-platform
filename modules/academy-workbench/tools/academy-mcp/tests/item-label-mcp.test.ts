import {expect,test} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {labelFixture,labelQuery} from './item-label-fixture.ts';

async function connect(args:string[]) {
  const client=new Client({name:'synthetic-label-verifier',version:'0.1.0'});
  const transport=new StdioClientTransport({command:process.execPath,
    args:['--preload',resolve(import.meta.dir,'network-deny.ts'),resolve(import.meta.dir,'../src/label-server.ts'),...args],
    env:{PATH:process.env.PATH??'/usr/bin:/bin'},stderr:'pipe'});
  await client.connect(transport);
  return {client,transport};
}
test('actual stdio tool discovery and scoped label retrieval preserve task context with network denied',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'academy-label-mcp-'));
  let connection:Awaited<ReturnType<typeof connect>>|undefined;
  try{
    const path=resolve(directory,'labels.json'),bytes=JSON.stringify(labelFixture());await writeFile(path,bytes);
    const sha=createHash('sha256').update(bytes).digest('hex');connection=await connect(['--label-snapshot',path,'--label-sha256',sha]);
    const tools=await connection.client.listTools();expect(tools.tools.map(tool=>tool.name).sort()).toEqual(['academy_cism_section','academy_dailyrecord_get','academy_dailyrecord_intake','academy_dailyrecord_review','academy_find_item_labels','academy_item_label_scope','academy_review_type_questions','academy_student_metadata','academy_student_resolve']);
    for(const tool of tools.tools){expect(tool.annotations?.readOnlyHint).toBe(true);expect(tool.annotations?.destructiveHint).toBe(false);}
    const result=await connection.client.callTool({name:'academy_find_item_labels',arguments:labelQuery});
    expect(result.isError).not.toBe(true);const value=result.structuredContent as any;
    expect(value.matches[0].id).toBe('label-002');expect(value.userContext.workflow[0]).toBe('study_detailed_types');expect(value.source.academyRequests).toBe(0);
    const denied=await connection.client.callTool({name:'academy_find_item_labels',arguments:{...labelQuery,hierarchyIds:['foreign']}});
    expect(denied.isError).toBe(true);
    const held=await connection.client.callTool({name:'academy_find_item_labels',arguments:{...labelQuery,learningState:'in_progress'}});
    expect((held.structuredContent as any).status).toBe('held');
  }finally{await connection?.client.close();await connection?.transport.close();await rm(directory,{recursive:true,force:true});}
},20000);
test('unconfigured actual server reports unknown inventory without reading preserved student data',async()=>{
  const connection=await connect([]);
  try{const result=await connection.client.callTool({name:'academy_item_label_scope',arguments:{}});
    expect(result.structuredContent).toMatchObject({status:'unavailable',actualInventory:'unknown',academyRequests:0});
  }finally{await connection.client.close();await connection.transport.close();}
},10000);
