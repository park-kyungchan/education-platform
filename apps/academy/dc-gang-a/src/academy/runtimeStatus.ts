export interface TeacherRuntimeObservation {
  readonly postgres:'running'|'stopped'|'unknown';
  readonly local:'healthy'|'unreachable'|'unexpected';
  readonly public:'healthy'|'unreachable'|'unexpected';
}
/** A read-only diagnosis, not a launcher, native state mirror or effect grant. */
export function classifyTeacherRuntime(observation:TeacherRuntimeObservation){
  const uncertain=observation.postgres==='unknown'||observation.local==='unexpected'||observation.public==='unexpected';
  const healthy=observation.postgres==='running'&&observation.local==='healthy'&&observation.public==='healthy';
  return {
    state:healthy?'available' as const:uncertain?'unknown' as const:'unavailable' as const,
    next:healthy?'keep_existing_runtime' as const:uncertain?'resolve_unknown_ownership_no_restart' as const:observation.postgres==='running'&&observation.local==='healthy'?'inspect_existing_tunnel_only' as const:'verify_existing_targets_then_recover' as const,
    automaticEffects:false as const,sessionClosureProvesStop:false as const,
  };
}
