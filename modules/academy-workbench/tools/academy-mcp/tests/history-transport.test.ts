import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {MAX_QUERY_BYTES} from '../src/contracts.ts';
function historyVariant(input:any){const query=input.properties.query;return (query.oneOf??query.anyOf).find((v:any)=>v.properties.kind.const==='student_history');}
test('generated inspection contract permits omitted facets and advertises uniqueness',()=>{
 const exported=JSON.parse(readFileSync(resolve(import.meta.dir,'../schemas/contracts.json'),'utf8'));
 const variant=historyVariant(exported.tools.academy_query.input);
 expect(variant.required).not.toContain('facets');expect(variant.properties.facets.uniqueItems).toBe(true);
 expect(exported.tools.academy_query.input.required).not.toContain('limit');
});
test('actual SDK tools/list and dual-representation results respect schema and total byte bound',async()=>{
 const client=new Client({name:'independent-history-transport-check',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:['--preload',resolve(import.meta.dir,'network-deny.ts'),resolve(import.meta.dir,'history-transport-fixture.ts')],env:{PATH:process.env.PATH??'/usr/bin:/bin'},stderr:'pipe'});
 try{await client.connect(transport);const tool=(await client.listTools()).tools.find(t=>t.name==='academy_query')!;
  const variant=historyVariant(tool.inputSchema);expect(variant.required).not.toContain('facets');expect(variant.properties.facets.uniqueItems).toBe(true);
  const all=await client.callTool({name:'academy_query',arguments:{query:{kind:'student_history',studentId:'synthetic-student-1'},limit:250}});
  expect(all.isError).not.toBe(true);expect((all.structuredContent as any).unknowns.some((v:string)=>v.includes('lesson_context'))).toBe(true);
  const invalid=await client.callTool({name:'academy_query',arguments:{query:{kind:'student_history',studentId:'synthetic-student-1',facets:['books','books']}}});expect(invalid.isError).toBe(true);
  const ids:string[]=[];let cursor:string|undefined;let pages=0;
  do{const result=await client.callTool({name:'academy_query',arguments:{query:{kind:'student_records',studentId:'synthetic-student-1',facet:'sections'},limit:250,...(cursor?{cursor}:{})}});
   expect(result.isError).not.toBe(true);expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(MAX_QUERY_BYTES);
   const text=result.content.find(c=>c.type==='text');expect(text?.type).toBe('text');
   const data=result.structuredContent as any;expect(JSON.parse((text as any).text)).toEqual(data);
   ids.push(...data.records.map((r:any)=>r.value.id));cursor=data.page.nextCursor??undefined;pages++;
   if(pages===1){expect(data.page.byteLimited).toBe(true);expect(data.page.exhausted).toBe(false);}
   expect(pages).toBeLessThan(30);
  }while(cursor);
  expect(ids).toEqual(Array.from({length:37},(_,i)=>'unicode-'+i));
 }finally{await client.close();await transport.close();}
},20000);
test('actual SDK refusal for oversized source metadata is bounded and omits the original clock',async()=>{
 const client=new Client({name:'independent-fixed-metadata-check',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:['--preload',resolve(import.meta.dir,'network-deny.ts'),resolve(import.meta.dir,'history-transport-fixture.ts'),'--oversized-clock'],env:{PATH:process.env.PATH??'/usr/bin:/bin'},stderr:'pipe'});
 try{await client.connect(transport);const result=await client.callTool({name:'academy_query',arguments:{query:{kind:'roster'},limit:250}});
  expect(result.isError).toBe(true);expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(4096);
  expect(JSON.stringify(result)).toContain('fixed_source_metadata_exceeds_response_budget');
  expect(JSON.stringify(result)).not.toContain('1'.repeat(30));
 }finally{await client.close();await transport.close();}
},10000);
