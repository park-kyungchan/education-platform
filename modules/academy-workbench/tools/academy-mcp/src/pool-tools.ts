import type {McpServer} from '@modelcontextprotocol/server';
import {z} from 'zod';
import type {ItemLabelBackend} from './item-label-tools.ts';
import {poolQuestionContentInputSchema} from './pool-question-content.ts';
import {readOnlyAnnotations} from './contracts.ts';
import {poolCandidateSetSchema,reviewCandidateSet} from './pool-candidate-comparison.ts';
import {paperPlanInputSchema,paperPreparationInputSchema,paperOutputInputSchema,preparePaperPlan,verifyPaperPreparation,verifyPaperOutput} from './paper-preparation.ts';

type PoolBackend=ItemLabelBackend&{
  protocol?:()=>Promise<unknown>;
  content?:(value:unknown)=>Promise<{metadata:Record<string,unknown>;image?:{type:'image';data:string;mimeType:string}}>;
};
const response=(value:unknown)=>{const structuredContent=JSON.parse(JSON.stringify(value)) as Record<string,unknown>;return {content:[{type:'text' as const,text:JSON.stringify(structuredContent)}],structuredContent};};

/** Additional pool-only reads; no preserved student service, source mutation or arbitrary HTTP proxy. */
export function registerPoolEvidenceTools(server:McpServer,backend:PoolBackend|null){
  const annotations={...readOnlyAnnotations,openWorldHint:backend?.openWorldHint??false,idempotentHint:backend?.idempotentHint??false};
  server.registerTool('academy_pool_source_contract',{
    title:'Inspect original pool difficulty and presentation evidence',
    description:'Read exact original selector control values/labels, grid column and formatter references, source hashes and source-change limitations. No JavaScript is executed. Unknown mappings stay unknown; score allocation never substitutes for observed native difficulty.',
    inputSchema:z.object({}).strict(),annotations,
  },async()=>response(backend?.protocol?await backend.protocol():{status:'unavailable',reason:'native_pool_read_adapter_not_configured',difficultyMapping:'unknown',responseFormatMapping:'unknown',academyRequests:0,academyWrites:0}));
  server.registerTool('academy_pool_question_content',{
    title:'Read one previously returned source-qualified question preview',
    description:'Fetch one exact source-qualified PNG reference for a question previously exposed in this MCP session. No arbitrary URL, credentials, redirect, source callback or generated preview. Variant names do not establish problem/solution roles. Returned image still needs mathematical and solution-process inspection.',
    inputSchema:poolQuestionContentInputSchema,annotations,
  },async input=>{
    if(!backend?.content)return response({status:'unavailable',reason:'native_question_content_adapter_not_configured',academyRequests:0,academyWrites:0});
    const result=await backend.content(input),reply=response(result.metadata);
    return {...reply,content:result.image?[...reply.content,result.image]:reply.content};
  });
  server.registerTool('academy_review_candidate_set',{
    title:'Review a 24-slot research-bound candidate proposal',
    description:'Validate the confirmed 8/8/8 unit allocation, middle/high/highest quotas12/8/4 and100points,24distinct primary research detailed types and2–3 original candidate questions per slot. Inspect mathematical structure and required solution-process evidence, original difficulty/response-mode observations, source bindings and missing/duplicate/stale facts. Pure local review; does not retrieve evidence, generate rankings, create final exam membership or infer acceptance.',
    inputSchema:poolCandidateSetSchema,annotations:{...readOnlyAnnotations,openWorldHint:false,idempotentHint:true},
  },async input=>response(reviewCandidateSet(input)));
  const pureAnnotations={...readOnlyAnnotations,openWorldHint:false,idempotentHint:true};
  server.registerTool('academy_prepare_paper_plan',{
    title:'Prepare a source-bound paper metadata plan',
    description:'Fingerprint 2–24 unique selected question IDs and exact sbj/des order, source hash/pointer bindings, student d2 two-per-page with answer/explanation0/0, and teacher line with1/1. Derive expected student pages without constructing or generating a paper. Strict metadata only: no private rows, URLs, credentials, files or native transport. Supplied bindings are caller reported, not independently verified.',
    inputSchema:paperPlanInputSchema,annotations:pureAnnotations,
  },async input=>response(preparePaperPlan(input)));
  server.registerTool('academy_verify_paper_preparation',{
    title:'Review prepared paper metadata against its exact plan',
    description:'Compare a minimal caller-reported ordered-ID/variant and layout/answer-flag projection against the canonical plan fingerprint and source bindings. Report mismatch positions without raw source rows or print content. A consistent projection does not verify payload bytes, source truth, native execution, PDF pagination or acceptance. No generation, transport or file reads.',
    inputSchema:paperPreparationInputSchema,annotations:pureAnnotations,
  },async input=>response(verifyPaperPreparation(input)));
  server.registerTool('academy_verify_paper_output',{
    title:'Review a caller-reported PDF and visual receipt summary',
    description:'Compare hash-bound caller-supplied student/teacher receipt metadata to the exact plan: student two questions per physical page and N/2 pages, numbered question order, all-page human review or exact-model Jev-first page receipts with human exception coverage, variants, answer/explanation visibility and rendering. Teacher line has no fixed page count. No PDF or image is opened and no model is called; supplied receipts never become independent native proof, acceptance, physical printing or delivery.',
    inputSchema:paperOutputInputSchema,annotations:pureAnnotations,
  },async input=>response(verifyPaperOutput(input)));
}
