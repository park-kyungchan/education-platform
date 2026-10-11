import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hermesBackendProfile } from '../docs/hermes-backend-profile';
import { profileOntologyRefactorPlan } from '../docs/profile-ontology-refactor-plan';
import { teacherOntologyDeliveryPlan } from '../docs/teacher-ontology-delivery-plan';
import { validateAcademyOperationalContract, OPERATIONAL_CONTRACT_REVISION, operationalContractShape } from '../src/academy/operationalContract';
import { scanPublicationText } from './tools/prepush_audit';
import { contextSourcePaths, readCurrentContextSource } from './context_routing';
import {fileURLToPath} from 'node:url';
import { validateRepositoryBindings, type RepositoryBinding } from './repository_bindings';
function loadRepositoryBindings(){
const repositoryBindingsBytes=readCurrentContextSource(fileURLToPath(new URL('../',import.meta.url)),'repository_bindings');
const repositoryBindings=validateRepositoryBindings(JSON.parse(repositoryBindingsBytes.toString('utf8')));
const repositoryObservationBytes=readCurrentContextSource(fileURLToPath(new URL('../',import.meta.url)),'repository_observation');
const repositoryObservationHash=createHash('sha256').update(repositoryObservationBytes).digest('hex');
const repositoryObservation=JSON.parse(repositoryObservationBytes.toString('utf8'));
if(repositoryObservation.kind!=='repository_source_observation'||repositoryObservation.authority!=='none'||repositoryBindings.bindings.some(binding=>binding.evidenceRef!=='docs/repository-source-observation.json'||binding.evidenceSha256!==repositoryObservationHash||!repositoryObservation.repositories?.some((observed:Record<string,unknown>)=>['repositoryId','root','commit','sourceKind','contentState','observedAtUtc'].every(k=>observed[k]===binding[k as keyof RepositoryBinding]))))throw Error('repository_observation_mismatch');
return {repositoryBindings,hashes:{repository_bindings:createHash('sha256').update(repositoryBindingsBytes).digest('hex'),repository_observation:repositoryObservationHash}};
}
import type { WorkflowCheckpoint } from './workflow_checkpoint';
import type { entryReadPlan } from './context_routing';

const units = [...profileOntologyRefactorPlan.deliveryUnits,...teacherOntologyDeliveryPlan.systemRefactor.priorities] as const;
type Programme='profile_ontology_refactor'|'teacher_product_delivery';
const programmeUnitIds=(programme:unknown):string[]=>programme==='profile_ontology_refactor'?profileOntologyRefactorPlan.deliveryUnits.map(u=>u.id):programme==='teacher_product_delivery'?teacherOntologyDeliveryPlan.systemRefactor.priorities.map(u=>u.id):[];
// Bind imported TS values to their actual source checkout, not a supplied hash claim.
const importedSourceHashes={
  backend_profile:createHash('sha256').update(readFileSync(new URL('../docs/hermes-backend-profile.ts',import.meta.url))).digest('hex'),
  profile_ontology_plan:createHash('sha256').update(readFileSync(new URL('../docs/profile-ontology-refactor-plan.ts',import.meta.url))).digest('hex'),
  teacher_delivery_plan:createHash('sha256').update(readFileSync(new URL('../docs/teacher-ontology-delivery-plan.ts',import.meta.url))).digest('hex'),
};
export type ProgrammeUnit = typeof units[number]['id'];
export interface CurrentWorkSelection {
  schemaVersion: 1;
  programme: Programme;
  unit: ProgrammeUnit;
  state: 'in_progress' | 'complete';
  ownerProfile: 'dc-gang-a-dev';
  scope: 'source_only';
  acceptedUnits: ProgrammeUnit[];
  operationalRevision: string;
  selectionRevision: string;
  resumePriorAssignments: false;
}
function refusal(code: string): never { throw new Error(code); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(d => !Object.hasOwn(d, 'value'))) refusal('invalid_atomic_context');
  return value as Record<string, unknown>;
}
function keys(value: unknown, names: readonly string[]): Record<string, unknown> {
  const r=record(value);
  if (Object.keys(r).length!==names.length || names.some(k=>!Object.hasOwn(r,k))) refusal('invalid_atomic_context');
  return r;
}
const boundedText=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=800&&!/[\u0000-\u001f]/.test(v)&&scanPublicationText('context.json',v).length===0;
const strings=(v:unknown,max=64):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(boundedText)&&new Set(v).size===v.length;
const unitIds:string[]=units.map(u=>u.id);

/** A checkpoint selection is user-owned Work metadata, never native execution or effect admission. */
export function validateCurrentWorkSelection(value:unknown):CurrentWorkSelection {
  const r=keys(value,['schemaVersion','programme','unit','state','ownerProfile','scope','acceptedUnits','operationalRevision','selectionRevision','resumePriorAssignments']);
  const allowedUnits=programmeUnitIds(r.programme);
  if(r.ownerProfile!==hermesBackendProfile.profile)refusal('foreign_context_owner');
  if(r.schemaVersion!==1||typeof r.unit!=='string'||!allowedUnits.includes(r.unit)
    ||typeof r.state!=='string'||!['in_progress','complete'].includes(r.state)||r.scope!=='source_only'||r.resumePriorAssignments!==false
    ||!strings(r.acceptedUnits,allowedUnits.length)||!r.acceptedUnits.every(id=>allowedUnits.includes(id))
    ||!boundedText(r.operationalRevision)||!boundedText(r.selectionRevision))refusal('invalid_current_work_selection');
  const selected=allowedUnits.indexOf(String(r.unit));
  if(r.acceptedUnits.some(id=>allowedUnits.indexOf(id)>=selected))refusal('conflicting_work_acceptance');
  return structuredClone(r) as unknown as CurrentWorkSelection;
}

const sourcePaths={repository_bindings:contextSourcePaths.repository_bindings,engineering_checkpoint:contextSourcePaths.engineering_checkpoint,operational_contract:contextSourcePaths.operational_contract,backend_profile:contextSourcePaths.backend_profile,profile_ontology_plan:contextSourcePaths.profile_ontology_plan,teacher_delivery_plan:contextSourcePaths.teacher_delivery_plan} as const;
type SourceId=keyof typeof sourcePaths;
type SourceReference={id:SourceId;path:string;selector:string;revision:string;sha256:string};
type AtomBase={id:string;source:SourceReference;assertionClass:'current_contract'|'user_interview'|'current_user_request'|'lead_checkpoint'|'derived';state:'current'|'historical'|'superseded'|'unknown'};
type WorkIntent={programme:Programme;unit:ProgrammeUnit;goal:string;scope:'source_only';stage:CurrentWorkSelection['state'];checkpointObjective:string;checkpointUpdatedAt:string};
type ProductContract=typeof operationalContractShape.product;
type TeacherPurpose={primarySurface:ProductContract['primaryTeacherSurface'];unitOfPreparation:ProductContract['classroomOutcome']['unitOfPreparation'];nextDecision:ProductContract['classroomOutcome']['nextDecision'];historyTopology:ProductContract['studentStorageTopology'];teacherReserved:typeof operationalContractShape.teacherReserved};
type DecisionEvidence={decisionId:string;statement:string;origin:'user_interview'|'current_user_request'};
type UnresolvedQuestion={questionId:string;question:string;dependentWork:string;askedState:'not_asked'|'awaiting_answer'};
type SelectionLogic={selectorRevision:string;unknownBehavior:'explicit_or_refuse';dependencyOrdering:'depends_on_only';implementationRef:'harness/atomic_context.ts';sourceIdentity:'owner_scope_provenance_before_date'};
type WorkStep={unit:ProgrammeUnit;status:'selected'|'prerequisite_accepted'|'prerequisite_unverified';dependsOn:readonly string[];targetRefs:readonly string[];effectCeiling:readonly ['repo_read','repo_edit','synthetic_test'];needsFreshNativeAdmission:true};
type EffectBoundary={profile:'dc-gang-a-dev';nativeOwner:'Hermes';sourceTransport:typeof operationalContractShape.sourceAccess.requiredTransport;sourceQualification:typeof operationalContractShape.sourceAccess.directClientQualification;teacherReserved:typeof operationalContractShape.teacherReserved;currentEffectAuthority:typeof operationalContractShape.authority.effectAuthorityOwner;priorBudgets:'not_renewed';nativeAuthorityVerified:false;officialEffects:'not_admitted';unknownNativeModel:null;unknownNativeCapacity:null};
export type ContextAtom=AtomBase & (
  {dimension:'DATA';kind:'repository_binding';value:RepositoryBinding}|
  {dimension:'DATA';kind:'work_intent';value:WorkIntent}|
  {dimension:'DATA';kind:'teacher_purpose';value:TeacherPurpose}|
  {dimension:'DATA';kind:'decision_evidence';value:DecisionEvidence}|
  {dimension:'DATA';kind:'unresolved_question';value:UnresolvedQuestion}|
  {dimension:'LOGIC';kind:'selection_logic';value:SelectionLogic}|
  {dimension:'ACTION';kind:'work_step';value:WorkStep}|
  {dimension:'GOVERNANCE';kind:'effect_boundary';value:EffectBoundary}
);
export interface ContextRelation {from:string;to:string;kind:'part_of'|'depends_on'|'supported_by'|'consumes'|'supersedes'|'feedback'}

/** Only the dependency subgraph defines execution order. Feedback is not a dependency. */
export function dependencyOrder(nodes:readonly {id:string;dimension:string}[], rawRelations:unknown):string[] {
  if(nodes.length>128||new Set(nodes.map(n=>n.id)).size!==nodes.length||nodes.some(n=>!boundedText(n.id)||typeof n.dimension!=='string'||!['DATA','LOGIC','ACTION','GOVERNANCE'].includes(n.dimension)))refusal('invalid_context_nodes');
  if(!Array.isArray(rawRelations)||rawRelations.length>256)refusal('invalid_context_relations');
  const ids=new Set(nodes.map(n=>n.id)), actions=new Set(nodes.filter(n=>n.dimension==='ACTION').map(n=>n.id));
  const dependencies=new Map([...actions].map(id=>[id,[] as string[]]));const seen=new Set<string>();
  for(const input of rawRelations){
    const r=keys(input,['from','to','kind']);
    if(typeof r.from!=='string'||typeof r.to!=='string'||!ids.has(r.from)||!ids.has(r.to)
      ||typeof r.kind!=='string'||!['part_of','depends_on','supported_by','consumes','supersedes','feedback'].includes(r.kind))refusal('invalid_context_relation');
    const key=JSON.stringify([r.kind,r.from,r.to]);if(seen.has(key))refusal('duplicate_context_relation');seen.add(key);
    if(r.kind==='depends_on'){
      if(!actions.has(r.from)||!actions.has(r.to))refusal('dependency_requires_actions');
      dependencies.get(r.from)!.push(r.to);
    }
  }
  const active=new Set<string>(),complete=new Set<string>(),order:string[]=[];
  function visit(id:string){if(active.has(id))refusal('cyclic_context_dependencies');if(complete.has(id))return;active.add(id);for(const dep of dependencies.get(id)!)visit(dep);active.delete(id);complete.add(id);order.push(id);}
  for(const id of actions)visit(id);
  return order;
}

/** Strict egress validation prevents generic payload bags or effect-bearing claims. */
export function validateContextAtoms(value:unknown):ContextAtom[] {
  const {repositoryBindings}=loadRepositoryBindings();
  if(!Array.isArray(value)||value.length===0||value.length>128)refusal('invalid_context_atoms');
  const dimensions:Record<string,string>={repository_binding:'DATA',work_intent:'DATA',teacher_purpose:'DATA',decision_evidence:'DATA',unresolved_question:'DATA',selection_logic:'LOGIC',work_step:'ACTION',effect_boundary:'GOVERNANCE'};
  const fields:Record<string,string[]>={
    repository_binding:['repositoryId','sourceKind','root','commit','contentState','writePolicy','revisionMeaning','observedAtUtc','evidenceRef','evidenceSha256'],
    work_intent:['programme','unit','goal','scope','stage','checkpointObjective','checkpointUpdatedAt'],
    teacher_purpose:['primarySurface','unitOfPreparation','nextDecision','historyTopology','teacherReserved'],
    decision_evidence:['decisionId','statement','origin'],
    unresolved_question:['questionId','question','dependentWork','askedState'],
    selection_logic:['selectorRevision','unknownBehavior','dependencyOrdering','implementationRef','sourceIdentity'],
    work_step:['unit','status','dependsOn','targetRefs','effectCeiling','needsFreshNativeAdmission'],
    effect_boundary:['profile','nativeOwner','sourceTransport','sourceQualification','teacherReserved','currentEffectAuthority','priorBudgets','nativeAuthorityVerified','officialEffects','unknownNativeModel','unknownNativeCapacity'],
  };
  for(const item of value){
    const a=keys(item,['id','source','assertionClass','state','dimension','kind','value']);
    if(!boundedText(a.id)||typeof a.kind!=='string'||!Object.hasOwn(dimensions,a.kind)||a.dimension!==dimensions[a.kind]
      ||typeof a.assertionClass!=='string'||!['current_contract','user_interview','current_user_request','lead_checkpoint','derived'].includes(a.assertionClass)
      ||typeof a.state!=='string'||!['current','historical','superseded','unknown'].includes(a.state))refusal('invalid_context_atom');
    const source=keys(a.source,['id','path','selector','revision','sha256']);
    if(typeof source.id!=='string'||!Object.hasOwn(sourcePaths,source.id)
      ||source.path!==sourcePaths[source.id as SourceId]
      ||!boundedText(source.selector)||!boundedText(source.revision)||typeof source.sha256!=='string'||! /^[a-f0-9]{64}$/.test(source.sha256))refusal('invalid_atom_source');
    const v=keys(a.value,fields[a.kind]!);
    // Every text/array is bounded even on an attributed original; values never become tool instructions.
    for(const [key,field] of Object.entries(v)){
      if(['unknownNativeModel','unknownNativeCapacity'].includes(key)){if(field!==null)refusal('invalid_atom_value');}
      else if(['needsFreshNativeAdmission','nativeAuthorityVerified'].includes(key)){if(typeof field!=='boolean')refusal('invalid_atom_value');}
      else if(['teacherReserved','dependsOn','targetRefs','effectCeiling'].includes(key)){if(!strings(field))refusal('invalid_atom_value');}
      else if(!boundedText(field))refusal('invalid_atom_value');
    }
    if(a.kind==='repository_binding'){const expected=repositoryBindings.bindings.find(b=>b.repositoryId===v.repositoryId);if(!expected||JSON.stringify(v)!==JSON.stringify(expected)||source.id!=='repository_bindings')refusal('conflicting_repository_binding');}
    if(a.kind==='work_intent'&&(v.scope!=='source_only'||!['in_progress','complete'].includes(String(v.stage))||!programmeUnitIds(v.programme).includes(String(v.unit))||!Number.isFinite(Date.parse(String(v.checkpointUpdatedAt)))))refusal('invalid_work_intent');
    if(a.kind==='decision_evidence'&&!['user_interview','current_user_request'].includes(String(v.origin)))refusal('invalid_decision_origin');
    const assertion=a.kind==='decision_evidence'?v.origin:['selection_logic','work_intent','work_step'].includes(a.kind)?'derived':['teacher_purpose','effect_boundary','repository_binding'].includes(a.kind)?'current_contract':'lead_checkpoint';
    if(a.assertionClass!==assertion)refusal('invalid_atom_assertion');
    if(a.kind==='teacher_purpose'){
      const p=operationalContractShape.product;
      if(v.primarySurface!==p.primaryTeacherSurface||v.unitOfPreparation!==p.classroomOutcome.unitOfPreparation||v.nextDecision!==p.classroomOutcome.nextDecision||v.historyTopology!==p.studentStorageTopology||JSON.stringify(v.teacherReserved)!==JSON.stringify(operationalContractShape.teacherReserved))refusal('conflicting_teacher_purpose');
    }
    if(a.kind==='unresolved_question'&&!['not_asked','awaiting_answer'].includes(String(v.askedState)))refusal('invalid_question_state');
    if(a.kind==='selection_logic'&&(v.unknownBehavior!=='explicit_or_refuse'||v.dependencyOrdering!=='depends_on_only'||v.implementationRef!=='harness/atomic_context.ts'||v.sourceIdentity!=='owner_scope_provenance_before_date'))refusal('invalid_selection_logic');
    if(a.kind==='work_step'&&(!unitIds.includes(String(v.unit))||!['selected','prerequisite_accepted','prerequisite_unverified'].includes(String(v.status))||v.needsFreshNativeAdmission!==true||JSON.stringify(v.effectCeiling)!==JSON.stringify(['repo_read','repo_edit','synthetic_test'])))refusal('invalid_action_boundary');
    if(a.kind==='work_step'){
      const unit=units.find(u=>u.id===v.unit)!;
      if(JSON.stringify(v.targetRefs)!==JSON.stringify(unit.targets)||JSON.stringify(v.dependsOn)!==JSON.stringify(unit.dependsOn))refusal('conflicting_action_scope');
    }
    if(a.kind==='effect_boundary'&&(v.profile!=='dc-gang-a-dev'||v.nativeOwner!=='Hermes'||v.priorBudgets!=='not_renewed'||v.nativeAuthorityVerified!==false||v.officialEffects!=='not_admitted'||v.unknownNativeModel!==null||v.unknownNativeCapacity!==null))refusal('invalid_effect_boundary');
    if(a.kind==='effect_boundary'&&(v.sourceTransport!==operationalContractShape.sourceAccess.requiredTransport||v.sourceQualification!==operationalContractShape.sourceAccess.directClientQualification||v.currentEffectAuthority!==operationalContractShape.authority.effectAuthorityOwner||JSON.stringify(v.teacherReserved)!==JSON.stringify(operationalContractShape.teacherReserved)))refusal('conflicting_effect_policy');
  }
  if(new Set(value.map(a=>a.id)).size!==value.length)refusal('duplicate_context_atom');
  const intents=value.filter(a=>a.kind==='work_intent');
  if(intents.length!==1||value.some(a=>a.kind==='work_step'&&!programmeUnitIds(intents[0].value.programme).includes(a.value.unit)))refusal('conflicting_work_programme');
  if(['DATA','LOGIC','ACTION','GOVERNANCE'].some(d=>!value.some(a=>a.dimension===d)))refusal('incomplete_context_dimensions');
  return structuredClone(value) as ContextAtom[];
}

type ReadPlan=ReturnType<typeof entryReadPlan>;
export function selectAtomicContext(checkpoint:WorkflowCheckpoint, rawOperational:unknown, readPlan:ReadPlan,
  now=new Date(), expectedRevision?:string) {
  const e=checkpoint.engineeringContext;
  if(!e?.currentWork)refusal('current_work_selection_required');
  const w=validateCurrentWorkSelection(e.currentWork), selection=hermesBackendProfile.contextSelection;
  const contract=validateAcademyOperationalContract(rawOperational);
  if(w.operationalRevision!==contract.revision||contract.revision!==OPERATIONAL_CONTRACT_REVISION||w.selectionRevision!==selection.revision)refusal('stale_context_basis');
  if(readPlan.view!=='current'||!readPlan.ok)refusal('current_sources_unavailable');
  const {repositoryBindings,hashes:repositoryHashes}=loadRepositoryBindings();
  for(const [id,sha256] of Object.entries({...importedSourceHashes,...repositoryHashes})){
    if(readPlan.requiredReads.find(r=>r.id===id)?.sha256!==sha256)refusal('context_contract_source_mismatch');
  }
  if(!Number.isFinite(now.getTime())||Date.parse(e.updatedAtUtc)>now.getTime())refusal('future_context_basis');
  const purpose=readPlan.purpose;
  const source=(id:SourceId,selector:string,revision:string):SourceReference=>{
    const r=readPlan.requiredReads.find(r=>r.id===id);
    if(!r?.sha256||r.status!=='verified_file_presence_and_hash')refusal('current_sources_unavailable');
    return {id,path:r.path,selector,revision,sha256:r.sha256};
  };
  const checkpointSource=(selector:string)=>source('engineering_checkpoint',selector,e.updatedAtUtc);
  const policySource=(selector:string)=>source('operational_contract',selector,contract.revision);
  const productWork=w.programme==='teacher_product_delivery';
  const planSource=(selector:string)=>source(productWork?'teacher_delivery_plan':'profile_ontology_plan',selector,productWork?teacherOntologyDeliveryPlan.systemRefactor.revision:profileOntologyRefactorPlan.revision);
  const programmeGoal=productWork?teacherOntologyDeliveryPlan.systemRefactor.goal:profileOntologyRefactorPlan.northStar;
  const unit=units.find(u=>u.id===w.unit)!;
  const atoms:ContextAtom[]=[
    {id:'data.work_intent',dimension:'DATA',kind:'work_intent',state:'current',assertionClass:'derived',source:checkpointSource('/engineeringContext'),value:{programme:w.programme,unit:w.unit,goal:programmeGoal,scope:w.scope,stage:w.state,checkpointObjective:e.objective,checkpointUpdatedAt:e.updatedAtUtc}},
    {id:'data.teacher_purpose',dimension:'DATA',kind:'teacher_purpose',state:'current',assertionClass:'current_contract',source:policySource('/'),value:{primarySurface:contract.product.primaryTeacherSurface,unitOfPreparation:contract.product.classroomOutcome.unitOfPreparation,nextDecision:contract.product.classroomOutcome.nextDecision,historyTopology:contract.product.studentStorageTopology,teacherReserved:contract.teacherReserved}},
    {id:'logic.selection',dimension:'LOGIC',kind:'selection_logic',state:'current',assertionClass:'derived',source:source('backend_profile','contextSelection',selection.revision),value:{selectorRevision:selection.revision,unknownBehavior:'explicit_or_refuse',dependencyOrdering:'depends_on_only',implementationRef:'harness/atomic_context.ts',sourceIdentity:'owner_scope_provenance_before_date'}},
    {id:'governance.effects',dimension:'GOVERNANCE',kind:'effect_boundary',state:'current',assertionClass:'current_contract',source:policySource('/'),value:{profile:contract.roles.academyOwner,nativeOwner:contract.roles.nativeIdentityAndLifecycleOwner,sourceTransport:contract.sourceAccess.requiredTransport,sourceQualification:contract.sourceAccess.directClientQualification,teacherReserved:contract.teacherReserved,currentEffectAuthority:contract.authority.effectAuthorityOwner,priorBudgets:'not_renewed',nativeAuthorityVerified:false,officialEffects:'not_admitted',unknownNativeModel:null,unknownNativeCapacity:null}},
  ];
  for(const binding of repositoryBindings.bindings)atoms.push({id:'repository.'+binding.repositoryId.replace('/','.'),dimension:'DATA',kind:'repository_binding',state:'current',assertionClass:'current_contract',source:source('repository_bindings','bindings/'+binding.repositoryId,selection.revision),value:binding});
  const currentIds=[...new Set<string>([...selection.commonDecisionIds,...selection.purposeDecisionIds[purpose]])];
  const historicalIds:readonly string[]=selection.historicalDecisionIds,supersededIds:readonly string[]=selection.supersededDecisionIds;
  if(currentIds.some(id=>historicalIds.includes(id)||supersededIds.includes(id)))refusal('conflicting_decision_selection');
  for(const id of currentIds){
    const decision=e.confirmedDecisions.find(d=>d.id===id);if(!decision)refusal('selected_decision_missing');
    atoms.push({id:'decision.'+id,dimension:'DATA',kind:'decision_evidence',state:'current',assertionClass:decision.source,source:checkpointSource('/engineeringContext/confirmedDecisions/'+id),value:{decisionId:id,statement:decision.statement,origin:decision.source}});
  }
  const questionWork:readonly string[]=selection.purposeQuestionWork[purpose];
  const questions=e.pendingInterview.filter(q=>questionWork.includes(q.dependentWork));
  for(const q of questions)atoms.push({id:'question.'+q.id,dimension:'DATA',kind:'unresolved_question',state:'unknown',assertionClass:'lead_checkpoint',source:checkpointSource('/engineeringContext/pendingInterview/'+q.id),value:{questionId:q.id,question:q.question,dependentWork:q.dependentWork,askedState:q.state}});
  const relations:ContextRelation[]=[];
  for(const binding of repositoryBindings.bindings)relations.push({from:'data.work_intent',to:'repository.'+binding.repositoryId.replace('/','.'),kind:'consumes'});
  const closure=new Set<ProgrammeUnit>();
  function include(id:ProgrammeUnit){if(closure.has(id))return;closure.add(id);const u=units.find(u=>u.id===id)!;for(const dep of u.dependsOn)include(dep);}
  include(w.unit);
  for(const id of closure){
    const u=units.find(u=>u.id===id)!;const selected=id===w.unit,accepted=w.acceptedUnits.includes(id);
    atoms.push({id:'action.'+id,dimension:'ACTION',kind:'work_step',state:selected||accepted?'current':'unknown',assertionClass:'derived',source:planSource((productWork?'systemRefactor/priorities/':'deliveryUnits/')+id),value:{unit:id,status:selected?'selected':accepted?'prerequisite_accepted':'prerequisite_unverified',dependsOn:u.dependsOn,targetRefs:u.targets,effectCeiling:['repo_read','repo_edit','synthetic_test'],needsFreshNativeAdmission:true}});
    relations.push({from:'action.'+id,to:'data.work_intent',kind:'part_of'},{from:'action.'+id,to:'governance.effects',kind:'consumes'});
    for(const dependency of u.dependsOn)relations.push({from:'action.'+id,to:'action.'+dependency,kind:'depends_on'});
  }
  for(const id of currentIds)relations.push({from:'data.work_intent',to:'decision.'+id,kind:'supported_by'});
  relations.push({from:'action.'+w.unit,to:'logic.selection',kind:'consumes'});
  const validated=validateContextAtoms(atoms);
  const order=dependencyOrder(validated,relations);
  const revision=createHash('sha256').update(JSON.stringify({purpose,atoms:validated,relations})).digest('hex');
  if(expectedRevision!==undefined&&expectedRevision!==revision)refusal('stale_selected_context');
  return {
    schemaVersion:1 as const,kind:'selected_atomic_workflow_context' as const,canonicalCheckpoint:'handoffs/workflow-current-state.json',purpose,revision,
    contextState:e.updatedAtUtc.slice(0,10)===now.toISOString().slice(0,10)?'same_day_revalidate_at_effect':'historical_checkpoint_revalidate_before_effect',
    atoms:validated,relations,dependencyOrder:order,fieldProjectionsEmitted:true as const,
    prerequisiteStatus:unit.dependsOn.every(id=>w.acceptedUnits.includes(id))?'recorded_prerequisites_satisfied_not_admission':'unverified_prerequisites',
    provenance:{selectionOwner:'docs/hermes-backend-profile.ts',programmeGoal:planSource(productWork?'systemRefactor/goal':'northStar'),workState:checkpointSource('/engineeringContext/currentWork'),mixedRecordRule:'Derived work intent combines programmeGoal and checkpoint fields; derived action status uses workState while targets and dependencies use the primary plan source.',originalsRetained:[...selection.originals],originalBodiesLoaded:false,
      unselectedDecisions:e.confirmedDecisions.filter(d=>!currentIds.includes(d.id)).map(d=>({id:d.id,state:supersededIds.includes(d.id)?'superseded':historicalIds.includes(d.id)?'historical':'not_selected_for_purpose'})),
      unselectedQuestionIds:e.pendingInterview.filter(q=>!questions.includes(q)).map(q=>q.id),
      historicalOperationalEvidence:{path:'handoffs/workflow-current-state.json',asOf:checkpoint.observedAtUtc,meaning:'not_current_access_or_permission'},
      legacyCommand:'bun run workflow:context '+purpose+' --legacy'},
    unknowns:{nativeExecutionAuthority:'not_queried',sourceAuthentication:'not_qualified_by_contract',independentRecovery:contract.product.independentRecoveryStatus,teacherAcceptance:'not_established',assumptions:structuredClone(e.assumptions)},
    entryReadPlan:structuredClone(readPlan),
    executesNextStep:false as const,authorizesProductionEffects:false as const,automaticPerTurnInjectionInstalled:false as const,
  };
}
