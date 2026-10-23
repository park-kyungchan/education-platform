/** Academy domain planner, not a policy authority, runtime dispatcher or shared Artifact schema. */
export type Environment = 'dot_cloud' | 'user_computer' | 'wsl2' | 'vps';
export type Purpose = 'assessment' | 'daily_test' | 'video_review' | 'daily_record';
export interface Directive { id: string; kind: 'environment_constraint' | 'task_scope' | 'source_semantics' | 'migration_gate'; sourceMessageId: string; issuedAt: string | null; scope: 'academy'; supersedes: string[]; }
export interface Route { id: string; owner: 'academy'; purpose: Purpose; environment: 'dot_cloud'; operation: 'query'; interaction: 'name_enter' | 'official_menu' | 'filter_enter'; target: string; resultKind: string; requires: string[]; fallbacks: string[]; sideEffects: 'read_only'; }
export interface InstructionTopology { schemaVersion: 'academy.instruction-topology/1'; domainId: 'academy-operations'; projectId: 'academy-workbench'; executionAuthority: 'none'; executionEnabled: false; environmentConstraint: 'dot_cloud'; directives: Directive[]; routes: Route[]; }
function fail(ok: unknown, reason: string): asserts ok { if (!ok) throw Error(reason); }
function validateGraph<T extends { id: string }>(nodes: T[], edges: (node: T) => string[]) {
  const map = new Map(nodes.map(x => [x.id, x]));
  fail(map.size === nodes.length && nodes.every(x => typeof x.id === 'string' && x.id.trim()), 'duplicate_or_empty_id');
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) { fail(map.has(id), 'dangling_edge'); fail(!visiting.has(id), 'graph_cycle'); if (visited.has(id)) return;
    visiting.add(id); for (const target of edges(map.get(id)!)) visit(target); visiting.delete(id); visited.add(id); }
  for (const node of nodes) visit(node.id); return map;
}
export function validateTopology(x: InstructionTopology) {
  fail(x.schemaVersion === 'academy.instruction-topology/1' && x.domainId === 'academy-operations' && x.projectId === 'academy-workbench', 'topology_identity');
  fail(x.executionAuthority === 'none' && x.executionEnabled === false && x.environmentConstraint === 'dot_cloud', 'non_authorizing_cloud_constraint');
  fail(Array.isArray(x.directives) && x.directives.length > 0 && Array.isArray(x.routes) && x.routes.length > 0, 'graphs_required');
  validateGraph(x.directives, d => d.supersedes);
  for (const d of x.directives) fail(d.scope === 'academy' && !!d.sourceMessageId?.trim() && ['environment_constraint','task_scope','source_semantics','migration_gate'].includes(d.kind) && (d.issuedAt === null || Number.isFinite(Date.parse(d.issuedAt))), 'directive_provenance');
  const routes = validateGraph(x.routes, r => r.fallbacks);
  for (const r of x.routes) {
    fail(r.owner === 'academy' && r.environment === 'dot_cloud' && r.operation === 'query' && r.sideEffects === 'read_only', 'route_effect_boundary');
    fail(['assessment','daily_test','video_review','daily_record'].includes(r.purpose) && ['name_enter','official_menu','filter_enter'].includes(r.interaction) && !!r.target?.trim() && !!r.resultKind?.trim(), 'route_shape');
    fail(Array.isArray(r.requires) && ['existing_session','verified_student_scope','observed_official_route'].every(v => r.requires.includes(v)), 'route_preconditions');
    for (const fallback of r.fallbacks) fail(routes.get(fallback)!.purpose === r.purpose && routes.get(fallback)!.target === r.target, 'cross_scope_fallback');
  } return x;
}
export interface RouteObservation { routeId: string; state: 'succeeded' | 'failed' | 'denied' | 'outcome_uncertain'; studentId: string; observedAt: string; filterVerified: boolean; rowCount: number | null; resultKind: string; }
export interface PlannerInput { environment: Environment; cloudAvailable: boolean; sessionPresent: boolean; scopeAuthorized: boolean; securityWarning: boolean; extensionNotice: boolean; studentId: string; purpose: Purpose; observations: RouteObservation[]; }
export function planRead(topology: InstructionTopology, input: PlannerInput) {
  validateTopology(topology);
  const output = (status: string, routeId: string | null = null) => ({ status, routeId, executionAuthority: 'none' as const, executionEnabled: false as const, extensionNotice: input.extensionNotice, globalServiceFailureInferred: false as const });
  if (input.environment !== topology.environmentConstraint || !input.cloudAvailable) return output('explicit_environment_unavailable');
  if (!input.scopeAuthorized || input.securityWarning) return output('stop_host_authority_or_security');
  const routes = topology.routes.filter(r => r.purpose === input.purpose);
  const byId = new Map(routes.map(r => [r.id, r]));
  const observations = input.observations.filter(o => byId.has(o.routeId));
  if (observations.some(o => o.state === 'denied')) return output('stop_access_denied');
  if (observations.some(o => o.state === 'outcome_uncertain')) return output('inspect_uncertain_outcome');
  if (!input.sessionPresent) return output('secure_login_needed');
  for (const o of observations) {
    if (o.state === 'succeeded') {
      if (o.studentId !== input.studentId || !o.filterVerified || !Number.isFinite(Date.parse(o.observedAt)) || o.rowCount === null || !Number.isInteger(o.rowCount) || o.rowCount < 0 || o.resultKind !== byId.get(o.routeId)!.resultKind) return output('scoped_result_not_verified', o.routeId);
      return output('scoped_read_available', o.routeId);
    }
  }
  const attempted = new Set(observations.map(o => o.routeId));
  const route = routes.find(r => !attempted.has(r.id));
  return route ? output('recommend_known_read_route', route.id) : output('coverage_gap_in_tested_routes');
}
export interface RemovalEvidence {
  scopeExactIds: string[]; inventoryComplete: boolean; hashesVerified: boolean; semanticVerification: boolean;
  localRecoveryVerified: boolean; unresolvedReferences: string[]; mergedSha: string | null; remoteVerifiedSha: string | null;
  deletionKind: 'recoverable' | 'irreversible' | 'unknown'; scopeConfirmed: boolean; userRequestRef: string | null;
  actionTimeConfirmationRef: string | null; outcome: 'not_started' | 'completed' | 'uncertain';
}
export function removalReadiness(x: RemovalEvidence) {
  const result = (state: string) => ({ state, executionAuthority: 'none' as const, automaticDeletion: false as const });
  if (x.outcome === 'uncertain') return result('inspect_uncertain_outcome');
  if (x.outcome === 'completed') return result('do_not_repeat');
  if (!x.userRequestRef || !x.scopeConfirmed || !x.scopeExactIds.length || new Set(x.scopeExactIds).size !== x.scopeExactIds.length) return result('exact_scope_confirmation_needed');
  if (!x.inventoryComplete || !x.hashesVerified || !x.semanticVerification || !x.localRecoveryVerified || x.unresolvedReferences.length) return result('preservation_or_recovery_incomplete');
  if (!x.mergedSha || !/^[0-9a-f]{40}$/.test(x.mergedSha) || x.remoteVerifiedSha !== x.mergedSha) return result('verified_merge_needed');
  if (x.deletionKind === 'unknown') return result('deletion_semantics_unknown');
  if (x.deletionKind === 'irreversible' && !x.actionTimeConfirmationRef) return result('action_time_confirmation_needed');
  return result('candidate_for_host_authorization_check');
}
