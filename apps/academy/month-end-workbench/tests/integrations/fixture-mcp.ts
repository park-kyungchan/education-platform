// Fictional in-process SDK source only. No process or network transport is created.
import {createHash} from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/server';
import {z} from 'zod';
export function createFixtureServer(options:{sourceQuestionCountRaw?:unknown}={}){
const sourceQuestionCountRaw=Object.hasOwn(options,'sourceQuestionCountRaw')?options.sourceQuestionCountRaw:'2';
const server=new McpServer({name:'synthetic-read-port-test',version:'1'}),annotations={readOnlyHint:true,destructiveHint:false};
const h='a'.repeat(64),clock='2026-10-17T00:00:00Z';
const finish=(b:any,out:any)=>{const structuredContent={...out,assessmentBinding:b,assessmentBindingSha256:createHash('sha256').update(JSON.stringify(b)).digest('hex'),finalItemMembershipCreated:false};return {structuredContent,content:[{type:'text' as const,text:JSON.stringify(structuredContent)}]};};
const shape=z.object({assessmentBinding:z.any()}).passthrough();
server.registerTool('academy_item_label_scope',{inputSchema:shape,annotations},async(input:any)=>{
  const offset=input.offset??0,pat=String(7+offset);
  const receipt={selectorSha256:h,observedAt:offset===2?'2026-10-17T00:01:00Z':clock,sha256:offset===3?'c'.repeat(64):h};
  return finish(input.assessmentBinding,{status:'available',source:receipt,nodes:input.view==='labels'?[]:[{id:'category-3',parentId:input.parentId,title:'합성: 원래 분류',scope:{cl1:1,cl2:2,cl3:3,cl4:0},isLazy:true,isFolder:true},{id:'category-1',parentId:input.parentId,title:'합성: 상위 분류',scope:{cl1:1,cl2:0,cl3:0,cl4:0},isLazy:true,isFolder:true}],labels:input.view==='labels'?[{id:'academy-pat:fixture:string:'+pat,nativeId:pat,hierarchyId:input.hierarchyId,labelExact:'합성 유형',sourceQuestionCountRaw}]:[],nextOffset:input.view==='labels'&&offset===0?1:null});
});
server.registerTool('academy_find_item_labels',{inputSchema:shape,annotations},async(input:any)=>{
  if(input.intent==='refuse')throw Error('synthetic_auth_refusal');
  const b=input.intent==='forge'?{...input.assessmentBinding,sourceContext:null}:input.assessmentBinding;
  return finish(b,{status:'available',source:{selectorSha256:h},matches:[{id:'academy-pat:fixture:string:7',nativeId:'7',hierarchyId:input.hierarchyIds[0],labelExact:'합성 유형',overlapTerms:['pair:합성'],sourceQuestionCountRaw}]});
});
server.registerTool('academy_review_type_questions',{inputSchema:shape,annotations},async(input:any)=>finish(input.assessmentBinding,{status:'available',hierarchyId:input.hierarchyId,labelId:input.labelId,patNo:'7',selectorSha256:h,sourceSha256:'b'.repeat(64),page:1,nextOffset:input.offset===0?1:null,nextPage:null,previewReferencesState:'qualified_original_source',questions:[{sourceNamespace:'academy_item',lectureKey:input.offset===0?'70':'71',patNo:'7',sourceFields:{answer:'72',original:'synthetic'},previewReferences:[]}]}));
return server;
}
