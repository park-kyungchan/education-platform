import {expect,test} from 'bun:test';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';

async function connect(){
  const client=new Client({name:'synthetic-pool-only-verifier',version:'0.1.0'}),stderr:string[]=[];
  const transport=new StdioClientTransport({command:process.execPath,
    args:['--preload',resolve(import.meta.dir,'network-deny.ts'),resolve(import.meta.dir,'../src/pool-server.ts')],
    env:{PATH:process.env.PATH??'/usr/bin:/bin'},stderr:'pipe'});
  transport.stderr?.on('data',chunk=>stderr.push(String(chunk)));
  try{await client.connect(transport);return {client,transport,stderr};}catch(error){await transport.close();throw error;}
}

test('dedicated pool server exposes five acquisition reads and four pure reviews without network or student services',async()=>{
  const connection=await connect();
  try{
    const list=await connection.client.listTools();
    expect(list.tools.map(tool=>tool.name).sort()).toEqual(['academy_find_item_labels','academy_item_label_scope','academy_pool_question_content','academy_pool_source_contract','academy_prepare_paper_plan','academy_review_candidate_set','academy_review_type_questions','academy_verify_paper_output','academy_verify_paper_preparation']);
    for(const tool of list.tools){expect(tool.annotations?.readOnlyHint).toBe(true);expect(tool.annotations?.destructiveHint).toBe(false);}
    const proposalTool=list.tools.find(tool=>tool.name==='academy_review_candidate_set')!;
    expect(proposalTool.annotations).toMatchObject({readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true});
    expect(proposalTool.inputSchema.additionalProperties).toBe(false);
    expect(proposalTool.inputSchema.required).toEqual(expect.arrayContaining(['schemaVersion','researchContext','nativeContext','slots']));
    const cases:Array<[string,Record<string,unknown>,Record<string,unknown>]>=[
      ['academy_item_label_scope',{}, {status:'unavailable',actualInventory:'unknown',academyRequests:0}],
      ['academy_find_item_labels',{intent:'Synthetic type',hierarchyIds:['synthetic'],learningState:'teacher_reported_complete'}, {status:'unavailable',actualInventory:'unknown',academyRequests:0}],
      ['academy_review_type_questions',{hierarchyId:'synthetic',labelId:'synthetic',purpose:'teacher_requested_review'}, {status:'unavailable',reason:'question_read_adapter_not_configured',academyRequests:0}],
      ['academy_pool_source_contract',{}, {status:'unavailable',reason:'native_pool_read_adapter_not_configured',difficultyMapping:'unknown',responseFormatMapping:'unknown',academyRequests:0,academyWrites:0}],
      ['academy_pool_question_content',{hierarchyId:'synthetic',labelId:'synthetic',lectureKey:'1001',variant:'sbj',purpose:'teacher_requested_review'}, {status:'unavailable',reason:'native_question_content_adapter_not_configured',academyRequests:0,academyWrites:0}]
    ];
    for(const [name,args,expected]of cases){const result=await connection.client.callTool({name,arguments:args});expect(result.isError).not.toBe(true);expect(result.structuredContent).toMatchObject(expected);expect(result.content.every(block=>block.type==='text')).toBe(true);}
    const proposal=await connection.client.callTool({name:'academy_review_candidate_set',arguments:{schemaVersion:'academy.pool-candidate-set/1',researchContext:null,nativeContext:null,slots:[]}});
    expect(proposal.isError).not.toBe(true);
    expect(proposal.structuredContent).toMatchObject({inputValid:true,readiness:'draft',summary:{slots:0,points:0,candidateOptions:0},
      governance:{status:'proposal_not_accepted',acceptance:'not_inferred',teacherLearningCompletion:'not_inferred',finalMembership:false,academyWrites:0}});
    expect((proposal.structuredContent as any).issues.map((issue:any)=>issue.code)).toEqual(expect.arrayContaining(['research_context_unknown','native_context_unknown','slot_count_incomplete']));
    expect(proposal.content.every(block=>block.type==='text')).toBe(true);
    const binding={sha256:'a'.repeat(64),jsonPointer:'/synthetic'},plan={schemaVersion:'academy.paper-plan/1',selection:[{questionId:'1001',variant:'sbj'},{questionId:'1002',variant:'des'}],
      student:{examDisposeType:'d2',questionsPerPage:2,examSpacer:5,addAnswer:0,addExplain:0},teacher:{examDisposeType:'line',examSpacer:5,addAnswer:1,addExplain:1},
      sourceBindings:{selection:binding,nativeLayout:binding,nativeOptions:binding}};
    const planReply=await connection.client.callTool({name:'academy_prepare_paper_plan',arguments:plan});
    expect(planReply.structuredContent).toMatchObject({inputValid:true,status:'plan_only',summary:{questionCount:2,studentExpectedPages:1,teacherExpectedPages:null},nativeExecutionVerified:false});
    const planFingerprint=(planReply.structuredContent as any).planFingerprint;
    const {questionsPerPage:_,...student}=plan.student;
    const prepared=await connection.client.callTool({name:'academy_verify_paper_preparation',arguments:{plan,planFingerprint,
      prepared:{templateSha256:'b'.repeat(64),selection:plan.selection,student,teacher:plan.teacher,sourceBindings:plan.sourceBindings}}});
    expect(prepared.structuredContent).toMatchObject({status:'consistent_caller_reported',issues:[],nativeExecutionVerified:false,sourceBytesVerified:false});
    const makeOutput=(teacher:boolean)=>({pdfSha256:(teacher?'c':'d').repeat(64),receiptSha256:'e'.repeat(64),planFingerprint,pageCount:1,orderMethod:'numbered_visual_order',
      pages:[{pageNumber:1,questionIds:['1001','1002']}],visualReview:{method:'human_visual',reviewedPages:[1],answers:teacher?'present':'absent',explanations:teacher?'present':'absent',variants:'match',rendering:'complete'}});
    const output=await connection.client.callTool({name:'academy_verify_paper_output',arguments:{plan,planFingerprint,outputs:{student:makeOutput(false),teacher:makeOutput(true)}}});
    expect(output.structuredContent).toMatchObject({status:'consistent_caller_reported',issues:[],nativeExecutionVerified:false,acceptance:'not_inferred',effects:{nativeCommands:0,fileReads:0}});
    for(const name of ['academy_prepare_paper_plan','academy_verify_paper_preparation','academy_verify_paper_output']){
      const tool=list.tools.find(value=>value.name===name)!;
      expect(tool.annotations).toMatchObject({readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true});expect(tool.inputSchema.additionalProperties).toBe(false);
      const reply=await connection.client.callTool({name,arguments:{...plan,nativeOwner:'PRIVATE_EXTRA_FIELD'}});expect(reply.isError).toBe(true);
    }
    expect(connection.stderr.join('')).not.toContain('verification_outbound_network_attempt_blocked');
  }finally{await connection.client.close();await connection.transport.close();}
},15000);

test('pool-only MCP schemas reject arbitrary URLs, foreign purposes and undeclared source-contract arguments',async()=>{
  const connection=await connect();
  try{
    const input={hierarchyId:'synthetic',labelId:'synthetic',lectureKey:'1001',variant:'sbj',purpose:'teacher_requested_review'};
    for(const args of [{...input,url:'https://example.invalid/private'},{...input,purpose:'print'},{...input,variant:'solution'},{...input,lectureKey:'01001'}]){
      const reply=await connection.client.callTool({name:'academy_pool_question_content',arguments:args});expect(reply.isError).toBe(true);
    }
    const reply=await connection.client.callTool({name:'academy_pool_source_contract',arguments:{studentId:'forbidden'}});expect(reply.isError).toBe(true);
    const proposal=await connection.client.callTool({name:'academy_review_candidate_set',arguments:{schemaVersion:'academy.pool-candidate-set/1',researchContext:null,nativeContext:null,slots:[],accepted:true}});expect(proposal.isError).toBe(true);
    expect(connection.stderr.join('')).not.toContain('verification_outbound_network_attempt_blocked');
  }finally{await connection.client.close();await connection.transport.close();}
},15000);
