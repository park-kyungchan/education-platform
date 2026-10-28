import {expect,test} from 'bun:test';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {context} from './dailyrecord-fixture.ts';

async function connect(entry:string){
  const client=new Client({name:'synthetic-dailyrecord-verifier',version:'0.1.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:['--preload',resolve(import.meta.dir,'network-deny.ts'),resolve(import.meta.dir,'../src',entry)],env:{PATH:process.env.PATH??'/usr/bin:/bin'},stderr:'pipe'});
  await client.connect(transport);return {client,transport};
}
test('existing label MCP discovers context-required DailyRecord tools while preserving all three label tools',async()=>{
  const {client,transport}=await connect('label-server.ts');
  try{
    const tools=(await client.listTools()).tools;
    expect(tools.map(t=>t.name).sort()).toEqual(['academy_endpoint_identity','academy_student_metadata_get','academy_cism_section','academy_dailyrecord_get','academy_dailyrecord_intake','academy_dailyrecord_review','academy_find_item_labels','academy_item_answer_lookup','academy_item_label_scope','academy_review_type_questions','academy_runtime_read_admission','academy_student_metadata','academy_student_resolve'].sort());
    expect(tools.some(t=>/save|send|approve/.test(t.name))).toBe(false);
    for(const name of ['academy_dailyrecord_intake','academy_dailyrecord_review','academy_cism_section']){
      const tool=tools.find(t=>t.name===name)!;expect(tool.annotations?.readOnlyHint).toBe(true);expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.inputSchema.required).toContain('context');const refused=await client.callTool({name,arguments:{}});expect(refused.isError).toBe(true);
    }
    const intake=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:context()}});
    expect(intake.isError).not.toBe(true);expect(intake.structuredContent).toMatchObject({status:'held',sourceAvailability:'unavailable',academyWrites:0,parentSends:0,observationHandle:null});
    expect((intake.structuredContent as any).userContext.currentRequestRef).toBe(context().currentRequestRef);
    const forged=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:{...context(),approved:true}}});expect(forged.isError).toBe(true);
    const review=await client.callTool({name:'academy_dailyrecord_review',arguments:{context:context(),proposals:[{field:'progress',value:'지정 문제 12문항 풀이 진행.',factRefs:['user-fact:progress'],decision:{kind:'replace',requestRef:context().currentRequestRef}}]}});
    expect(review.isError).not.toBe(true);expect(review.structuredContent).toMatchObject({status:'held',observationHandle:null,patch:[],execution:'not_supported'});
    const cism=await client.callTool({name:'academy_cism_section',arguments:{context:context(),selection:{reportId:'fictional-report',periodStart:'2040-01-08',periodEnd:'2040-01-14',section:'learning_support'}}});
    expect(cism.structuredContent).toMatchObject({status:'unavailable',reasonCode:'exact_cism_read_backend_not_configured',parentSends:0});
  }finally{await client.close();await transport.close();}
},20000);
test('dedicated entrypoint discovers the read-only DailyRecord/metadata/resolver and identity tools with network denied',async()=>{
  const {client,transport}=await connect('dailyrecord-server.ts');
  try{
    const tools=(await client.listTools()).tools;
    expect(tools.map(t=>t.name).sort()).toEqual(['academy_endpoint_identity','academy_student_metadata_get','academy_cism_section','academy_dailyrecord_get','academy_dailyrecord_intake','academy_dailyrecord_review','academy_item_answer_lookup','academy_runtime_read_admission','academy_student_metadata','academy_student_resolve'].sort());
    expect(tools.find(t=>t.name==='academy_student_metadata')?.annotations?.readOnlyHint).toBe(true);
    const metadata=await client.callTool({name:'academy_student_metadata',arguments:{purpose:'Invented read',currentRequestRef:'invented-request',
      scope:{sourceNamespace:'academy.lms.metadata',teacherId:'99001',studentId:'77001',lessonDate:'2040-01-04'},queries:[{kind:'daily_metadata'}]}});
    expect(metadata.structuredContent).toMatchObject({status:'unavailable',reasonCode:'student_metadata_backend_not_configured',academyWrites:0,parentSends:0});
  }
  finally{await client.close();await transport.close();}
},10000);
