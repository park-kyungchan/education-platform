/** Pure adaptation of the separately reconstructed user business context. No execution authority is supplied by these types. */
import {resolveUserContext,type UserContextAssertion} from './logical-model-v2.ts';
export type ContextSource={id:string;kind:string;sourceDate:string|null;observedAt:string;sourceVersion:string|null;dateMeaning:string};
export type ContextFact={id:string;layer:string;kind:string;statement:string;status:string;evidenceLevel:string;scope:string;evidence:Array<{sourceId:string;blockIds:string[]}>;supersedes:string[]};
export type ReconstructedContext={authorityGrant:unknown;sources:ContextSource[];facts:ContextFact[];decisionRoutes:Array<{id:string;purposeIds:string[];decisionIds:string[];unresolvedIds:string[];targetWork:string;nextStep:string}>};
export function businessContextAssertions(input:ReconstructedContext,observedAt:string):UserContextAssertion[]{
  const sources=new Map(input.sources.map(x=>[x.id,x]));
  const facts=input.facts.filter(x=>['confirmed_purposes','durable_work_rules'].includes(x.layer));
  const ids=new Set(facts.map(x=>x.id));const groups=new Map(facts.map(x=>[x.id,x.id]));
  const root=(id:string):string=>{const p=groups.get(id)!;if(p===id)return id;const r=root(p);groups.set(id,r);return r;};
  for(const f of facts)for(const old of f.supersedes){if(!ids.has(old))throw new Error('context_supersedes_outside_supported_layers');const pair=[root(f.id),root(old)].sort();groups.set(pair[1]!,pair[0]!);}
  return facts.map(f=>{
    const direct=f.evidence.map(x=>sources.get(x.sourceId)).find(s=>s?.kind==='user_message');
    const source=direct??f.evidence.map(x=>sources.get(x.sourceId)).find(Boolean);if(!source)throw new Error('context_source_missing');
    const confirmed=f.evidenceLevel==='user_confirmed'||f.evidenceLevel==='user_confirmation_on_page';
    const directConfirmed=confirmed&&source.kind==='user_message';
    const pageConfirmed=f.evidenceLevel==='user_confirmation_on_page'&&source.kind==='user_page';
    const kind=['goal','workflow_rule','correction','preference','constraint'].includes(f.kind)?f.kind as UserContextAssertion['kind']:'constraint';
    const sourceDate=source.sourceDate??null;
    return {id:f.id,key:root(f.id),kind,value:{factId:f.id,statement:f.statement},appliesTo:['pilot',f.scope],
      evidenceConfidence:confirmed?'observed':f.evidenceLevel==='reconciled_contract'?'inferred':'unverified',
      provenance:{source:directConfirmed?'direct_user_message':pageConfirmed?'user_document':'interpretation',intentAttribution:directConfirmed?'direct_user':pageConfirmed?'user_confirmed_document':'unverified',reference:source.id,authoredAt:source.dateMeaning==='message_sent_at'&&sourceDate?.includes('T')?sourceDate:null,authoredOn:source.kind==='user_message'&&sourceDate?sourceDate.slice(0,10):null,observedAt,sourceVersion:source.sourceVersion?{kind:'declared_version',value:source.sourceVersion}:{kind:'unknown'}},
      supersedes:f.supersedes,status:f.status==='active'?'active':['historical','withdrawn'].includes(f.status)?'superseded':'uncertain',authority:'business_context_only_not_execution_permission'};
  });
}
export function resolveBusinessRoute(input:ReconstructedContext,routeId:string,observedAt:string){
  const route=input.decisionRoutes.find(x=>x.id===routeId);if(!route)throw new Error('unknown_context_route');
  const assertions=businessContextAssertions(input,observedAt);const result=resolveUserContext(assertions,'pilot');
  const relevantIds=new Set([...route.purposeIds,...route.decisionIds]);
  const active=result.active.filter(x=>relevantIds.has(x.id));const contextIds=new Set(assertions.map(x=>x.id));
  const separateEvidence=input.facts.filter(x=>route.decisionIds.includes(x.id)&&!contextIds.has(x.id));
  return {routeId,purposeIds:route.purposeIds,activeDecisionIds:active.map(x=>x.id),
    facts:active,unverifiedContextDecisionIds:route.decisionIds.filter(id=>contextIds.has(id)&&!active.some(x=>x.id===id)),
    separateEvidenceRefs:separateEvidence.map(x=>({factId:x.id,layer:x.layer,scope:x.scope,status:x.status,evidenceLevel:x.evidenceLevel,sourceIds:x.evidence.map(e=>e.sourceId)})),
    unresolvedRefs:route.unresolvedIds,sourceReferences:active.map(x=>({factId:x.id,sourceId:x.provenance.reference,sourceVersion:x.provenance.sourceVersion})),
    supersededExcludedIds:assertions.filter(x=>x.status==='superseded').map(x=>x.id),
    actionAuthorization:'none_from_context',execution:'not_implemented'};
}
