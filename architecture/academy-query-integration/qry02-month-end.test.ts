import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {hierarchySourcePage,labelSourcePage} from '../../apps/academy/month-end-web/src/source-page';
import type {SourcePort} from '../../apps/academy/month-end-workbench/src/contracts';
// Load the actual provider through Bun; its external SDK declaration gap remains explicit.
const providerPath=resolveProvider();
function resolveProvider(){return new URL('../../apps/academy/month-end-workbench/src/integrations/mcp-source-port.ts',import.meta.url).pathname;}
const provider=await import(providerPath) as {createSyntheticMcpSourcePort(client:unknown,projection:unknown):Promise<SourcePort>};
test('actual month-end frontend requests drain all hierarchy and label pages within existing MCP bounds',async()=>{
  const calls:any[]=[],receipt={selectorSha256:'a'.repeat(64),observedAt:'2090-01-02T00:00:00.000Z',coverage:'returned_page_only'};
  const client={listTools:async()=>({tools:['academy_item_label_scope','academy_find_item_labels','academy_review_type_questions'].map(name=>({name,annotations:{readOnlyHint:true,destructiveHint:false}}))}),close:async()=>{},callTool:async({arguments:input}:any)=>{
    calls.push(input);expect(input.limit).toBe(50);const offset=input.offset,end=Math.min(120,offset+input.limit),nextOffset=end<120?end:null;
    const rows=Array.from({length:end-offset},(_,n)=>n+offset);
    return {structuredContent:{status:'available',assessmentBinding:input.assessmentBinding,assessmentBindingSha256:createHash('sha256').update(JSON.stringify(input.assessmentBinding)).digest('hex'),finalItemMembershipCreated:false,source:receipt,nextOffset,
      nodes:input.view==='hierarchy'?rows.map(n=>({id:'synthetic-category-'+n,parentId:null,title:'Invented '+n})):[],
      labels:input.view==='labels'?rows.map(n=>({id:'synthetic-label-'+n,nativeId:String(1000+n),labelExact:'Invented label '+n,hierarchyId:input.hierarchyId,sourceQuestionCountRaw:null})):[]}};
  }};
  const port=await provider.createSyntheticMcpSourcePort(client,{owner:'math-research-module',revision:'07edb2dea2e5997aea4318f0fa2efa21dde633df',manifest:[{path:'synthetic.json',sha256:'b'.repeat(64)}]});
  try{
    let context=null as any,offset=0;const nodes:string[]=[],labels:string[]=[];
    do{const page=await port.scope(hierarchySourcePage(context,null,offset));context=page.context;nodes.push(...page.categories.map(r=>r.id));offset=page.nextOffset??0;}while(offset);
    expect(nodes).toHaveLength(120);expect(new Set(nodes).size).toBe(120);
    do{const page=await port.scope(labelSourcePage(context,nodes[0]!,offset));context=page.context;labels.push(...page.labels.map(r=>r.pat_no));offset=page.nextOffset??0;}while(offset);
    expect(labels).toHaveLength(120);expect(new Set(labels).size).toBe(120);expect(calls).toHaveLength(6);
  }finally{await port.close?.();}
});
