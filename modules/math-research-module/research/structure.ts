/** Domain-owned structural validation. This is not a student diagnostic model. */
export interface StructureSummary { types: number; core: number; connected: number; originalExamples: number; microActions: number; capabilityCandidates: number; mappings: number; }
export function validateResearch(data: any, designs: Record<string, any>, capabilities: any): StructureSummary {
  const errors: string[] = [];
  const assert = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
  const types: any[] = data.details.flatMap((d: any) => d.types);
  const ids = new Set(types.map(t => t.id));
  assert(types.length === 151 && ids.size === 151, 'Expected 151 distinct type IDs');
  const core = types.filter(t => /^H[MDC]/.test(t.id)).length;
  const counts = Object.fromEntries(['HM', 'HD', 'HC'].map(prefix => [prefix, types.filter(t => t.id.startsWith(prefix)).length]));
  assert(counts.HM === 38 && counts.HD === 36 && counts.HC === 31, 'Core scope must remain HM38/HD36/HC31');
  assert(Object.keys(designs).length === 151, 'Expected 151 design records');
  let microActions = 0;
  const actionIds = new Set<string>();
  for (const t of types) {
    assert(typeof t.example?.prompt === 'string' && typeof t.example?.answer === 'string', `Missing original: ${t.id}`);
    const d = designs[t.id];
    assert(d?.typeId === t.id, `Missing/mismatched design: ${t.id}`);
    if (!d) continue;
    assert(typeof d.revisedExample?.prompt === 'string' && typeof d.revisedExample?.answer === 'string', `Missing design content: ${t.id}`);
    for (const a of d.actionDesign?.microActions || []) {
      microActions++;
      const id = `${t.id}/${a.id}`;
      assert(!actionIds.has(id), `Duplicate scoped action ID: ${id}`); actionIds.add(id);
      assert(typeof a.cue === 'string' && typeof a.observableStudentAction === 'string', `Missing action evidence boundary: ${id}`);
    }
  }
  assert(microActions === 1216, 'Expected 1216 micro-actions');
  const originalExamples = types.length + types.reduce((n,t) => n + (t.variants?.length ?? 0), 0);
  assert(originalExamples === 170, 'Expected 170 preserved original examples');
  assert(capabilities.mapping.length === 105, 'Capability mapping scope must remain 105 core types');
  const candidates = new Set(capabilities.abilities.map((a: any) => a.id));
  assert(candidates.size === 28, 'Expected 22 structure candidates plus 6 observation dimensions');
  assert(new Set(capabilities.mapping.map((m: any) => m.typeId)).size === 105, 'Capability mappings must be unique');
  for (const m of capabilities.mapping) {
    assert(ids.has(m.typeId) && /^H[MDC]/.test(m.typeId), `Non-core mapping: ${m.typeId}`);
    for (const id of [...m.structuralCandidateIds, ...m.explicitProcessProbeIds]) assert(candidates.has(id), `Missing capability: ${id}`);
    assert(m.evidenceScope === 'task_content_and_authored_design_only_no_student_observation', `Student evidence claim: ${m.typeId}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { types: types.length, core, connected: types.length - core, originalExamples, microActions, capabilityCandidates: candidates.size, mappings: capabilities.mapping.length };
}
