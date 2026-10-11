import { describe, expect, test } from 'bun:test';
import { botDevelopmentContract, syntheticBotRequest, parseBotRequest } from '../../docs/bot-development-contract';
import { decideBotDevelopment, runBotGovernanceCli } from '../../harness/bot_governance';

const now = Date.parse('2026-10-06T03:00:00Z');
const request = () => structuredClone(syntheticBotRequest);
const decide = (change: (r: ReturnType<typeof request>) => void = () => {}) => {
  const r = request(); change(r); return decideBotDevelopment(r, now);
};
const codes = (change: Parameters<typeof decide>[0]) => decide(change).reasons;

const restrictedEngineering = (role: 'restricted_worker' | 'restricted_reviewer', reasoning: 'low' | 'medium' | 'high' | 'xhigh') => {
  const r = request();
  r.action = 'engineering'; r.assignment.role = role;
  r.assignment.reasoning = reasoning; r.execution.reasoning = reasoning;
  r.caller.restrictions = 'native_enforced'; r.assignment.tools = ['terminal'];
  const effect = role === 'restricted_reviewer' ? 'repo_read' : 'repo_write';
  r.assignment.effects = [effect]; r.target.effect = effect; r.target.surface = 'repository';
  return r;
};

const coordinated = () => ({
  ...restrictedEngineering('restricted_worker','high'),
  coordination: {
    pattern:'sequence', lifecycle:'bounded_cli', inputRevision:'source-r1', observedInputRevision:'source-r1',
    parents:[{reference:'parent-result',expectedRevision:'parent-r1',observedRevision:'parent-r1',status:'accepted'}],
    ownership:'single_owner', integrationOwner:'dc-gang-a-dev', cancellation:'native_owned_handle', resultTrust:'untrusted_until_verified',
  },
});

const dialogue = () => ({
  correlationId:'synthetic-conversation',kind:'question' as const,maxMessages:2,messagesUsed:0,maxHops:1,hopsUsed:0,
  termination:'answer_budget_or_stop' as const,duplicateDelivery:false,transfersAuthority:false,
});

const profileCliMessage = () => ({
  ...request(), action:'profile_cli_message',
  caller:{...request().caller,sessionKind:'ordinary',canonicalTitle:'',managedInstall:false,protocolEnabled:false},
  assignment:{...request().assignment,tools:['terminal'],effects:['external_message']},
  messaging:{...request().messaging,peer:'default',toolExposed:false,toolDispatchable:false,payload:'minimized_source'},
  target:{...request().target,effect:'external_message'},dialogue:dialogue(),
  profileCli:{recipientProfile:'default',recipientMode:'existing_session',expectedSessionId:'synthetic-target-session',selection:'preserve_existing',
    model:'gpt-6-astra-900k',provider:'openai-codex',reasoning:'high',maxTurns:2,maxSeconds:120,maxInvocations:1,invocationsUsed:0,freshBudget:true,
    purpose:'source_question',outcome:'not_started',refusal:'none',observedSessionId:undefined,observedTitle:undefined,
    expectedRequestSha256:'a'.repeat(64),observedRequestSha256:undefined,readback:'missing',replySchema:'missing'},
});

describe('advisory Bot development decision boundary', () => {
  test('ordinary Lead can select an explicitly admitted native profile CLI question without impersonating Bot DM', () => {
    const r=profileCliMessage(),result=decideBotDevelopment(r,now);
    expect(result.reasons).toEqual([]);
    expect(result.consumer).toBe('native_profile_cli');
    expect(result.disposition).toBe('native_guarded_step');
    expect(result).toMatchObject({permissionGranted:false,nativeEvidenceVerified:false,executesEffects:false});
    expect(result.requiredNativeEvidence.join(' ')).toContain('exact native request and reply');
    expect(()=>parseBotRequest({...r,profileCli:{...r.profileCli,body:'private-marker'}})).toThrow('unexpected_field');
  });
  test('CLI communication requires one exact recipient with preserved existing or explicit new-session controls', () => {
    const check=(change:(r:ReturnType<typeof profileCliMessage>)=>void,code:string)=>{const r=profileCliMessage();change(r);expect(decideBotDevelopment(r,now).reasons).toContain(code);};
    expect(decideBotDevelopment({...profileCliMessage(),profileCli:undefined},now).reasons).toContain('profile_cli_metadata_required');
    check(r=>{r.profileCli.recipientProfile='other';},'cli_recipient_mismatch');
    check(r=>{r.profileCli.expectedSessionId=undefined as any;},'cli_recipient_identity_required');
    check(r=>{r.profileCli.selection='explicit_new';},'cli_session_selection_mismatch');
    check(r=>{r.profileCli.invocationsUsed=1;},'cli_invocation_budget_exhausted');
    check(r=>{r.profileCli.freshBudget=false;},'fresh_recipient_budget_required');
    expect(()=>parseBotRequest({...profileCliMessage(),profileCli:{...profileCliMessage().profileCli,model:' '}})).toThrow('opaque_reference_required');
    const fresh=profileCliMessage();fresh.profileCli.recipientMode='fresh_session';fresh.profileCli.expectedSessionId=undefined as any;fresh.profileCli.selection='explicit_new';
    expect(decideBotDevelopment(fresh,now).reasons).toEqual([]);
    fresh.profileCli.expectedSessionId='synthetic-old';
    expect(decideBotDevelopment(fresh,now).reasons).toContain('cli_recipient_identity_required');
    const dm=profileCliMessage();dm.action='bot_message';
    expect(decideBotDevelopment(dm,now).reasons).toContain('cli_metadata_action_mismatch');
    expect(decideBotDevelopment(dm,now).reasons).toContain('canonical_bot_chat_required');
  });
  test('CLI refusals and pending outcomes never fall back, redispatch or borrow idle ownership', () => {
    const r=profileCliMessage();r.profileCli.outcome='refused';r.profileCli.refusal='SESSION_NOT_OWNED';r.profileCli.invocationsUsed=1;
    expect(decideBotDevelopment(r,now)).toMatchObject({disposition:'stop',nextStep:'preserve_native_refusal_no_equivalent_bypass'});
    for(const outcome of ['queued','claimed','uncertain']){
      r.profileCli.outcome=outcome;r.profileCli.refusal='none';
      expect(decideBotDevelopment(r,now)).toMatchObject({disposition:'reconcile_readback',nextStep:'reconcile_exact_cli_delivery_without_resend'});
    }
  });
  test('completed CLI reports require the exact native recipient/request and valid reply, never exit zero alone', () => {
    const r=profileCliMessage();r.profileCli.outcome='completed';r.profileCli.invocationsUsed=1;
    expect(decideBotDevelopment(r,now).disposition).toBe('collect_native_evidence');
    r.profileCli.observedSessionId='synthetic-target-session' as any;
    r.profileCli.observedRequestSha256=r.profileCli.expectedRequestSha256 as any;
    r.profileCli.readback='exact_request_and_reply';r.profileCli.replySchema='valid';
    expect(decideBotDevelopment(r,now)).toMatchObject({disposition:'stop',nextStep:'retain_reported_cli_reply_require_native_verification',permissionGranted:false,nativeEvidenceVerified:false,executesEffects:false});
    r.profileCli.observedSessionId='other-session' as any;
    expect(decideBotDevelopment(r,now).disposition).toBe('reconcile_readback');
    r.profileCli.observedSessionId='synthetic-target-session' as any;r.profileCli.observedRequestSha256='b'.repeat(64) as any;
    expect(decideBotDevelopment(r,now).disposition).toBe('reconcile_readback');
  });
  test('public CLI reconciles contradictory invocation/receipt states instead of recommending another send', () => {
    for(const change of [
      (r:ReturnType<typeof profileCliMessage>)=>{r.profileCli.observedSessionId='synthetic-target-session' as any;},
      (r:ReturnType<typeof profileCliMessage>)=>{r.profileCli.observedRequestSha256='a'.repeat(64) as any;},
      (r:ReturnType<typeof profileCliMessage>)=>{r.profileCli.readback='exact_request_and_reply';r.profileCli.replySchema='valid';},
      (r:ReturnType<typeof profileCliMessage>)=>{r.profileCli.outcome='completed';},
    ]){
      const r=profileCliMessage();change(r);
      const result=runBotGovernanceCli(['decide','--stdin'],JSON.stringify(r),now);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({disposition:'reconcile_readback',nextStep:'reconcile_exact_cli_delivery_without_resend',permissionGranted:false,nativeEvidenceVerified:false,executesEffects:false});
      expect(JSON.parse(result.stdout).reasons).toContain('cli_lifecycle_conflict');
    }
  });
  test('hard authority and budget stops dominate unresolved delivery across native CLI and sibling recovery paths', () => {
    for(const cli of [true,false])for(const boundary of ['budget','authority','scope','not_fresh']){
      const r=profileCliMessage();
      if(cli){r.profileCli.outcome='queued';r.profileCli.invocationsUsed=1;}
      else{r.action='browser_dom';r.profileCli=undefined as any;r.assignment.tools=['browser_exec'];r.assignment.effects=['synthetic_gui'];r.target.effect='synthetic_gui';r.execution.previousEffect='uncertain';r.coordination={...coordinated().coordination,pattern:'dialogue'} as any;}
      if(boundary==='budget')r.execution.turnsUsed=r.assignment.maxTurns;
      if(boundary==='authority')r.dialogue.transfersAuthority=true;
      if(boundary==='scope')r.target.effect='unknown';
      if(boundary==='not_fresh')r.assignment.freshBudget=false;
      const result=decideBotDevelopment(r,now);
      expect(result.disposition).toBe('stop');
      expect(result.nextStep).toBe('park_original_work_require_separate_safe_readback_admission');
      expect(result.reasons).toContain(cli?'cli_delivery_unsettled':'uncertain_effect');
    }
  });
  test('public CLI never launders failed or repeated same-target effects as a fresh first invocation', () => {
    for(const previousEffect of ['failed','uncertain','confirmed','none']){
      const r=profileCliMessage();r.assignment.maxRetries=1;r.execution.previousEffect=previousEffect as any;r.execution.readback='same_target';
      if(previousEffect==='none')r.execution.retryCount=1;
      const result=JSON.parse(runBotGovernanceCli(['decide','--stdin'],JSON.stringify(r),now).stdout);
      expect(result.disposition).toBe('reconcile_readback');
      expect(result.reasons).toContain('cli_attempt_history_conflict');
      expect(result).toMatchObject({permissionGranted:false,nativeEvidenceVerified:false,executesEffects:false});
    }
  });
  test('CLI route has discoverable native command recipes without a new sender service', () => {
    const c=JSON.parse(runBotGovernanceCli(['contract'],'',now).stdout),b=JSON.parse(runBotGovernanceCli(['runbook'],'',now).stdout);
    expect(c.profileCommunication.stateOwner).toBe('Hermes');
    expect(c.profileCommunication.nativeBotDm).toBe('message_agent');
    expect(c.profileCommunication.cliAction).toBe('profile_cli_message');
    expect(b.profileCommunication.routes.map((v:{recipient:string})=>v.recipient)).toEqual(['existing_bot_chat','existing_session','fresh_session']);
    expect(b.profileCommunication.authority).toContain('does not authorize implementation');
    expect(b.profileCommunication.refusal).toContain('idle');
  });
  test('messaging requires a fresh bounded dialogue even when native routing is present', () => {
    const r=request();r.action='bot_message';r.assignment.tools=['message_agent'];
    r.assignment.effects=['external_message'];r.target.effect='external_message';
    expect(decideBotDevelopment(r,now).reasons).toContain('bounded_dialogue_required');
    const bounded={...r,dialogue:dialogue()};
    expect(decideBotDevelopment(bounded,now).reasons).toEqual([]);
    bounded.dialogue.messagesUsed=2;
    expect(decideBotDevelopment(bounded,now).disposition).toBe('stop');
    bounded.dialogue.messagesUsed=0;bounded.dialogue.hopsUsed=1;
    expect(decideBotDevelopment(bounded,now).reasons).toContain('dialogue_budget_exhausted');
    bounded.dialogue.hopsUsed=0;bounded.dialogue.duplicateDelivery=true;
    expect(decideBotDevelopment(bounded,now).reasons).toContain('dialogue_duplicate_delivery');
    bounded.dialogue.duplicateDelivery=false;bounded.dialogue.transfersAuthority=true;
    expect(decideBotDevelopment(bounded,now).reasons).toContain('message_cannot_grant_authority');
  });
  test('source-only peer discussion is minimized metadata, never a private payload or assignment grant', () => {
    const r=request();r.action='room_turn';r.assignment.tools=['groups.send'];r.messaging.roomPolicy='target_native_current';
    r.assignment.effects=['external_message'];r.target.effect='external_message';
    const bounded={...r,messaging:{...r.messaging,payload:'minimized_source'},dialogue:dialogue()};
    expect(decideBotDevelopment(bounded,now).reasons).toEqual([]);
    expect(()=>parseBotRequest({...bounded,dialogue:{...bounded.dialogue,body:'private-text'}})).toThrow('unexpected_field');
    expect(()=>parseBotRequest({...bounded,dialogue:{...bounded.dialogue,maxMessages:Infinity}})).toThrow('bounded_integer_required');
    expect(()=>parseBotRequest({...bounded,dialogue:{...bounded.dialogue,kind:'approval'}})).toThrow('enum_required');
  });
  test('consumes exact predecessor results without becoming a scheduler or native receipt', () => {
    const r=coordinated(),result=decideBotDevelopment(r,now);
    expect(result.reasons).toEqual([]);
    expect(result.executesEffects).toBe(false);expect(result.nativeEvidenceVerified).toBe(false);
    r.coordination.parents[0]!.status='pending';
    const waiting=decideBotDevelopment(r,now);
    expect(waiting.disposition).toBe('stop');
    expect(waiting.reasons).toContain('dependency_not_accepted');
    expect(waiting.nextStep).toBe('wait_native_dependencies_keep_independent_work');
    r.coordination.parents[0]!.status='accepted';r.coordination.parents[0]!.observedRevision='parent-r2';
    expect(decideBotDevelopment(r,now).disposition).toBe('reconcile_readback');
  });
  test('parallel work needs disjoint current targets, bounded concurrency and owned cancellation', () => {
    const r=coordinated();r.coordination.pattern='parallel';r.coordination.parents=[];
    expect(decideBotDevelopment(r,now).reasons).toContain('parallel_disjoint_targets_required');
    expect(decideBotDevelopment(r,now).reasons).toContain('parallel_budget_required');
    r.coordination.ownership='disjoint_targets';r.assignment.maxConcurrency=2;
    expect(decideBotDevelopment(r,now).reasons).toEqual([]);
    r.coordination.ownership='overlap';
    expect(decideBotDevelopment(r,now).disposition).toBe('stop');
    r.coordination.ownership='disjoint_targets';r.coordination.cancellation='missing';
    expect(decideBotDevelopment(r,now).reasons).toContain('native_cancellation_required');
  });
  test('fan-in refuses missing, duplicate, failed or stale parents and untrusted result authority', () => {
    const r=coordinated();r.coordination.pattern='fan_in';
    expect(decideBotDevelopment(r,now).reasons).toContain('coordination_dependencies_required');
    r.coordination.parents.push({...r.coordination.parents[0]!});
    expect(decideBotDevelopment(r,now).reasons).toContain('duplicate_dependency_reference');
    r.coordination.parents[1]!.reference='second-result';
    expect(decideBotDevelopment(r,now).reasons).toEqual([]);
    r.coordination.parents[1]!.status='failed';
    expect(decideBotDevelopment(r,now).reasons).toContain('dependency_not_accepted');
    r.coordination.parents[1]!.status='accepted';r.coordination.observedInputRevision='source-r2';
    expect(decideBotDevelopment(r,now).disposition).toBe('reconcile_readback');
    r.coordination.observedInputRevision='source-r1';r.coordination.resultTrust='authority_grant';
    expect(decideBotDevelopment(r,now).disposition).toBe('stop');
    r.coordination.resultTrust='untrusted_until_verified';r.coordination.integrationOwner='unknown-peer';
    expect(decideBotDevelopment(r,now).reasons).toContain('integration_owner_required');
  });
  test('legacy single-action input is retained but coordination cannot hide private fields', () => {
    const legacy=JSON.parse(JSON.stringify(request()));delete legacy.coordination;
    expect(decideBotDevelopment(legacy,now).reasons).toEqual([]);
    const r=coordinated();r.coordination.ownership='unknown';
    expect(decideBotDevelopment(r,now).reasons).toContain('coordination_ownership_required');
    const bad={...r,coordination:{...r.coordination,'secret-key':'secret-body'}};
    const output=runBotGovernanceCli(['decide','--stdin'],JSON.stringify(bad),now);
    expect(output.exitCode).toBe(2);expect(output.stdout).not.toContain('secret-');
  });
  test('preserves the exact current Astra Lead variant without assigning it to restricted workers', () => {
    const r=request();
    const exact={...r,assignment:{...r.assignment,model:'gpt-6-astra-900k'},execution:{...r.execution,model:'gpt-6-astra-900k'}};
    expect(decideBotDevelopment(exact,now).reasons).toEqual([]);
    expect(decideBotDevelopment({...exact,execution:{...exact.execution,model:'gpt-6.1-sol'}},now).reasons).toContain('runtime_selection_mismatch');
    expect(decideBotDevelopment({...exact,assignment:{...exact.assignment,role:'restricted_worker'}},now).reasons).toContain('role_model_mismatch');
  });
  test('preserves the currently observed trusted Lead Sol 900k identifier without normalizing it', () => {
    const r=request();
    const exact={...r,assignment:{...r.assignment,model:'gpt-6.1-sol-900k'},execution:{...r.execution,model:'gpt-6.1-sol-900k'}};
    expect(decideBotDevelopment(exact,now).reasons).toEqual([]);
    expect(decideBotDevelopment({...exact,execution:{...exact.execution,model:'gpt-6.1-sol'}},now).reasons).toContain('runtime_selection_mismatch');
    expect(decideBotDevelopment({...exact,assignment:{...exact.assignment,role:'restricted_reviewer'}},now).reasons).toContain('role_model_mismatch');
    expect(() => parseBotRequest({...exact,assignment:{...exact.assignment,model:'gpt-6.1-sol-unknown'}})).toThrow('enum_required');
  });
  for (const role of ['restricted_worker', 'restricted_reviewer'] as const) {
    for (const effort of ['low', 'medium', 'high', 'xhigh'] as const) {
      test(`restricted Sol ${role} accepts explicitly selected matching ${effort} effort`, () => {
        const result = decideBotDevelopment(restrictedEngineering(role, effort), now);
        expect(result.reasons).toEqual([]);
        expect(result.disposition).toBe('native_guarded_step');
        expect(result.permissionGranted).toBe(false);
        expect(result.nativeEvidenceVerified).toBe(false);
        expect(result.executesEffects).toBe(false);
      });
    }
    test(`restricted Sol ${role} rejects actual model/provider/effort mismatches`, () => {
      for (const mismatch of ['model', 'provider', 'reasoning'] as const) {
        const r = restrictedEngineering(role, 'high');
        if (mismatch === 'model') r.execution.model = 'gpt-6-luna';
        if (mismatch === 'provider') r.execution.provider = 'other';
        if (mismatch === 'reasoning') r.execution.reasoning = 'medium';
        expect(decideBotDevelopment(r, now).reasons).toEqual(['runtime_selection_mismatch']);
      }
    });
  }
  test('unsupported selected effort fails strict ingress, not a permissive model fallback', () => {
    const r = restrictedEngineering('restricted_worker', 'high');
    expect(() => parseBotRequest({ ...r, assignment: { ...r.assignment, reasoning: 'auto' } })).toThrow('enum_required');
  });
  test('the reusable contract exposes selected Sol efforts without a role effort default', () => {
    expect(botDevelopmentContract.modelSelection.supportedSolEfforts).toEqual(['low', 'medium', 'high', 'xhigh']);
    expect(botDevelopmentContract.modelSelection.roleEffortDefault).toBeNull();
    expect(botDevelopmentContract.modelSelection.effortPolicy).toBe('explicit_current_work_selection_matched_to_native_execution');
  });
  test('task-selected Sol effort preserves restrictions, scope, provider and fresh finite budgets', () => {
    const check = (change: (r: ReturnType<typeof request>) => void, code: string) => {
      const r = restrictedEngineering('restricted_reviewer', 'medium'); change(r);
      expect(decideBotDevelopment(r, now).reasons).toContain(code);
    };
    check(r => { r.caller.restrictions = 'declared_only'; }, 'native_restrictions_required');
    check(r => { r.assignment.effects.push('repo_write'); }, 'reviewer_read_only');
    check(r => { r.target.effect = 'repo_write'; }, 'effect_outside_assignment');
    check(r => { r.assignment.provider = r.execution.provider = 'other'; }, 'role_model_mismatch');
    check(r => { r.assignment.freshBudget = false; }, 'fresh_assignment_required');
    check(r => { r.execution.elapsedSeconds = r.assignment.maxSeconds; }, 'budget_exhausted');
  });
  test('Luna stays a negligible-judgment restricted worker, never a reviewer or Lead', () => {
    const r = restrictedEngineering('restricted_worker', 'xhigh');
    r.assignment.model = 'gpt-6-luna'; r.execution.model = 'gpt-6-luna'; r.assignment.judgment = 'negligible';
    expect(decideBotDevelopment(r, now).reasons).toEqual([]);
    r.assignment.judgment = 'complex';
    expect(decideBotDevelopment(r, now).reasons).toContain('role_model_mismatch');
    r.assignment.judgment = 'negligible';
    for (const role of ['restricted_reviewer', 'trusted_lead'] as const) {
      r.assignment.role = role;
      expect(decideBotDevelopment(r, now).reasons).toContain('role_model_mismatch');
    }
  });
  test('even complete synthetic claims grant no authority and run nothing', () => {
    const result = decide();
    expect(result.disposition).toBe('native_guarded_step');
    expect(result.permissionGranted).toBe(false);
    expect(result.nativeEvidenceVerified).toBe(false);
    expect(result.executesEffects).toBe(false);
    expect(result.requiredNativeEvidence.length).toBeGreaterThan(0);
    expect(botDevelopmentContract.nativeStateOwner).toBe('Hermes');
  });
  test('strict ingress rejects unknown fields without echoing payloads', () => {
    expect(() => parseBotRequest({ ...request(), permission: 'secret-value' })).toThrow('unexpected_field');
    const result = runBotGovernanceCli(['decide', '--stdin'], JSON.stringify({ ...request(), password: 'do-not-echo' }), now);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).not.toContain('do-not-echo');
    expect(result.stdout).not.toContain('password');
  });
  test('wrong types, enums, schema, missing nested fields and non-finite budgets fail closed', () => {
    for (const value of [null, [], { ...request(), schemaVersion: 2 }, { ...request(), action: 'launch' }]) {
      expect(() => parseBotRequest(value)).toThrow();
    }
    const r: any = request(); delete r.assignment.provider;
    expect(() => parseBotRequest(r)).toThrow();
    r.assignment.provider = 'openai-codex'; r.assignment.maxTurns = Infinity;
    expect(() => parseBotRequest(r)).toThrow();
  });
  test('budgets are fresh finite per assignment, not profile defaults', () => {
    expect(codes(r => { r.assignment.freshBudget = false; })).toContain('fresh_assignment_required');
    expect(codes(r => { r.execution.turnsUsed = r.assignment.maxTurns; })).toContain('budget_exhausted');
    expect(codes(r => { r.execution.elapsedSeconds = r.assignment.maxSeconds; })).toContain('budget_exhausted');
    expect(codes(r => { r.execution.activeAssignments = r.assignment.maxConcurrency; })).toContain('concurrency_exhausted');
    expect(codes(r => { r.execution.retryCount = r.assignment.maxRetries + 1; })).toContain('retry_exhausted');
  });
  test('model/provider/reasoning mismatch cannot inherit a good profile name', () => {
    expect(codes(r => { r.execution.model = 'gpt-6-luna'; })).toContain('runtime_selection_mismatch');
    expect(codes(r => { r.execution.provider = 'other'; })).toContain('runtime_selection_mismatch');
    expect(codes(r => { r.execution.reasoning = 'low'; })).toContain('runtime_selection_mismatch');
    expect(codes(r => { r.assignment.model = 'gpt-6-luna'; })).toContain('role_model_mismatch');
  });
  test('restricted workers and reviewers need actual native controls, never just a Profile', () => {
    expect(codes(r => { r.assignment.role = 'restricted_worker'; r.caller.restrictions = 'declared_only'; })).toContain('native_restrictions_required');
    expect(codes(r => { r.assignment.role = 'restricted_reviewer'; r.action = 'browser_dom'; })).toContain('reviewer_read_only');
  });
  test('read-only reviewer reports are advisory with native controls and fresh explicit limits', () => {
    const result = decide(r => {
      r.assignment.role = 'restricted_reviewer'; r.assignment.reasoning = 'xhigh'; r.execution.reasoning = 'xhigh';
      r.caller.restrictions = 'native_enforced'; r.action = 'engineering'; r.assignment.tools = ['terminal'];
      r.assignment.effects = ['repo_read']; r.target.effect = 'repo_read'; r.target.surface = 'repository';
    });
    expect(result.reasons).toEqual([]); expect(result.nativeEvidenceVerified).toBe(false);
  });
  test('native denial is not a retry or alternative-control opportunity', () => {
    expect(decide(r => { r.execution.nativeDecision = 'denied'; }).disposition).toBe('stop');
    expect(codes(r => { r.execution.approvalMode = 'off'; })).toContain('native_safety_required');
    expect(codes(r => { r.execution.headlessPolicy = 'allow'; })).toContain('native_safety_required');
    expect(codes(r => { r.execution.redaction = false; })).toContain('native_safety_required');
  });
  test('unknown effects and undeclared effects stop', () => {
    expect(codes(r => { r.target.effect = 'unknown'; })).toContain('unknown_effect');
    expect(codes(r => { r.assignment.effects = ['repo_read']; })).toContain('effect_outside_assignment');
  });
  test('ordinary and Kanban sessions are not canonical Bot chats', () => {
    for (const sessionKind of ['ordinary', 'kanban'] as const) {
      expect(codes(r => { r.action = 'bot_message'; r.caller.sessionKind = sessionKind; })).toContain('canonical_bot_chat_required');
    }
  });
  test('messaging injection requires exact title, managed install, enabled protocol and dispatchability', () => {
    for (const change of [
      (r: ReturnType<typeof request>) => { r.caller.canonicalTitle = 'Bot Chat copy'; },
      (r: ReturnType<typeof request>) => { r.caller.managedInstall = false; },
      (r: ReturnType<typeof request>) => { r.caller.protocolEnabled = false; },
      (r: ReturnType<typeof request>) => { r.messaging.toolDispatchable = false; },
      (r: ReturnType<typeof request>) => { r.messaging.toolExposed = false; },
    ]) {
      expect(codes(r => { r.action = 'bot_message'; change(r); })).toContain('native_message_injection_required');
    }
  });
  test('messaging admission, exact peer route and minimized disclosure remain separate', () => {
    expect(codes(r => { r.action = 'bot_message'; r.messaging.admission = 'missing'; })).toContain('message_admission_required');
    expect(codes(r => { r.action = 'bot_message'; r.messaging.route = 'ambiguous'; })).toContain('exact_peer_route_required');
    expect(codes(r => { r.action = 'bot_message'; r.messaging.payload = 'private'; })).toContain('message_disclosure_required');
  });
  test('rooms use current authority epoch and never resume a held member', () => {
    expect(codes(r => { r.action = 'room_turn'; r.messaging.roomHeld = true; })).toContain('room_held');
    expect(codes(r => { r.action = 'room_turn'; r.messaging.roomEpochCurrent++; })).toContain('room_authority_drift');
  });
  test('routine activation needs new bounded native admission, not a Bot title', () => {
    expect(codes(r => { r.action = 'routine'; r.messaging.routineAdmission = 'missing'; })).toContain('routine_admission_required');
  });
  test('native room Group session is not forced through canonical-chat DM injection', () => {
    const result = decide(r => {
      r.action = 'room_turn'; r.caller.sessionKind = 'ordinary'; r.caller.canonicalTitle = 'Group: synthetic-room';
      r.caller.managedInstall = false; r.caller.protocolEnabled = false;
      r.messaging.toolExposed = false; r.messaging.toolDispatchable = false;
      r.messaging.roomPolicy = 'target_native_current';
      r.dialogue = dialogue();
      r.assignment.tools = ['groups.send']; r.assignment.effects = ['external_message']; r.target.effect = 'external_message';
    });
    expect(result.reasons).toEqual([]);
    expect(result.consumer).toBe('native_room');
    expect(result.permissionGranted).toBe(false);
    expect(codes(r => { r.action = 'room_turn'; })).toContain('native_room_policy_required');
  });
  test('scope includes native consumer entries and Luna remains negligible-judgment only', () => {
    expect(codes(r => { r.assignment.tools = ['unrelated']; })).toContain('tool_outside_assignment');
    expect(codes(r => {
      r.assignment.model = 'gpt-6-luna'; r.assignment.role = 'restricted_worker'; r.assignment.reasoning = 'xhigh';
      r.execution.model = 'gpt-6-luna'; r.execution.reasoning = 'xhigh'; r.caller.restrictions = 'native_enforced';
    })).toContain('role_model_mismatch');
  });
  test('valid DM reports still require native evidence and never send a message', () => {
    const result = decide(r => {
      r.action = 'bot_message'; r.assignment.tools = ['message_agent'];
      r.dialogue = dialogue();
      r.assignment.effects = ['external_message']; r.target.effect = 'external_message';
    });
    expect(result.reasons).toEqual([]); expect(result.consumer).toBe('native_bot_messaging');
    expect(result.executesEffects).toBe(false); expect(result.nativeEvidenceVerified).toBe(false);
  });
  test('strict nested ingress and clock validation never reveal unexpected keys or raw values', () => {
    const r = request();
    const output = runBotGovernanceCli(['decide', '--stdin'], JSON.stringify({ ...r, screen: { ...r.screen, 'secret-in-key': 'secret-in-value' } }), now);
    expect(output.exitCode).toBe(2); expect(output.stdout).not.toContain('secret-in-');
    expect(() => decideBotDevelopment(r, NaN)).toThrow('valid_clock_required');
    expect(() => parseBotRequest({ ...r, observation: { ...r.observation, observedAtUtc: '2026-02-30T00:00:00Z' } })).toThrow('utc_required');
  });
  test('human control and all challenge steps stop captures and inputs', () => {
    expect(decide(r => { r.screen.holder = 'human'; }).disposition).toBe('human_handoff');
    for (const challenge of ['login', 'two_factor', 'captcha', 'payment'] as const) {
      const result = decide(r => { r.target.challenge = challenge; });
      expect(result.disposition).toBe('human_handoff');
      expect(result.nextStep).toBe('end_turn_without_capture_or_input');
    }
  });
  test('handback alone is not user continue, and epoch drift invalidates in-flight results', () => {
    expect(codes(r => { r.screen.afterHumanHandoff = true; r.screen.userContinue = false; })).toContain('user_continue_required');
    expect(decide(r => { r.screen.epochCurrent++; }).disposition).toBe('reconcile_readback');
  });
  test('stopped/unsupported/missing Screen never falls back to a user display', () => {
    expect(decide(r => { r.screen.running = false; }).nextStep).toBe('check_native_screen_start_prerequisites');
    expect(codes(r => { r.screen.supported = false; })).toContain('screen_unavailable');
    expect(codes(r => { r.screen.installed = false; })).toContain('screen_unavailable');
    expect(codes(r => { r.screen.placement = 'unknown'; })).toContain('screen_placement_unqualified');
    expect(codes(r => { r.screen.profile = 'foreign'; })).toContain('screen_profile_mismatch');
  });
  test('normal Screen start recommendation still requires actual caller and exclusive owner evidence', () => {
    const result = decide(r => { r.action = 'screen_start'; r.screen.running = false; });
    expect(result.reasons).toEqual([]); expect(result.consumer).toBe('native_screen_cli');
    expect(result.permissionGranted).toBe(false);
    expect(codes(r => { r.action = 'screen_start'; r.screen.running = false; r.caller.binding = 'shell_only'; })).toContain('actual_native_caller_binding_required');
  });
  test('missing rehearsal evidence still blocks GUI while a stopped Screen may qualify normal start', () => {
    expect(codes(r => { r.rehearsal.buildTests = 'missing'; r.rehearsal.freshPage = false; })).toEqual(['build_test_before_gui_required', 'fresh_owned_page_required']);
    const start = decide(r => {
      r.action = 'screen_start'; r.screen.running = false; r.rehearsal.freshPage = false;
      r.rehearsal.browserCases = 'missing'; r.rehearsal.immediateCapture = false;
    });
    expect(start.reasons).toEqual([]); expect(start.permissionGranted).toBe(false);
    expect(codes(r => { r.action = 'native_chrome'; r.target.surface = 'native_chrome'; r.rehearsal.browserCases = 'missing'; })).toContain('browser_cases_before_screen_required');
  });
  test('CLI profile shell metadata cannot prove actual tool caller binding', () => {
    expect(codes(r => { r.caller.binding = 'shell_only'; })).toContain('actual_native_caller_binding_required');
    expect(codes(r => { r.caller.profile = 'foreign'; })).toContain('caller_profile_mismatch');
    expect(codes(r => { r.caller.guiToolExposed = false; })).toContain('native_gui_tool_required');
  });
  test('one-owner GUI batch includes browser even when headless', () => {
    expect(codes(r => { r.screen.otherOwners = 'unknown'; })).toContain('exclusive_gui_owner_required');
    expect(codes(r => { r.screen.otherOwners = 'present'; })).toContain('exclusive_gui_owner_required');
    expect(codes(r => { r.screen.batchOwner = 'other-session'; })).toContain('exclusive_gui_owner_required');
    expect(codes(r => { r.assignment.guiConcurrency = 2; })).toContain('one_owner_gui_batch_required');
  });
  test('browser DOM and native chrome use different consumers without cross-route escalation', () => {
    expect(decide().consumer).toBe('browser_exec');
    const chrome = decide(r => { r.action = 'native_chrome'; r.target.surface = 'native_chrome'; });
    expect(chrome.consumer).toBe('computer_use'); expect(chrome.reasons).toEqual([]);
    expect(codes(r => { r.target.surface = 'native_chrome'; })).toContain('surface_consumer_mismatch');
    expect(codes(r => { r.target.browserProvenance = 'user_cdp'; })).toContain('owned_native_browser_required');
  });
  test('synthetic label is not target ownership or local origin proof', () => {
    expect(codes(r => { r.target.identity = 'unknown'; })).toContain('exact_target_identity_required');
    expect(codes(r => { r.target.origin = 'external'; })).toContain('synthetic_local_target_required');
    expect(codes(r => { r.target.privateData = true; })).toContain('synthetic_local_target_required');
  });
  test('production and academy sources never inherit synthetic/Screen authority', () => {
    expect(decide(r => { r.target.kind = 'product'; }).nextStep).toBe('route_to_product_authorization_owner');
    expect(decide(r => { r.target.kind = 'academy_source'; }).nextStep).toBe('use_qualified_direct_http_contract');
  });
  test('client/backend path, artifact and request origin must be qualified separately', () => {
    expect(codes(r => { r.remote.requestOrigin = 'windows_client'; r.remote.route = 'unknown'; })).toContain('remote_route_required');
    expect(codes(r => { r.remote.artifactOwner = 'unknown'; })).toContain('artifact_owner_required');
    expect(codes(r => { r.remote.pathOwner = 'windows_client'; })).toContain('backend_path_required');
  });
  test('expired, future or malformed observations cannot become current evidence', () => {
    expect(codes(r => { r.observation.validUntilUtc = '2026-10-06T02:59:59Z'; })).toContain('observation_not_current');
    expect(codes(r => { r.observation.observedAtUtc = '2026-10-06T03:01:00Z'; })).toContain('observation_not_current');
    expect(() => parseBotRequest({ ...request(), observation: { observedAtUtc: 'yesterday', validUntilUtc: 'tomorrow' } })).toThrow();
  });
  test('uncertain effects reconcile original target before retry; verified input is not repeated', () => {
    expect(decide(r => { r.execution.previousEffect = 'uncertain'; }).disposition).toBe('reconcile_readback');
    expect(decide(r => { r.execution.previousEffect = 'confirmed'; }).nextStep).toBe('retain_readback_do_not_repeat');
    expect(codes(r => { r.execution.previousEffect = 'failed'; r.execution.retryCount = 1; r.execution.readback = 'missing'; })).toContain('retry_readback_required');
  });
  test('failed effects require same-target recovery and an unused repeat allowance before the next attempt', () => {
    const r=request();r.execution.previousEffect='failed';
    const noBudget=decideBotDevelopment(r,now);
    expect(noBudget.disposition).toBe('stop');expect(noBudget.reasons).toContain('retry_exhausted');
    r.assignment.maxRetries=1;
    expect(decideBotDevelopment(r,now).disposition).toBe('reconcile_readback');
    r.execution.readback='same_target';
    const allowed=decideBotDevelopment(r,now);
    expect(allowed.reasons).toEqual([]);expect(allowed.disposition).toBe('native_guarded_step');
    expect(allowed).toMatchObject({permissionGranted:false,nativeEvidenceVerified:false,executesEffects:false});
    r.execution.retryCount=1;
    expect(decideBotDevelopment(r,now).disposition).toBe('stop');
    r.execution.readback='missing';
    expect(decideBotDevelopment(r,now).disposition).toBe('stop');
  });
  test('completion is not inferred from zero exit or a smaller leaf', () => {
    expect(codes(r => { r.assignment.verification = []; })).toContain('complete_work_required');
    expect(codes(r => { r.assignment.completion = ''; })).toContain('complete_work_required');
  });
  test('CLI help, contract, runbook and example are exercised actual consumers', () => {
    for (const args of [['--help'], ['contract'], ['runbook'], ['example']]) {
      const result = runBotGovernanceCli(args, '', now);
      expect(result.exitCode).toBe(0); expect(() => JSON.parse(result.stdout)).not.toThrow();
    }
    const result = runBotGovernanceCli(['decide', '--stdin'], JSON.stringify(request()), now);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).permissionGranted).toBe(false);
  });
  test('existing contract and runbook expose native orchestration and attributable learning without activation', () => {
    const contract=JSON.parse(runBotGovernanceCli(['contract'],'',now).stdout);
    const runbook=JSON.parse(runBotGovernanceCli(['runbook'],'',now).stdout);
    expect(contract.orchestration?.stateOwner).toBe('Hermes');
    expect(contract.orchestration?.advisoryOnly).toBe(true);
    expect(runbook.coordination?.patterns.map((row:{pattern:string})=>row.pattern)).toEqual(['sequence','parallel','fan_in','dialogue']);
    expect(runbook.learning?.nativeWriter).toBe('skill_manage');
    expect(runbook.coordination?.newDispatcherInstalled).toBe(false);
  });
  test('CLI rejects flags, malformed or oversized JSON and does not echo errors or contents', () => {
    for (const [args, input] of [
      [['decide', '--execute'], ''], [['decide', '--stdin'], 'not-json-sensitive'],
      [['decide', '--stdin'], ' '.repeat(65537)], [['example', '--extra'], ''],
    ] as [string[], string][]) {
      const result = runBotGovernanceCli(args, input, now);
      expect(result.exitCode).toBe(2); expect(result.stdout).not.toContain(input.trim() || '--extra');
      expect(JSON.parse(result.stdout)).toMatchObject({permissionGranted:false,nativeEvidenceVerified:false,executesEffects:false});
    }
  });
  test('actual oversized streaming ingress preserves every explicit unauthenticated result boundary', () => {
    const result=Bun.spawnSync(['bun','--no-env-file','run','harness/bot_governance.ts','decide','--stdin'],{stdin:Buffer.from('synthetic-sensitive-marker'+'x'.repeat(65537))});
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({permissionGranted:false,nativeEvidenceVerified:false,executesEffects:false,error:'cli:input_too_large'});
    expect(result.stdout.toString()).not.toContain('synthetic-sensitive-marker');
  });
  test('process CLI readback has advisory exit code, not authorization success', () => {
    const child = Bun.spawnSync(['bun', 'run', 'harness/bot_governance.ts', 'example']);
    expect(child.exitCode).toBe(0);
    const fixture = JSON.parse(child.stdout.toString());
    const result = Bun.spawnSync(['bun', 'run', 'harness/bot_governance.ts', 'decide', '--stdin'], { stdin: Buffer.from(JSON.stringify(fixture)) });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString()).permissionGranted).toBe(false);
  });
});
