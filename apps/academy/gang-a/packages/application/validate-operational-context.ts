import {OperatingContext, OperatingManifest} from '../schema/academy-operating-context.ts';
import type {OperationNode, OperationalId} from '../domain/operational-context.ts';
import {assertCommonOperationsPrivacy} from '../security/operational-context.ts';

function unique(values:readonly string[],name:string){if(new Set(values).size!==values.length)throw Error('duplicate_'+name);}
function acyclic(edges:readonly {from:OperationalId;to:OperationalId}[],name:string){
 const visiting=new Set<OperationalId>(),visited=new Set<OperationalId>(),byFrom=new Map<OperationalId,OperationalId[]>();
 for(const edge of edges)byFrom.set(edge.from,[...(byFrom.get(edge.from)??[]),edge.to]);
 const visit=(id:OperationalId)=>{if(visiting.has(id))throw Error(name+'_cycle');if(visited.has(id))return;visiting.add(id);for(const next of byFrom.get(id)??[])visit(next);visiting.delete(id);visited.add(id);};
 for(const id of byFrom.keys())visit(id);
}
/** Validates supplied lineage and relationships. Never establishes live access or action authority. */
export function validateOperationalContext(input:unknown,manifestInput:unknown):OperatingContext{
 const context=OperatingContext.parse(input),manifest=OperatingManifest.parse(manifestInput);
 assertCommonOperationsPrivacy(context);assertCommonOperationsPrivacy(manifest);
 if(context.checkpointId!==manifest.checkpointId||context.targetRepository!==manifest.targetRepository)throw Error('operational_manifest_scope_mismatch');
 unique(context.nodes.map(n=>n.id),'operation_node');unique(context.sources.map(n=>n.id),'operation_source');unique(context.investigations.map(n=>n.id),'investigation');unique(context.relations.map(n=>n.id),'operation_relation');
 const nodes=new Map(context.nodes.map(n=>[n.id,n])),sources=new Map(context.sources.map(s=>[s.id,s])),questions=new Map(context.investigations.map(q=>[q.id,q]));
 unique([...nodes.keys(),...sources.keys(),...questions.keys()],'operational_namespace');
 const assertKind=(id:OperationalId,kinds:readonly OperationNode['kind'][])=>{const n=nodes.get(id);if(!n||!kinds.includes(n.kind))throw Error('operational_reference_kind_mismatch');return n;};
 const assertSources=(ids:readonly OperationalId[])=>{unique(ids,'source_reference');for(const id of ids)if(!sources.has(id))throw Error('operational_source_missing');};
 const assertLines=(alias:string,from:number,through:number)=>{const doc=context.coverage.sourceDocuments.find(d=>d.alias===alias);if(!doc||from>through||through>doc.lines)throw Error('source_line_coverage_mismatch');};
 for(const input of [manifest.input,...manifest.updates])unique(input.sources.map(s=>s.filename),'revision_input_source_file');
 for(const correction of manifest.inlineCorrections)if(new Bun.CryptoHasher('sha256').update(correction.assertionRaw).digest('hex')!==correction.sha256)throw Error('inline_correction_pin_mismatch');
 unique(manifest.inlineCorrections.map(c=>c.reference),'inline_correction_reference');
 unique(manifest.input.sources.map(s=>s.filename),'input_source_file');
 for(const s of context.sources){
  const match=[manifest.input,...manifest.updates].some(input=>(s.inputRevisionSha256===undefined?s.statementProvenance===undefined:s.inputRevisionSha256===input.sha256)&&input.sources.some((file,index)=>{const prefix='sourceLayout'in input&&input.sourceLayout==='standalone_document'?'':'/files/'+index+'/content';return file.filename===s.sourceRef.reference&&file.originalInputSha256===s.sourceRef.sha256&&(s.sourceRef.jsonPointer===prefix||s.sourceRef.jsonPointer.startsWith(prefix+'/'));}));
  const inline=manifest.inlineCorrections.some((c,index)=>s.inputRevisionSha256===undefined&&c.reference===s.sourceRef.reference&&c.sha256===s.sourceRef.sha256&&s.sourceRef.jsonPointer==='/inlineCorrections/'+index&&c.assertionRaw===s.assertionRaw&&s.kind==='user_statement'&&s.statementProvenance==='user_paraphrase');
  if(!match&&!inline)throw Error('operational_source_pin_mismatch');
  if(s.locator.kind==='lines')assertLines(s.locator.sourceAlias,s.locator.from,s.locator.through);
  assertSources(s.supersedesAnchorIds);if(s.supersedesAnchorIds.includes(s.id))throw Error('source_self_supersession');
 }
 acyclic(context.sources.flatMap(s=>s.supersedesAnchorIds.map(id=>({from:s.id,to:id}))),'source_supersession');
 for(const n of context.nodes)assertSources(n.sourceAnchorIds);
 const root=context.nodes.filter(n=>n.kind==='academy_root');if(root.length!==1)throw Error('one_operational_root_required');
 const parents=new Map<OperationalId,OperationalId>();
 const edgeIdentity=new Set<string>();
 for(const e of context.relations){
  assertSources(e.sourceAnchorIds);const from=nodes.get(e.from),to=nodes.get(e.to);if(!from||!to)throw Error('dangling_operational_relation');
  const identity=[e.kind,e.from,e.to].join(':');if(edgeIdentity.has(identity))throw Error('duplicate_semantic_relation');edgeIdentity.add(identity);
  switch(e.kind){
   case 'contains':{
    const allowed=from.kind==='academy_root'&&to.kind==='domain'||from.kind==='domain'&&to.kind==='policy'&&from.domain===to.domain||from.kind==='policy'&&to.kind==='step'&&to.policyId===from.id&&e.order===to.order;
    if(!allowed)throw Error('invalid_operational_parent_kind');if(parents.has(to.id))throw Error('multiple_operational_parents');parents.set(to.id,from.id);break;
   }
   case 'precedes':if(from.kind!=='step'||to.kind!=='step'||from.policyId!==to.policyId||from.order>=to.order)throw Error('invalid_step_order');break;
   case 'depends_on':case 'related_policy':assertKind(e.from,['policy']);assertKind(e.to,['policy']);if(e.from===e.to)throw Error('policy_self_relation');break;
   case 'performed_by_role':case 'reported_to_role':assertKind(e.from,['policy','step']);assertKind(e.to,['role']);break;
   case 'produces_artifact':assertKind(e.from,['policy','step']);assertKind(e.to,['artifact']);break;
   case 'uses_reference':assertKind(e.from,['policy','step']);assertKind(e.to,['reference']);break;
   case 'uses_concept':assertKind(e.from,['policy','step']);assertKind(e.to,['concept']);break;
  }
 }
 for(const n of context.nodes){
  if(['domain','policy','step'].includes(n.kind)&&!parents.has(n.id))throw Error('operational_parent_missing');
  if(n.kind==='step'){
   const p=assertKind(n.policyId,['policy']);if(p.kind!=='policy'||!p.stepIds.includes(n.id))throw Error('step_not_declared_by_policy');assertKind(n.ownerRoleId,['role']);
  }
  if(n.kind==='policy'){
   if(!n.sourceAnchorIds.length)throw Error('policy_source_required');unique(n.stepIds,'policy_step');unique(n.investigationIds,'policy_investigation');unique(n.ownerRoleIds,'policy_role');
   for(const [index,id]of n.stepIds.entries()){const step=assertKind(id,['step']);if(step.kind!=='step'||step.policyId!==n.id||step.order!==index)throw Error('policy_step_scope_or_order_mismatch');}
   for(const id of n.ownerRoleIds)assertKind(id,['role']);
   for(const id of n.investigationIds)if(!questions.get(id)?.policyIds.includes(n.id))throw Error('policy_investigation_join_mismatch');
   if(n.lifecycle==='expired'&&(n.trigger.kind!=='historical'||n.obligation!=='historical_only'||n.automation!=='historical_only'))throw Error('expired_policy_cannot_reactivate');
   if(n.knowledge==='recommendation'&&n.obligation!=='optional')throw Error('recommendation_cannot_be_mandatory');
   if(n.applicability.status.startsWith('conditional')&&!n.applicability.requiresActualAssignment)throw Error('conditional_policy_requires_assignment');
  }
 }
 for(const q of context.investigations){assertSources(q.sourceAnchorIds);unique(q.policyIds,'investigation_policy');for(const id of q.policyIds){const p=assertKind(id,['policy']);if(p.kind!=='policy'||!p.investigationIds.includes(q.id))throw Error('investigation_policy_join_mismatch');}if(['deferred_by_user','deferred_admin','human_judgment_only','automation_deferred'].includes(q.status)&&!q.doNotSendAgain)throw Error('deferred_question_cannot_auto_send');}
 for(const kind of ['contains','depends_on','precedes'] as const)acyclic(context.relations.filter(e=>e.kind===kind),kind);
 const coverage=context.coverage;
 unique(coverage.sourceDocuments.map(d=>d.alias),'source_document');unique(coverage.sourceItems.map(d=>d.sourceItemId),'source_item');unique(coverage.sourceQuestions.map(d=>d.sourceQuestionId),'source_question');
 for(const item of coverage.sourceItems){unique(item.policyIds,'source_item_policy');for(const id of item.policyIds)assertKind(id,['policy']);if(item.disposition==='mapped'&&(!item.policyIds.length||item.reasonRaw!==null)||item.disposition==='excluded_non_duty'&&(item.policyIds.length||item.reasonRaw===null))throw Error('invalid_source_item_partition');}
 for(const n of context.nodes.filter(n=>n.kind==='policy'))if(!coverage.sourceItems.some(s=>s.policyIds.includes(n.id)))throw Error('uncovered_operational_policy');
 for(const q of coverage.sourceQuestions){unique(q.investigationIds,'source_question_investigation');if(q.investigationIds.some(id=>!questions.has(id)))throw Error('source_question_investigation_missing');}
 for(const h of coverage.historical)assertSources(h.sourceAnchorIds);
 for(const a of [...coverage.missingAttachments,...coverage.cancelledMessages])assertLines(a.sourceAlias,a.fromLine,a.throughLine);
 for(const a of coverage.recommendations)assertSources(a.sourceAnchorIds);
 for(const ref of Object.values(context.references)){assertKind(ref.referenceId,['reference']);assertSources(ref.sourceAnchorIds);}
 for(const rule of context.references.st.rules)assertSources(rule.sourceAnchorIds);
 for(const claim of context.references.st.publisherClaims)assertSources(claim.sourceAnchorIds);
 for(const rule of context.references.monthly.rules)assertSources(rule.sourceAnchorIds);
 for(const step of context.references.monthly.cycle)assertSources(step.sourceAnchorIds);
 if(questions.get(context.references.st.awardInvestigationId)?.status!=='deferred_by_user')throw Error('st_award_deferral_required');
 const lbad=context.references.lbad;
 unique(lbad.criteria.map(c=>String(c.column)),'lbad_column');unique(lbad.levels.map(c=>String(c.row)),'lbad_level');unique(lbad.cells.map(c=>c.row+':'+c.column),'lbad_cell');unique(lbad.footnotes.map(c=>String(c.index)),'lbad_footnote');
 if(lbad.levels.some(l=>l.printedPoints!==l.row*2.5))throw Error('lbad_printed_points_mismatch');
 const cism=nodes.get('D-A02' as OperationalId);if(cism?.kind!=='policy'||cism.trigger.kind!=='weekly'||cism.trigger.time!==null||cism.trigger.weekday!=='monday')throw Error('cism_current_weekly_monday_required');
 const supersession=context.sources.some(s=>cism.sourceAnchorIds.includes(s.id)&&s.kind==='user_statement'&&s.sourceAlias==='USER-20261008-LATEST'&&s.supersedesAnchorIds.some(id=>cism.sourceAnchorIds.includes(id)&&sources.get(id)?.sourceAlias==='S1'));if(!supersession)throw Error('cism_historical_source_supersession_required');
 assertSources(context.interview.sourceAnchorIds);
 for(const practice of Object.values(context.confirmedPractice)){assertSources(practice.sourceAnchorIds);const ids='policyId'in practice?[practice.policyId]:practice.policyIds;for(const id of ids)assertKind(id,['policy']);}
 assertKind(context.confirmedPractice.attendanceAlert.contactingRoleId,['role']);assertKind(context.confirmedPractice.counseling.recordedByRoleId,['role']);
 for(const id of [context.confirmedPractice.makeupHandoff.resultReportingRoleId,context.confirmedPractice.makeupHandoff.recordingAndForwardingRoleId,context.confirmedPractice.deduction.materialReceivingAndForwardingRoleId,context.confirmedPractice.deduction.approvalRoleId,context.confirmedPractice.deduction.applicationRoleId,context.confirmedPractice.bookIssue.ledgerRoleId,context.confirmedPractice.closureNotice.guardianNoticeRoleId,context.confirmedPractice.withdrawal.consultingRoleId,context.confirmedPractice.withdrawal.priorNotificationRoleId])assertKind(id,['role']);
 const withdrawal=context.confirmedPractice.withdrawal;assertKind(withdrawal.reasonFormArtifactId,['artifact']);assertKind(withdrawal.rosterArtifactId,['artifact']);if(withdrawal.reasonFormArtifactId===withdrawal.rosterArtifactId)throw Error('withdrawal_form_roster_must_differ');assertSources(withdrawal.sheetStructure.sourceAnchorIds);unique(withdrawal.sheetStructure.columns.map(c=>c.column),'withdrawal_column');
 const practice=context.confirmedPractice;
 if(practice.deduction.materialReceivingAndForwardingRoleId!=='role-teacher'||practice.deduction.approvalRoleId!=='role-office-manager'||practice.deduction.applicationRoleId!=='role-office-manager'||practice.bookIssue.ledgerRoleId!=='role-office-manager'||practice.makeupHandoff.resultReportingRoleId!=='role-makeup-teacher'||practice.makeupHandoff.recordingAndForwardingRoleId!=='role-teacher'||withdrawal.priorNotificationRoleId!=='role-vice-director')throw Error('confirmed_operating_role_boundary_mismatch');
 for(const [stepId,roleId] of [['D-A08-step-3','role-office-manager'],['D-A08-step-4','role-office-manager'],['D-A15-step-3','role-office-manager'],['D-A10-step-4','role-makeup-teacher']] as const){const step=nodes.get(stepId as OperationalId);if(step?.kind!=='step'||step.ownerRoleId!==roleId)throw Error('confirmed_step_role_boundary_mismatch');}
 const roster=context.nodes.find(n=>n.kind==='step'&&n.policyId==='D-A23'&&n.actionKind==='system_entry'),notice=context.nodes.find(n=>n.kind==='step'&&n.policyId==='D-A23'&&n.labelRaw==='부원장에게 먼저 통보');
 if(!roster||!notice||!context.relations.some(e=>e.kind==='precedes'&&e.from===notice.id&&e.to===roster.id))throw Error('withdrawal_prior_notice_relation_required');
 if(withdrawal.sheetStructure.sourceAnchorIds.some(id=>sources.get(id)?.kind!=='ui_structure'))throw Error('sheet_structure_not_user_statement');
 for(const id of context.confirmedPractice.bookProgressMeaning.sourceAnchorIds)if(sources.get(id)?.kind!=='user_statement'||sources.get(id)?.statementProvenance==='assistant_inference')throw Error('book_date_meaning_requires_user_statement');
 return context;
}
