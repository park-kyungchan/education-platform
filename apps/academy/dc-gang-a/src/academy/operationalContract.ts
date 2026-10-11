/** Current source/ownership/format contract at real CLI consumers, not authentication or effect authority. */
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {catalogLevels} from './domain';

export const OPERATIONAL_CONTRACT_PATH='docs/academy-operational-contract.json' as const;
export const OPERATIONAL_CONTRACT_REVISION='2026-10-07-r1' as const;
export const operationalTopics=['roles','format','source_access','product','meaning','references'] as const;
export type OperationalTopic=typeof operationalTopics[number];
export type AcademyOperationalContract = {
  schemaVersion:1; kind:'academy_operational_contract'; revision:string; asOf:string; claimClass:'USER_APPROVED_LOCAL';
} & typeof operationalContractShape;
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_operational_contract');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Object.values(descriptors).some(d=>!Object.hasOwn(d,'value')))throw Error('invalid_operational_contract');
  return value as Record<string,unknown>;
}
function exact(value:unknown,expected:Record<string,unknown>):void{
  const input=record(value);const keys=Object.keys(expected);
  if(Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))throw Error('invalid_operational_contract');
  for(const key of keys){const want=expected[key],got=input[key];
    if(Array.isArray(want)){if(!Array.isArray(got)||got.length!==want.length||got.some((v,i)=>v!==want[i]))throw Error('invalid_operational_contract');}
    else if(want&&typeof want==='object')exact(got,want as Record<string,unknown>);
    else if(got!==want)throw Error('invalid_operational_contract');
  }
}
export const operationalContractShape={
  roles:{academyOwner:'dc-gang-a-dev',commonPlatformOwner:'ontology-platform',defaultPermanentAcademyOwner:false,temporaryAuthorityOrigin:'current_explicit_user_assignment_only',nativeIdentityAndLifecycleOwner:'Hermes',profileIsFilesystemSandbox:false},
  format:{canonicalOwnedArtifacts:'typed_ts_or_validated_json',validationBoundaries:['ingress','egress','cross_record_invariants'],nativeRequiredFiles:['AGENTS.md','SOUL.md','SKILL.md','USER.md','MEMORY.md'],nativeProseRole:'minimal_entry_or_procedure_not_parallel_domain_policy',originalEvidence:'preserve_original_bytes_and_provenance',renderedProse:'derived_view_not_independent_authority',opaqueProseWrappedInJsonIsContractImplementation:false,customAutomaticContextInjection:false,nativeStateMirrorOrReplacementDispatcher:false},
  sourceAccess:{requiredTransport:'direct_http_api',academyEffect:'read_only',automaticBrowserFallback:false,browserReadException:'fresh_explicit_user_exception_required',authenticationOwner:'supported_native_secure_credential_consumers',sessionState:'ephemeral_client_issued_session',browserCookieExtraction:'excluded',hardcodedHistoricalSessionReplay:'excluded',directSqlAccess:'not_admitted',directClientQualification:'not_qualified_by_this_contract',operationClassification:'semantic_effect_not_http_method',scope:['teacher','student','date_or_attempt','requested_fields'],requiredReadChecks:['current_authentication','exact_source_identity','response_contract','coverage_and_pagination','explicit_unknowns'],legacyBrowserPreparer:'offline_compatibility_only_not_current_transport_admission'},
  authority:{contractFileGrantsEffects:false,historicalSuccessGrantsCurrentEffects:false,hashOrSchemaPassProvesSemanticAcceptance:false,sourceKeyIsCanonicalSemanticIdentity:false,nameOnlyJoinIsCanonicalBinding:false,effectAuthorityOwner:'current_user_and_native_or_application_guards'},
  product:{primaryTeacherSurface:'owned_teacher_web_application',classroomOutcome:{unitOfPreparation:'selected_date_all_scheduled_occurrences',nextDecision:'selected_student_source_grounded_teacher_judgment',coverage:'all_current_students_and_future_growth',waitingTimeThreshold:'not_invented'},contentHierarchy:catalogLevels,humanAgentConsumer:'shared_TeacherApplication_queries_scope_and_validation',mobileReadiness:'deferred_until_backend_contract_and_teacher_site_acceptance',cost:{preference:'free_tier',actualCost:'requires_current_resource_verification'},mainSheetTransition:'preserve_existing_consumers_until_reviewed_transition_acceptance',databaseFamilySelection:'private_backend_postgresql',studentStorageTopology:'shared_store_owner_student_partitions_and_shared_catalog',runtimeAndDeploymentStatus:'read_from_actual_owner_not_this_contract',independentRecoveryStatus:'not_verified_by_this_contract',classroomDutyPolicy:'src/academy/classroomCyclePolicy.ts',actualNativeWebMcpAcceptance:'not_established_by_contract_or_backend_json'},
  teacherReserved:['teacher_judgment','official_record_finalization','final_parent_send'],
  meaning:{sourceIdentity:'namespaced_literal_source_keys',lessonAndAttempt:'distinct_grains',teacherAndSourceEvidence:'separate_attributable_lanes',teacherAcceptance:{originalObservation:'preserve_as_report_without_required_approval',reviewAndApproval:'separate_record_with_exact_target_and_revision',automaticPromotion:false,officialSaveAndParentSend:'separate_human_owned_effects_not_admitted'},sourceAndEventClocks:'retain_precision_and_unknowns',missingSourceRow:'unknown_not_absence_or_nonperformance',schoolName:{valueKind:'actual_school_name',forbiddenSubstitutes:['course_grade','school_grade'],historicalReportAuthority:'dated_assertion_not_current_master',conflictDisposition:'interview_or_quarantine'},itemJudgment:{grain:'one_student_item_attempt_or_explicitly_unresolved_attempt_and_teacher_revision',requiredLanes:['literal_source_item_label','student_binding','lesson_or_work_context','paper_attempt_lineage','correctness','written_solution_state','item_reasons','inspection_state','correction_state','provenance','revision_lineage'],correctness:['O','X','partial','unknown'],partialProjection:'requires_explicit_teacher_rule',correctAnswerWithoutSolution:'O_and_missing_solution_are_independent',paperInspectionCompletion:'does_not_imply_all_items_correct',applicationPersistenceQualification:'not_implemented_by_this_contract'}},
  sourceReferences:{operationCatalog:'src/lms/endpointCatalog.ts',legacyReadParsers:'src/lms/academyReadProtocol.ts',originalImportedSourceMap:'research/remote-2026-09-27/shared-llm-wiki/concepts/academy-source-system-structure-map.md',importedSourceMapRole:'historical_imported_evidence_as_of_2026-08-26_not_current_effect_authority',engineeringCheckpoint:'handoffs/workflow-current-state.json',profileContract:'docs/hermes-backend-profile.ts',sharedFoundation:'/opt/data/shared-llm-wiki/concepts/ontology-aip-evals-sdlc-agent-start.md'},
  limitations:{nativeEnforcementOwner:'Hermes_and_actual_application_guard_consumers',newDirectHttpClientActivated:false,newSourceAcquisitionPerformed:false,servicesJobsOrAccountsActivated:false,teacherProductAcceptanceProven:false},
} as const;
export function validateAcademyOperationalContract(value:unknown):AcademyOperationalContract{
  const data=record(value);const keys=['schemaVersion','kind','revision','asOf','claimClass',...Object.keys(operationalContractShape)];
  if(Object.keys(data).length!==keys.length||keys.some(k=>!Object.hasOwn(data,k))||data.schemaVersion!==1||data.kind!=='academy_operational_contract'||data.claimClass!=='USER_APPROVED_LOCAL'
    ||typeof data.revision!=='string'||!/^\d{4}-\d{2}-\d{2}-r[1-9][0-9]*$/.test(data.revision)||typeof data.asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.asOf)
    ||!Number.isFinite(Date.parse(data.asOf+'T00:00:00Z'))||new Date(data.asOf+'T00:00:00Z').toISOString().slice(0,10)!==data.asOf||!data.revision.startsWith(data.asOf+'-'))throw Error('invalid_operational_contract');
  for(const [key,expected] of Object.entries(operationalContractShape)){if(Array.isArray(expected)){if(JSON.stringify(data[key])!==JSON.stringify(expected))throw Error('invalid_operational_contract');}else exact(data[key],record(expected));}
  return structuredClone(data) as unknown as AcademyOperationalContract;
}
export function loadAcademyOperationalContract(root:string):AcademyOperationalContract{
  const base=realpathSync(root),path=resolve(base,OPERATIONAL_CONTRACT_PATH),st=lstatSync(path);
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>65536)throw Error('invalid_operational_contract_source');
  const rel=relative(base,realpathSync(path));if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))throw Error('invalid_operational_contract_source');
  const contract=validateAcademyOperationalContract(JSON.parse(readFileSync(path,'utf8')));
  if(contract.revision!==OPERATIONAL_CONTRACT_REVISION)throw Error('stale_operational_contract');
  return contract;
}
export function operationalContext(contract:AcademyOperationalContract){
  const valid=validateAcademyOperationalContract(contract);
  return {schemaVersion:1,contractRef:OPERATIONAL_CONTRACT_PATH,revision:valid.revision,asOf:valid.asOf,roles:valid.roles,format:valid.format,sourceAccess:valid.sourceAccess,product:valid.product,teacherReserved:valid.teacherReserved,authority:valid.authority,sourceReferences:valid.sourceReferences,limitations:valid.limitations,authorizesEffects:false as const};
}
export function selectOperationalTopic(contract:AcademyOperationalContract,topic:unknown){
  if(typeof topic!=='string'||!operationalTopics.includes(topic as OperationalTopic))throw Error('invalid_operational_topic');
  const valid=validateAcademyOperationalContract(contract);
  const selected={roles:valid.roles,format:valid.format,source_access:valid.sourceAccess,product:valid.product,meaning:valid.meaning,references:valid.sourceReferences}[topic as OperationalTopic];
  return {schemaVersion:1,contractRef:OPERATIONAL_CONTRACT_PATH,revision:valid.revision,topic,selection:structuredClone(selected),authorizesEffects:false as const};
}
