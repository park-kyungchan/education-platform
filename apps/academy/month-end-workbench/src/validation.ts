import { SOURCE_REVISION, type Projection, type SourceRef, type StudyScope, type DesiredQuestionIntent, type StudyReport, type SourceContext } from './contracts.ts';
export class DomainInputError extends Error {}
export function requireValue(condition: unknown, message: string): asserts condition { if(!condition) throw new DomainInputError(message); }
const authorityFields=new Set(['nativePermissionGranted','actualAcceptanceInferred','grantsExecution','studentStateEstablished','validatedLatentConstruct','full105TypesDiagnosed','acceptanceInferred','mathematicalValidation','empiricalLearningValidation']);
/** Application ingress; shared Artifact and source-owned semantics remain with their existing validators. */
export function rejectAuthority(value: unknown): void {
 if(!value||typeof value!=='object') return;
 for(const [key,v] of Object.entries(value)){
  if(authorityFields.has(key)) requireValue(v===false,`Source authority escalation: ${key}`);
  if(key==='authority'&&typeof v==='string') requireValue(v==='none','Source authority must remain none');
  rejectAuthority(v);
 }
}
export function assertContextRecords(input: unknown): void {
 const x=input as any; rejectAuthority(x);
 requireValue(x&&Array.isArray(x.records)&&Array.isArray(x.sources),'Missing source context records');
 const keys=new Set(x.records.map((r:any)=>r.key)), sources=new Set(x.sources.map((s:any)=>s.sourceKey));
 requireValue(keys.size===x.records.length&&sources.size===x.sources.length,'Duplicate context identity');
 for(const r of x.records){
  requireValue(r.sourceKeys?.length>0&&r.sourceKeys.every((k:string)=>sources.has(k)),`Dangling context source: ${r.key}`);
  for(const link of r.links??[]) requireValue(keys.has(link.targetKey),`Dangling context link: ${r.key}`);
  if(r.basis==='assistant_report')requireValue(['reported','superseded','historical'].includes(r.status),`Report promotion: ${r.key}`);
  if(r.basis==='user_hypothesis')requireValue(['open_to_revision','proposed'].includes(r.status),`Hypothesis promotion: ${r.key}`);
  if(r.basis==='observed_source_snapshot')requireValue(['observed','superseded','historical'].includes(r.status),`Observation promotion: ${r.key}`);
  if(['assistant_interpretation','assistant_proposal'].includes(r.basis)) requireValue(['proposed','superseded','historical','held'].includes(r.status),`Proposal promotion: ${r.key}`);
 }
 const record=(key:string)=>x.records.find((r:any)=>r.key===key);
 requireValue(record('math-ontology-worked-example-24-times-3')?.status==='proposed','Illustrative example cannot be accepted');
 requireValue(record('math-exam-context')?.assessmentFacts?.questionCount===24,'Assessment context missing');
}
function assertPilot(x:any):void {
 rejectAuthority(x); requireValue(x?.semanticOwner==='math-research-module'&&x.registryScope==='module-local-pilot','Foreign research identity');
 requireValue(x.coverage?.realLearnersDiagnosed===0,'Synthetic pilot cannot diagnose learners');
 const revisions=new Map((x.revisions??[]).map((r:any)=>[`${r.id}@${r.version}`,r]));
 requireValue(revisions.size===x.revisions?.length,'Duplicate research revision');
 const ref=(r:any)=>{requireValue(r&&revisions.has(`${r.id}@${r.version}`),'Dangling research revision');};
 for(const r of x.revisions){
  requireValue(['DATA','LOGIC','ACTION','GOVERNANCE'].includes(r.layer),'Invalid research layer');
  for(const name of ['sourceRefs','evidenceRefs','targetRefs','probeRefs']) for(const target of r.core[name]??[]) ref(target);
  if(r.type==='acceptance_record') requireValue(r.core.epistemicStatus==='pending','Proposal acceptance escalation');
  if(r.type==='source_claim') requireValue(r.core.epistemicStatus==='reported','Source claim promotion');
  if(r.type.endsWith('_hypothesis')) requireValue(r.core.epistemicStatus==='hypothesis','Hypothesis promotion');
 }
 for(const edge of x.edges??[]){ref(edge.from);ref(edge.to);}
 for(const p of x.presentations??[]) ref(p.subject);
 for(const c of x.crosswalk??[]){ref(c.research);requireValue(!['acceptedBy','verifiedBy'].includes(c.relation),'Unqualified research acceptance/verification');}
}
export function assertProjection(input: unknown): asserts input is Projection {
 const p=input as Projection; requireValue(p?.schema==='month-end.research-projection.v1'&&p.owner==='math-research-module'&&p.revision===SOURCE_REVISION,'Unpinned research projection');
 rejectAuthority(p); requireValue(p.authority?.nativePermissionGranted===false&&p.authority.actualAcceptanceInferred===false&&p.authority.grantsExecution===false,'Missing authority boundary');
 const manifest=new Map(p.manifest.map(f=>[f.path,f.sha256])); requireValue(manifest.size===238,'Expected238 original repository blobs');
 const source=(s:SourceRef)=>requireValue(s.owner===p.owner&&s.revision===p.revision&&manifest.get(s.path)===s.sha256&&s.pointer.startsWith('/'),'Unqualified source reference');
 const contentIds=new Set(p.contentObjects.map(c=>c.id));
 const capabilities=new Set((p.capabilityResearch.abilities as any[]).map(c=>c.id));
 const units=new Map(p.units.map(u=>[u.id,u])), types=new Set(p.types.map(t=>t.id)), sources=new Set(p.sources.map(s=>s.id));
 requireValue(units.size===p.units.length&&types.size===p.types.length,'Duplicate domain identity');
 for(const u of p.units){source(u.source);if(u.parentId) requireValue(units.has(u.parentId),'Dangling hierarchy parent');
  const seen=new Set<string>(); let n:typeof u|undefined=u; while(n){requireValue(!seen.has(n.id),'Hierarchy cycle');seen.add(n.id);n=n.parentId?units.get(n.parentId):undefined;}
 }
 for(const t of p.types){source(t.source);requireValue(units.has(t.detailId),'Dangling type membership');for(const e of t.examples){source(e.source);requireValue(e.typeId===t.id&&typeof e.prompt==='string'&&typeof e.answer==='string','Invalid original example');}}
 requireValue(new Set(p.designs.map(d=>d.typeId)).size===151,'Design identity duplication');
 for(const d of p.designs){source(d.source);requireValue(types.has(d.typeId),'Dangling design');requireValue(d.original.status==='paradigmatic_design_intent_unvalidated'&&d.original.learningEffectClaim==='hypothesis_not_observed','Research design promotion');for(const a of d.microsteps){source(a.source);requireValue(a.typeId===d.typeId,'Foreign action membership');}}
 for(const l of p.links){source(l.source);requireValue(units.has(l.from)||types.has(l.from)||contentIds.has(l.from),'Dangling relation source');requireValue(units.has(l.to)||types.has(l.to)||sources.has(l.to)||contentIds.has(l.to)||capabilities.has(l.to),'Dangling relation target');}
 for(const w of p.warnings){source(w.source);requireValue(w.status==='proposed_not_applied'&&types.has(w.typeId),'Correction promotion');}
 const actual={grade3Types:p.types.filter(t=>t.scope==='grade3').length,upperTypes:p.types.filter(t=>t.scope==='upper').length,basicExamples:p.types.reduce((n,t)=>n+t.examples.filter(e=>e.kind==='basic').length,0),variantExamples:p.types.reduce((n,t)=>n+t.examples.filter(e=>e.kind==='variant').length,0),designs:p.designs.length,microsteps:p.designs.reduce((n,d)=>n+d.microsteps.length,0),archiveBlobs:p.manifest.filter(f=>f.path.startsWith('source/archive/')).length};
 requireValue(JSON.stringify(actual)===JSON.stringify(p.coverage),'Coverage discrepancy');
 requireValue(actual.grade3Types===105&&actual.upperTypes===46&&actual.basicExamples===151&&actual.variantExamples===19&&actual.microsteps===1216&&actual.archiveBlobs===109,'Unexpected research scope');
 assertContextRecords(p.assessmentResearch);assertPilot(p.identityPilot);
}
export function exactKeys(x:unknown,keys:readonly string[]):void {requireValue(!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k)),'Unknown input field');}
export const AXES=['structure','reasoning','representation','conditions','errors','transfer'] as const;
export function assertStudyScope(x:StudyScope,p:Projection):void {exactKeys(x,['researchTypeIds','researchRevision','edition','unit']);requireValue(x&&Array.isArray(x.researchTypeIds)&&x.researchTypeIds.length<=12&&new Set(x.researchTypeIds).size===x.researchTypeIds.length,'Choose0–12 distinct research types');requireValue(x.researchRevision===p.revision&&x.researchTypeIds.every(id=>p.types.some(t=>t.id===id)),'Unknown research version or type');for(const v of [x.edition,x.unit])requireValue(v===null||typeof v==='string'&&v.length<=200,'Invalid edition/unit');}
export function assertIntent(x:DesiredQuestionIntent):void {exactKeys(x,['axes','notes']);requireValue(x&&x.axes&&typeof x.notes==='string'&&x.notes.length<=2000,'Invalid desired intent');requireValue(Object.keys(x.axes).sort().join()=== [...AXES].sort().join(),'Exact comparison axes required');for(const axis of AXES)requireValue(typeof x.axes[axis]==='string'&&x.axes[axis].length<=1000,'Invalid comparison axis');requireValue(AXES.some(a=>x.axes[a].trim()),'Declare a desired question feature');}
export const equal=(a:unknown,b:unknown):boolean=>stable(a)===stable(b);
function stable(x:unknown):string {if(Array.isArray(x))return `[${x.map(stable).join(',')}]`;if(x&&typeof x==='object')return `{${Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable((x as any)[k])).join(',')}}`;return JSON.stringify(x);}
export function assertStudy(x:StudyReport,p:Projection):void {exactKeys(x,['scope','studied','summary','evidenceNotes','attribution','acceptance']);requireValue(x&&x.attribution==='teacher-reported'&&x.acceptance===false&&x.studied===true,'Study must be explicit teacher report, not acceptance');assertStudyScope(x.scope,p);requireValue(x.scope.researchTypeIds.length>0,'Study report requires at least one selected research type');requireValue(typeof x.summary==='string'&&x.summary.trim().length>0&&x.summary.length<=4000&&Array.isArray(x.evidenceNotes)&&x.evidenceNotes.length<=12&&x.evidenceNotes.every(n=>typeof n==='string'&&n.length<=1000),'Invalid teacher study report');}
export function assertSourceContext(x:SourceContext):void {exactKeys(x,['owner','sourceRevision','scopeId','edition','unit','observationHash','sourceHandle','observedAt','revisionMeaning']);requireValue(x&&typeof x.owner==='string'&&/^(academy|synthetic)([-:][a-z0-9-]+)*$/.test(x.owner)&&typeof x.sourceRevision==='string'&&x.sourceRevision.length>0&&x.sourceRevision.length<=256&&typeof x.scopeId==='string'&&x.scopeId.length>0&&x.scopeId.length<=256,'Unqualified Academy source context');for(const v of [x.edition,x.unit])requireValue(v===null||typeof v==='string'&&v.length<=200,'Invalid Academy scope');}
