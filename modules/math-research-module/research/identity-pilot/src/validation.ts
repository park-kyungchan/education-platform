import { EDGE_RULES, TYPE_LAYER } from './model.ts';
import type { Bundle, Issue, Ref, Revision, Presentation, EntityType } from './model.ts';
import { canonical, hash, key } from './identity.ts';
import { structureErrors } from './schema.ts';

export function validateBundle(input: unknown, previous?: Bundle): Issue[] {
  const issues: Issue[] = structureErrors(input).map(message => ({ code: 'STRUCTURE', path: '$', message }));
  if (issues.length) return issues;
  const bundle = input as Bundle;
  const fail = (code: string, path: string, message: string) => issues.push({ code, path, message });
  try { canonical(input); } catch { fail('NON_JSON', '$', 'Only finite, plain JSON values are accepted'); return issues; }
  const revisions = new Map<string, Revision>();
  const histories = new Map<string, Revision[]>();
  const resolve = (r: Ref, path: string): Revision | undefined => {
    const found = revisions.get(key(r));
    if (!found) fail('DANGLING_REFERENCE', path, key(r));
    return found;
  };
  for (const r of bundle.revisions) {
    const path = `revisions/${key(r)}`;
    if (revisions.has(key(r))) fail('DUPLICATE_REVISION', path, 'An identity/version pair must be unique');
    revisions.set(key(r), r);
    histories.set(r.id, [...histories.get(r.id) ?? [], r]);
    if (TYPE_LAYER[r.type] !== r.layer) fail('WRONG_LAYER', path, 'Type belongs to a different layer');
    if (hash(r.core) !== r.semanticCoreHash) fail('CORE_HASH_MISMATCH', path, 'Semantic core has changed without a new pinned hash');
    const { revisionHash, ...body } = r;
    if (hash(body) !== revisionHash) fail('REVISION_HASH_MISMATCH', path, 'Immutable revision bytes do not match');
    const blocked = new Set(['nativePermissionGranted', 'grantsExecution', 'studentStateEstablished', 'validatedLatentConstruct', 'full105TypesDiagnosed', 'actualAcceptanceInferred']);
    const scan = (value: unknown, at: string): void => {
      if (value && typeof value === 'object') for (const [name, v] of Object.entries(value)) {
        if (blocked.has(name) && v !== false) fail('SECURITY_CLAIM_SEPARATION', `${at}/${name}`, 'Semantic content cannot grant native authority or assert learner cognition');
        scan(v, `${at}/${name}`);
      }
    };
    scan(r.core.details, path);
  }
  for (const [id, history] of histories) {
    const versions = history.map(r => r.version).sort((a, b) => a - b);
    versions.forEach((v, i) => { if (v !== i + 1) fail('VERSION_SEQUENCE', id, 'Pilot bundles include immutable history from revision 1 without gaps'); });
  }
  if (previous) {
    const priorIssues = validateBundle(previous);
    if (priorIssues.length) fail('INVALID_BASELINE', '$', 'Previous bundle must itself pass validation');
    for (const old of previous.revisions) {
      const current = revisions.get(key(old));
      if (!current || canonical(current) !== canonical(old)) fail('IMMUTABLE_REVISION', key(old), 'Previously published revisions cannot be removed or overwritten');
    }
    const currentEdges = new Map(bundle.edges.map(e => [e.id, e]));
    for (const old of previous.edges) {
      const current = currentEdges.get(old.id);
      if (!current || canonical(current) !== canonical(old)) fail('IMMUTABLE_EDGE', old.id, 'Historical revision-pinned edges cannot be rewritten; add a new entity revision and edge');
    }
  }
  for (const r of bundle.revisions) {
    const path = `revisions/${key(r)}`;
    for (const field of ['evidenceRefs', 'sourceRefs', 'targetRefs', 'probeRefs'] as const) {
      const seen = new Set<string>();
      r.core[field].forEach(target => {
        const k = key(target);
        if (seen.has(k)) fail('DUPLICATE_REFERENCE', `${path}/${field}`, k);
        seen.add(k); resolve(target, `${path}/${field}`);
      });
    }
    const types = (refs: Ref[]) => refs.map(x => revisions.get(key(x))?.type);
    if (types(r.core.sourceRefs).some(t => t !== 'source_document' && t !== 'source_claim' && t !== 'provenance_record')) fail('WRONG_SOURCE_TYPE', path, 'Source references must address source/provenance objects');
    if (types(r.core.evidenceRefs).some(t => !['observation', 'evidence_claim', 'source_claim'].includes(t ?? ''))) fail('WRONG_EVIDENCE_TYPE', path, 'Evidence must be observations or bounded claims, never a policy or acceptance');
    if (types(r.core.probeRefs).some(t => t !== 'probe_definition')) fail('WRONG_PROBE_TYPE', path, 'Probe refs must be probe definitions');
    if (r.type === 'observation' && (r.core.epistemicStatus !== 'observed' || !r.core.sourceRefs.length || !r.core.targetRefs.length)) fail('OBSERVATION_CONTRACT', path, 'Observations require source, target, and observed status');
    if (r.type === 'evidence_claim' && (r.core.epistemicStatus !== 'inference' || !types(r.core.evidenceRefs).includes('observation') || !r.core.limitations.length)) fail('CLAIM_NEEDS_OBSERVATION', path, 'A learner-oriented evidence claim requires observation and limitations');
    if (r.type === 'capability_hypothesis' || r.type === 'strategy_hypothesis') {
      if (r.core.epistemicStatus !== 'hypothesis' || !types(r.core.evidenceRefs).includes('evidence_claim') || !r.core.probeRefs.length || !r.core.limitations.length)
        fail('HYPOTHESIS_CONTRACT', path, 'Hypotheses require bounded observation-derived claims, a probe/refutation route, and limitations');
    }
    if (r.type === 'diagnostic_rule' && r.core.epistemicStatus !== 'rule') fail('RULE_NOT_DIAGNOSIS', path, 'Diagnostic rules do not certify actual student cognition');
    if (r.type === 'source_claim' && (r.core.epistemicStatus !== 'reported' || !r.core.sourceRefs.length || !r.core.limitations.length)) fail('SOURCE_CLAIM_CONTRACT', path, 'Source claims need source pins and qualifications');
    if (r.type === 'acceptance_record' && r.core.epistemicStatus !== 'pending') fail('ACCEPTANCE_NOT_INFERRED', path, 'Pilot semantic acceptance objects are pending; actual acceptance requires an independently recorded harness decision');
    if (r.type === 'authorization_policy' && (r.core.epistemicStatus !== 'definition' || r.core.details.nativePermissionGranted !== false)) fail('POLICY_NOT_PERMISSION', path, 'A policy definition must explicitly disclaim native permission');
    if (['action_event', 'teacher_action', 'system_action'].includes(r.type)) {
      if (r.core.epistemicStatus !== 'recorded' || typeof r.core.details.occurredAt !== 'string' || !Number.isFinite(Date.parse(r.core.details.occurredAt)) || typeof r.core.details.actorRole !== 'string' || !r.core.sourceRefs.length)
        fail('EVENT_CONTRACT', path, 'Events require timestamp, actor, source and recorded status');
      if ((r.type === 'teacher_action' && r.core.details.actorRole !== 'teacher') || (r.type === 'system_action' && r.core.details.actorRole !== 'system')) fail('ACTOR_TYPE', path, 'Actor role must match event type');
    }
  }
  const edgeIds = new Set<string>();
  const edgeTriples = new Set<string>();
  const graphs = new Map<string, Map<string, string[]>>();
  for (const e of bundle.edges) {
    if (edgeIds.has(e.id)) fail('DUPLICATE_EDGE', e.id, 'Edge ID must be unique');
    edgeIds.add(e.id);
    const triple = `${e.relation}|${key(e.from)}|${key(e.to)}`;
    if (edgeTriples.has(triple)) fail('DUPLICATE_EDGE', e.id, 'Duplicate relation and endpoint tuple');
    edgeTriples.add(triple);
    const from = resolve(e.from, e.id), to = resolve(e.to, e.id);
    if (!from || !to) continue;
    if (from.id === to.id) fail('SELF_EDGE', e.id, 'Relations between revisions of the same identity are not semantic topology');
    const rule = EDGE_RULES[e.relation];
    if (!(rule.domain as readonly EntityType[]).includes(from.type) || !(rule.range as readonly EntityType[]).includes(to.type) || (rule.sameLayer && from.layer !== to.layer)) fail('EDGE_DOMAIN_RANGE', e.id, `Illegal ${from.type} ${e.relation} ${to.type}`);
    if (rule.dag) {
      const graph = graphs.get(rule.dag) ?? new Map<string, string[]>();
      graph.set(key(from), [...graph.get(key(from)) ?? [], key(to)]); graphs.set(rule.dag, graph);
    }
  }
  for (const [name, graph] of graphs) {
    const visited = new Set<string>(), visiting = new Set<string>();
    const walk = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      if ((graph.get(node) ?? []).some(walk)) return true;
      visiting.delete(node); visited.add(node); return false;
    };
    if ([...graph.keys()].some(walk)) fail('ILLEGAL_CYCLE', name, `Only the ${name} subgraph is constrained to a DAG`);
  }
  for (const r of bundle.revisions) if (['action_event', 'teacher_action', 'system_action'].includes(r.type) && !bundle.edges.some(e => e.relation === 'instance_of' && key(e.from) === key(r))) fail('EVENT_DEFINITION_MISSING', key(r), 'An action event must instantiate a separately identified action definition');
  const presentations = new Set<string>();
  for (const p of bundle.presentations) {
    if (presentations.has(p.id)) fail('DUPLICATE_PRESENTATION', p.id, 'Presentation ID must be unique');
    presentations.add(p.id);
    const subject = resolve(p.subject, p.id);
    if (subject && p.semanticCoreHash !== subject.semanticCoreHash) fail('PRESENTATION_CORE_MISMATCH', p.id, 'Tone changes must preserve the pinned semantic core');
  }
  const harness = new Map(bundle.harnessRecords.map(h => [h.id, h]));
  if (harness.size !== bundle.harnessRecords.length) fail('DUPLICATE_HARNESS_RECORD', 'harnessRecords', 'Reference catalog IDs must be unique');
  for (const h of bundle.harnessRecords) {
    if (!h.id.startsWith(`${h.projectId}:${h.kind}:`)) fail('HARNESS_ID_KIND', h.id, 'Must preserve common projectId:kind:suffix semantics');
  }
  const workKeys = new Set<string>();
  for (const w of bundle.workContexts) {
    const id = `${w.projectId}/${w.workId}`;
    if (workKeys.has(id)) fail('DUPLICATE_WORK_CONTEXT', id, 'Project/Work pair must be unique');
    workKeys.add(id);
  }
  const links = new Set<string>();
  for (const c of bundle.crosswalk) {
    resolve(c.research, `crosswalk/${c.relation}`);
    const triple = `${c.relation}/${key(c.research)}/${c.harnessArtifactId}`;
    if (links.has(triple)) fail('DUPLICATE_CROSSWALK', triple, 'Duplicate crosswalk');
    links.add(triple);
    const h = harness.get(c.harnessArtifactId);
    if (!h) { fail('DANGLING_HARNESS_REFERENCE', triple, 'Provide the actual harness source record'); continue; }
    const kinds = c.relation === 'verifiedBy' ? ['verification'] : c.relation === 'acceptedBy' ? ['decision'] : ['task', 'run'];
    if (!kinds.includes(h.kind)) fail('CROSSWALK_KIND', triple, 'Wrong common Artifact kind for this relation');
    if (c.relation === 'verifiedBy') fail('TARGETED_VERIFICATION_REQUIRED', triple, 'Reserved relation: task-level checks cannot verify each research revision. A future owner-reviewed adapter must match exact revision/core hash, criteria, and evidence before admitting verifiedBy');
    if (c.relation === 'acceptedBy') fail('INDEPENDENT_ACCEPTANCE_REQUIRED', triple, 'Reserved relation: actual acceptance is not admitted by this pilot. A future owner-reviewed canonical-source acceptance adapter is required; local mirrors never suffice');
  }
  return issues;
}
export function assertValid(bundle: unknown, previous?: Bundle): asserts bundle is Bundle {
  const issues = validateBundle(bundle, previous);
  if (issues.length) throw new Error(issues.map(x => `${x.code} ${x.path}: ${x.message}`).join('\n'));
}
export function renderPresentation(subject: Revision, presentation: Presentation): { heading: string; statement: string; epistemicStatus: string; evidenceRefs: Ref[]; limitations: string[]; semanticCoreHash: string } {
  if (key(subject) !== key(presentation.subject) || subject.semanticCoreHash !== presentation.semanticCoreHash || hash(subject.core) !== subject.semanticCoreHash || presentation.renderMode !== 'exact-core') throw new Error('Presentation must preserve exact semantic core');
  return { heading: presentation.tone === 'teacher-warm' ? '함께 근거를 살펴봐요' : presentation.tone === 'teacher-concise' ? '관찰과 다음 확인' : '연구 기록', statement: subject.core.statement, epistemicStatus: subject.core.epistemicStatus, evidenceRefs: structuredClone(subject.core.evidenceRefs), limitations: [...subject.core.limitations], semanticCoreHash: subject.semanticCoreHash };
}
