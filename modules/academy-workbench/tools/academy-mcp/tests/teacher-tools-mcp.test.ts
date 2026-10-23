import {test,expect} from 'bun:test';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {loadTeacherSource} from '../src/teacher-source-binding.ts';
import {sourceRoot} from './teacher-fixture.ts';
const selector={kind:'student' as const,studentId:'synthetic-student-0',date:'2090-01-03'};
async function connect(scenario='normal'){
  const client=new Client({name:'synthetic-teacher-consumer-check',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:['--preload',resolve(import.meta.dir,'network-deny.ts'),resolve(import.meta.dir,'teacher-transport-fixture.ts'),scenario],env:{PATH:process.env.PATH??'/usr/bin:/bin'},stderr:'pipe'});
  const errors:string[]=[];transport.stderr?.on('data',chunk=>errors.push(String(chunk)));
  try{await client.connect(transport);}catch(error){await transport.close();throw Error(`synthetic_sdk_startup:${String(error)}:${errors.join('')}`);}
  return {client,close:async()=>{await client.close();await transport.close();},errors};
}
const call=async(client:Client,name:string,args:Record<string,unknown>)=>{
  const result=await client.callTool({name,arguments:args});
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(512*1024);
  expect(result.isError).not.toBe(true);
  const block=result.content.find(part=>part.type==='text');expect(block?.type).toBe('text');
  expect(JSON.parse((block as {text:string}).text)).toEqual(result.structuredContent);
  return result.structuredContent as any;
};
test('real SDK production discovery/schema and canonical Unicode pages reconstruct without loss',async()=>{
  const connection=await connect();
  try{
    const tools=(await connection.client.listTools()).tools;
    expect(tools.map(tool=>tool.name).sort()).toEqual(['academy_teacher_query','academy_teacher_report']);
    for(const tool of tools){expect(tool.annotations?.readOnlyHint).toBe(true);expect(tool.inputSchema.additionalProperties).toBe(false);}
    const invalid=await connection.client.callTool({name:'academy_teacher_query',arguments:{selector,sourceRoot:'/forbidden'}});expect(invalid.isError).toBe(true);
    const binding=await loadTeacherSource(sourceRoot);let pages=0;
    const doc:any=await binding.readDocument(selector,async request=>{pages++;return call(connection.client,'academy_teacher_query',request as Record<string,unknown>);});
    expect(pages).toBeGreaterThan(1);expect(doc.student.id).toBe(selector.studentId);
    const notes=doc.evidence.filter((version:any)=>version.payload.kind==='teacher_reported_note');
    expect(notes).toHaveLength(160);expect(new Set(notes.map((v:any)=>v.revisionId)).size).toBe(160);
    expect(notes[0].payload.text).toContain('가😀');expect(notes[159].payload.text).toContain('159');
  }finally{await connection.close();}
},30000);
test('real SDK Korean report pages are individually bounded and include explicit continuation to final section',async()=>{
  const connection=await connect();
  try{
    let cursor:string|undefined,pages=0;const texts:string[]=[];
    do{
      const result=await call(connection.client,'academy_teacher_report',{selector,maxBytes:50000,limit:250,...(cursor?{cursor}:{})});
      expect(result.status).toBe('page');expect(result.provenance.canonicalPagesConsumed).toBeGreaterThan(1);
      expect(Buffer.byteLength(JSON.stringify({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result}))).toBeLessThanOrEqual(50000);
      if(pages>0)expect(result.text).toContain('[계속:');
      texts.push(result.text);cursor=result.page.nextCursor??undefined;pages++;expect(pages).toBeLessThan(100);
    }while(cursor);
    expect(pages).toBeGreaterThan(1);expect(texts.join('\n')).toContain('오늘 할 일·확인 필요');
    expect(texts.join('\n')).toContain('lesson_context');expect(texts.join('\n')).toContain('명시 배정');
  }finally{await connection.close();}
},30000);
test('real SDK reports refuse malformed, snapshot/caller drift, auth refusal and transport errors without echoing source errors',async()=>{
  for(const [scenario,code] of [['malformed','retained_page_contract_conflict'],['snapshot-drift','retained_page_snapshot_conflict'],['caller-drift','retained_page_snapshot_conflict'],['refusal','owner_scope_conflict'],['transport-error','teacher_source_authenticated_transport_unavailable']]){
    const connection=await connect(scenario);
    try{
      const result=await call(connection.client,'academy_teacher_report',{selector});
      expect(result.status).toBe('refused');expect(result.automaticRetry).toBe(false);
      expect(result.code).toBe(code);
      expect(JSON.stringify(result)).not.toContain('DO_NOT_ECHO');
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(1024);
    }finally{await connection.close();}
  }
},30000);
