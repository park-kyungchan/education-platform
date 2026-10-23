/** Reusable TypeScript/Bun migration. No network or source access is performed.
 * The original one-time Python validation is retained in the audit history.
 * Usage: bun refine-homework-evidence-1.3.0.ts --out-dir ./verification-output
 * Optional: --base-dir ./data --verify-against ./published-data
 * Published inputs are never overwritten by this script. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
type LegacyPlan = Record<string, any>; // Existing versioned JSON; preserved byte-semantically.
type Scope = {studentId:string;entityIds:string[];fields:string[];window:null|{from:string|null;to:string|null;labelRaw:string|null}};
type Claim = {type:string;value:Json};
type EvidenceRecord = {
 sourceKind:'user_report';actor:{kind:'user';role:'teacher';id:null};
 sourceRef:{sourceMessageId:string;reference:string;sha256:string;jsonPointer:string};
 reportedAt:string;observedAt:null;capturedAt:null;recordedAt:string;timeRaw:string|null;
 verificationStatus:'unverified';verificationDetail:'not_independently_verified';
 statementProvenance:{confirmed:true;sourceMessageId:string};scope:Scope;claim:Claim;
 revision:1;supersedesEvidenceIds:string[];retractsEvidenceIds:string[];conflictingEvidenceIds:string[];
 evidenceId?:string;
};
type DecisionRecord = {decisionId:string;studentId:string;targetEntityIds:string[];evidenceIds:string[];ruleVersion:string;decisionStatus:'pending';decisionAuthority:{actorKind:'assistant';role:'maintainer'};recordedAt:string};
const hash=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const stable=(x:any):any=>Array.isArray(x)?x.map(stable):x!==null&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const same=(a:any,b:any)=>assert.deepEqual(a,b);
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x));

export function refineEvidencePlan(old:LegacyPlan,baseBytes:string){
 const p=copy(old),baseSha=hash(baseBytes),recording='2026-10-07T06:33:00Z';
 p.$schema='이루한_숙제제출_교사확인계획_1.3.0.schema.json';p.version='1.3.0';p.revised_at_utc=recording;
 p.previous_revision={version:'1.2.0',file_name:'이루한_숙제제출_교사확인계획_1.2.0.json',sha256:baseSha};
 p.schema_refinement_request={source_message_id:'Sentinel_f3165c5485d88191aa22e9ed37b0b8ef',reported_at_utc:'2026-10-07T06:25:11.954372+00:00',recorded_at_utc:recording,purpose:'separate_user_statement_provenance_from_independent_source_verification',actual_observation_event:false};
 p.source_messages.push({message_id:'Sentinel_f3165c5485d88191aa22e9ed37b0b8ef',actor:'user',sent_at_utc:'2026-10-07T06:25:11.954372+00:00',purpose:'evidence_provenance_schema_refinement_request'});
 const student:string=p.student.canonical_snapshot_student_key;
 const ref='library-file:fde1_bGliZmlsZV9ZQ3JoSl80NnhpUG5XLURKc3RjVEJn_FileDrive_73e3d24e44d881918a9b9622fd5a4193';
 function evidence(pointer:string,sourceMessage:string,reported:string,scope:Scope,claim:Claim,timeRaw:string|null,recorded:string):EvidenceRecord{
  const record:EvidenceRecord={sourceKind:'user_report',actor:{kind:'user',role:'teacher',id:null},sourceRef:{sourceMessageId:sourceMessage,reference:ref,sha256:baseSha,jsonPointer:pointer},reportedAt:reported,observedAt:null,capturedAt:null,recordedAt:recorded,timeRaw,verificationStatus:'unverified',verificationDetail:'not_independently_verified',statementProvenance:{confirmed:true,sourceMessageId:sourceMessage},scope,claim,revision:1,supersedesEvidenceIds:[],retractsEvidenceIds:[],conflictingEvidenceIds:[]};
  const key={sourceRef:record.sourceRef,scope,claim};record.evidenceId='evidence:ruhan:'+hash(JSON.stringify(stable(key))).slice(0,24);return record;
 }
 const g=old.gauss_submission_check,go=g.latest_registration_observation,dao=old.davinci_total_assignment_comparison.latest_registration_observation;
 const ge=evidence('/gauss_submission_check/latest_registration_observation',go.source_message_id,go.reported_at_utc,{studentId:student,entityIds:[g.target.existing_record_reference],fields:['grading_registration'],window:null},{type:'grading_registration_user_report',value:{registrationState:'not_registered',interimOnly:true}},'아직',old.revised_at_utc);
 const de=evidence('/davinci_total_assignment_comparison/latest_registration_observation',dao.source_message_id,dao.reported_at_utc,{studentId:student,entityIds:['scope:ruhan:20261002:davinci:unit2_TEST'],fields:['grading_registration'],window:null},{type:'grading_registration_user_report',value:{registrationState:'not_registered',candidateNativeCatalogCode:'1MHL0J',nativeBindingState:'candidate_equivalence_unverified',interimOnly:true}},'아직',old.revised_at_utc);
 const ruleSource=old.source_messages.find((s:any)=>s.message_id==='Sentinel_8aba737080808191afe9913f3301ce27');assert(ruleSource);
 const re=evidence('/gauss_submission_check/rules',ruleSource.message_id,ruleSource.sent_at_utc,{studentId:student,entityIds:[g.target.existing_record_reference],fields:['homework_submission_acceptance_rule'],window:null},{type:'user_defined_submission_acceptance_rule',value:{rules:g.rules,scheduledAttendanceAt:g.scheduled_attendance_at_utc,checkTimeSemantics:g.check_time_semantics}},null,old.created_at_utc);
 p.evidence_contract={version:'academy.evidence/1.1.0',canonical_field_style:'camelCase',storage_adapter_style:'legacy_snake_case_JSON_pointer_links',verification_status_semantics:{unverified:'not_independently_verified',corroborated:'corroborated_by_separate_evidence',contradicted:'conflicting_separate_evidence_exists'},statement_provenance_semantics:'confirmed means the authenticated user made this statement, not that LMS state was independently verified',mutation_semantics:'append_new_evidence_and_relation_ids; preserve_existing_evidence_bytes',server_query_success_fields_created:false};
 p.evidence_records=[ge,de,re];
 p.legacy_evidence_bindings=[{legacyJsonPointer:'/gauss_submission_check/latest_registration_observation',evidenceId:ge.evidenceId},{legacyJsonPointer:'/davinci_total_assignment_comparison/latest_registration_observation',evidenceId:de.evidenceId},{legacyJsonPointer:'/davinci_assignment_scope/ordered_items/2/latest_registration_observation',evidenceId:de.evidenceId},{legacyJsonPointer:'/gauss_submission_check/rules',evidenceId:re.evidenceId}];
 const gd:DecisionRecord={decisionId:'decision:ruhan:20261007:gauss6-submission:pending-v1',studentId:student,targetEntityIds:[g.target.existing_record_reference],evidenceIds:[ge.evidenceId!,re.evidenceId!],ruleVersion:'teacher.outcome/1.0.0',decisionStatus:'pending',decisionAuthority:{actorKind:'assistant',role:'maintainer'},recordedAt:recording};
 const dd:DecisionRecord={decisionId:'decision:ruhan:20261007:davinci2-TEST-submission:pending-v1',studentId:student,targetEntityIds:['scope:ruhan:20261002:davinci:unit2_TEST'],evidenceIds:[de.evidenceId!],ruleVersion:'academy.evidence/1.1.0',decisionStatus:'pending',decisionAuthority:{actorKind:'assistant',role:'maintainer'},recordedAt:recording};
 p.decision_records=[gd,dd];
 p.legacy_decision_bindings=[{legacyJsonPointer:'/gauss_submission_check/current_submission_state',decisionId:gd.decisionId},{legacyJsonPointer:'/dayrecord_execution/final_missing_homework_decision_state',decisionId:gd.decisionId},{legacyJsonPointer:'/davinci_total_assignment_comparison/latest_registration_observation/final_submission_decision_state',decisionId:dd.decisionId}];
 p.additive_refinement_audit={base_version:'1.2.0',base_sha256:baseSha,legacy_source_and_observation_objects_preserved:true,existing_user_confirmed_assignment_and_embedded_relationship_flags_preserved:true,same_TEST_report_is_one_central_evidence_record:true,reportedAt_reuses_actual_source_message_sentAt:true,observedAt_remains_null:true,recordedAt_reuses_original_legacy_record_timestamps:true,no_last_success_or_server_query_time_synthesized:true,current_homework_submission_pending:true};
 for(const field of ['gauss_submission_check','davinci_total_assignment_comparison','davinci_assignment_scope','dayrecord_execution','teacher_solution_review','reminder_plan','terminology','homework_comparison_basis','scope_structure_revision_history'])same(p[field],old[field]);
 assert.equal(new Set(p.evidence_records.map((e:EvidenceRecord)=>e.evidenceId)).size,3);assert.equal(de.evidenceId,p.legacy_evidence_bindings[1].evidenceId);assert.equal(de.evidenceId,p.legacy_evidence_bindings[2].evidenceId);
 assert(p.evidence_records.every((e:EvidenceRecord)=>e.observedAt===null&&e.statementProvenance.confirmed&&e.verificationStatus==='unverified'));assert(p.decision_records.every((d:DecisionRecord)=>d.decisionStatus==='pending'));
 function inferSchema(x:any):any{
  if(Array.isArray(x)){if(!x.length)return {type:'array'};const shapes:any[]=[];for(const item of x){const s=inferSchema(item);if(!shapes.some(a=>JSON.stringify(a)===JSON.stringify(s)))shapes.push(s);}return {type:'array',items:shapes.length===1?shapes[0]:{anyOf:shapes}};}
  if(x===null)return {type:['string','number','object','array','null']};
  if(typeof x==='object')return {type:'object',required:Object.keys(x),properties:Object.fromEntries(Object.entries(x).map(([k,v])=>[k,inferSchema(v)])),additionalProperties:false};
  if(typeof x==='boolean')return {type:'boolean'};if(Number.isInteger(x))return {type:'integer'};return {type:'string'};
 }
 const instant={type:['string','null'],format:'date-time'},idstr={type:'string',minLength:1,maxLength:256},actorKind={enum:['user','assistant','native_tool','system']},role={enum:['teacher','source_collector','reviewer','maintainer','unknown']};
 const es={type:'object',additionalProperties:false,required:Object.keys(ge),properties:{
  evidenceId:idstr,sourceKind:{enum:['user_report','lms_direct_observation','imported_snapshot','inference']},
  actor:{type:'object',required:['kind','role','id'],additionalProperties:false,properties:{kind:actorKind,role,id:{type:['string','null']}}},
  sourceRef:{type:'object',required:['sourceMessageId','reference','sha256','jsonPointer'],additionalProperties:false,properties:{sourceMessageId:{type:['string','null']},reference:{type:['string','null']},sha256:{type:['string','null'],pattern:'^[a-f0-9]{64}$'},jsonPointer:{type:['string','null']}}},
  reportedAt:instant,observedAt:instant,capturedAt:instant,recordedAt:{type:'string',format:'date-time'},timeRaw:{type:['string','null']},verificationStatus:{enum:['unverified','corroborated','contradicted']},verificationDetail:{type:['string','null']},
  statementProvenance:{type:'object',required:['confirmed','sourceMessageId'],additionalProperties:false,properties:{confirmed:{type:'boolean'},sourceMessageId:{type:['string','null']}}},
  scope:{type:'object',required:['studentId','entityIds','fields','window'],additionalProperties:false,properties:{studentId:idstr,entityIds:{type:'array',items:idstr},fields:{type:'array',items:{type:'string'}},window:{anyOf:[{type:'null'},{type:'object',required:['from','to','labelRaw'],additionalProperties:false,properties:{from:instant,to:instant,labelRaw:{type:['string','null']}}}]}}},
  claim:{type:'object',required:['type','value'],additionalProperties:false,properties:{type:{type:'string'},value:{}}},revision:{type:'integer',minimum:1},supersedesEvidenceIds:{type:'array',items:idstr},retractsEvidenceIds:{type:'array',items:idstr},conflictingEvidenceIds:{type:'array',items:idstr}
 }};
 const ds={type:'object',required:Object.keys(gd),additionalProperties:false,properties:{decisionId:idstr,studentId:idstr,targetEntityIds:{type:'array',items:idstr},evidenceIds:{type:'array',minItems:1,items:idstr},ruleVersion:{type:'string',minLength:1},decisionStatus:{enum:['pending','confirmed','rejected','needs_review']},decisionAuthority:{type:'object',required:['actorKind','role'],additionalProperties:false,properties:{actorKind,role}},recordedAt:{type:'string',format:'date-time'}}};
 const sch=inferSchema(p);sch.$schema='https://json-schema.org/draft/2020-12/schema';sch.title='Student homework evidence and decision plan';sch.properties.version={const:'1.3.0'};sch.properties.type={const:p.type};sch.$defs={EvidenceRecord:es,DecisionRecord:ds};sch.properties.evidence_records={type:'array',items:{$ref:'#/$defs/EvidenceRecord'}};sch.properties.decision_records={type:'array',items:{$ref:'#/$defs/DecisionRecord'}};
 const rev={type:'student_homework_review_plan_append_revision',plan_id:p.plan_id,revision_id:'revision_0003',from_version:'1.2.0',to_version:'1.3.0',recorded_at_utc:recording,base:p.previous_revision,source_message_id:'Sentinel_f3165c5485d88191aa22e9ed37b0b8ef',source_reported_at_utc:'2026-10-07T06:25:11.954372+00:00',events:[{kind:'additive_evidence_provenance_normalization',contract_version:'academy.evidence/1.1.0',new_evidence_ids:p.evidence_records.map((e:EvidenceRecord)=>e.evidenceId),legacy_bindings:p.legacy_evidence_bindings,old_evidence_modified:false,source_actual_observation_times_created:false},{kind:'pending_decision_evidence_and_rule_links_added',new_decision_ids:p.decision_records.map((d:DecisionRecord)=>d.decisionId),homework_decision_became_final:false}]};
 return {plan:p,schema:sch,revision:rev};
}

function runCli(){
 const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
 const baseDir=resolve(option('--base-dir')??dirname(fileURLToPath(import.meta.url))),outArg=option('--out-dir');
 if(!outArg)throw Error('--out-dir is required so published inputs are never overwritten.');
 const outDir=resolve(outArg),verifyDir=option('--verify-against')?resolve(option('--verify-against')!):null;
 if(outDir===baseDir||outDir===verifyDir)throw Error('Output must be a separate verification directory.');
 const basePath=resolve(baseDir,'이루한_숙제제출_교사확인계획_1.2.0.json'),bytes=readFileSync(basePath,'utf8');
 const result=refineEvidencePlan(JSON.parse(bytes),bytes);mkdirSync(outDir,{recursive:true});
 const files=[['이루한_숙제제출_교사확인계획_1.3.0.json',result.plan],['이루한_숙제제출_교사확인계획_1.3.0.schema.json',result.schema],['이루한_숙제제출_교사확인계획_revision_0003.json',result.revision]] as const;
 const checks=files.map(([name,data])=>{const generated=JSON.stringify(data,null,2)+'\n';const path=resolve(outDir,name);writeFileSync(path,generated);const byteMatches=verifyDir?readFileSync(resolve(verifyDir,name)).equals(Buffer.from(generated)):null;if(verifyDir)assert(byteMatches,`Byte mismatch: ${name}`);return {name,sha256:hash(generated),byteMatches};});
 console.log(JSON.stringify({runtime:(globalThis as {Bun?:unknown}).Bun!==undefined?'Bun':'Node TypeScript',checks,legacyEvidencePreserved:true},null,2));
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url))runCli();
