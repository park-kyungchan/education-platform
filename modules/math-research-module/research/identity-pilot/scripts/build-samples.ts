import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { findMathModuleRoot } from '../src/paths.ts';
import { emptyCore, makeRevision, ref } from '../src/identity.ts';
import { assertValid } from '../src/validation.ts';
import { BUNDLE_SCHEMA } from '../src/schema.ts';
import { EDGE_RULES, TYPE_LAYER } from '../src/model.ts';
import type { Bundle, Core, EntityType, Revision, Relation } from '../src/model.ts';
const base = resolve(import.meta.dirname, '..');
const moduleBase = findMathModuleRoot(base);
const sourcePrefix = relative(base, moduleBase).split(sep).join('/');
const harnessRelative = process.env.MATH_HARNESS_RECORDS ?? 'harness/records.json';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const bundle: Bundle = { schemaVersion: '0.1.0-pilot', semanticOwner: 'math-research-module', namespace: 'mred', registryScope: 'module-local-pilot', coverage: { fixtureCount: 3, realLearnersDiagnosed: 0, full105TypesDiagnosed: false }, authority: { nativePermissionGranted: false, actualAcceptanceInferred: false, grantsExecution: false }, revisions: [], edges: [], presentations: [], harnessRecords: [], workContexts: [], crosswalk: [] };
let serial = 1;
const add = (type: EntityType, label: string, core: Core, path = [TYPE_LAYER[type], type, label]): Revision => {
  // These are permanently pinned fixture identities, not a production deterministic issuer.
  const r = makeRevision({ id: `mred:00000000-0000-4000-8000-${(serial++).toString(16).padStart(12, '0')}`, version: 1, type, classification: { label, semanticPath: path }, core });
  bundle.revisions.push(r); return r;
};
const edge = (relation: Relation, from: Revision, to: Revision) => bundle.edges.push({ id: `edge-${String(bundle.edges.length + 1).padStart(3, '0')}`, relation, from: ref(from), to: ref(to) });
const family = {
  DATA: add('concept_family', '수학적 대상과 과제', emptyCore('자료·개념·맥락 과제의 module-local 분류')),
  LOGIC: add('reasoning_family', '근거 기반 추론', emptyCore('관찰에서 제한된 주장과 검증 가능한 가설로 이어지는 추론')),
  ACTION: add('action_family', '탐색 및 교수 행위', emptyCore('행동 정의와 실제 실행 기록을 별도 identity로 구분')),
  GOVERNANCE: add('governance_family', '출처와 검토', emptyCore('출처·검토·수락·권한 정책은 별개의 기록')),
};
const syntheticCases = [
  { caseId: 'synthetic-multiplication', item: '24×3을 (20+4)×3으로 나누어 설명하시오.', observation: '가상의 학습자가 20×3+4×3=72를 쓰고 두 부분 모두 세 배라고 말했다.', claim: '이 한 장면에서는 분해된 각 부분에 같은 배수를 적용한 설명이 관찰되었다.', hypothesis: '부분 전체 관계를 보존하며 분배할 수 있을 가능성이 있다.', strategy: '20과 4로 분해한 뒤 각각 세 배하는 전략을 사용했을 가능성이 있다.', concept: '분배와 전체 양 보존', probe: '24×3에서 20×3+4는 왜 다르며 34×3에서도 같은 설명이 되는지 확인한다.', counter: '가상의 반례 응답: 34×3을 30×3+4로 적었다.', limitation: '한 문항의 가상 발화이며 절차 모방·힌트 의존을 배제하지 못한다.', legacyId: 'HM11-d3-T02', file: 'multiplication_designs.json', pointer: '/HM11-d3-T02', adapted: true },
  { caseId: 'synthetic-division', item: '84÷2에서 십 8개를 먼저 둘로 나누면 무엇을 얻는가?', observation: '가상의 학습자가 십 4개라고 말하고 40을 적은 뒤 일 2개를 합쳐 42를 적었다.', claim: '이 한 장면에서는 몫의 숫자와 십 단위를 함께 표현했다.', hypothesis: '같은 단위를 유지한 채 등분하는 능력이 작동했을 가능성이 있다.', strategy: '십과 일을 분리하여 등분한 뒤 다시 합치는 전략 가설이다.', concept: '등분과 단위 보존', probe: '86÷2와 84÷3에서 단위 보존과 남은 십의 교환을 따로 확인한다.', counter: '가상의 반례 응답: 남은 십을 일 1개로 처리했다.', limitation: '나누어떨어지는 사례 하나로 교환이 필요한 나눗셈까지 일반화하지 않는다.', legacyId: 'HD11-d1-T01', file: 'division_designs.json', pointer: '/designs/0', adapted: true },
  { caseId: 'synthetic-circle', item: '침을 K에 고정하고 벌림 3cm를 유지해 그린 원의 중심을 설명하시오.', observation: '가상의 학습자가 K를 고르고 종이를 옮겨도 고정점 역할은 같다고 말했다.', claim: '이 한 장면에서는 종이의 위치보다 고정된 기준점의 역할을 사용했다.', hypothesis: '원의 중심을 일정한 거리의 기준점으로 파악할 가능성이 있다.', strategy: '움직이지 않는 침과 움직이는 연필 끝을 대비하는 전략 가설이다.', concept: '원의 중심과 등거리', probe: '글자와 종이 방향을 바꾸고, 기준점이 움직이는 경우도 구별하게 한다.', counter: '가상의 반례 응답: 기준점이 움직여도 벌림만 같으면 K 중심의 원이라고 말했다.', limitation: '발화 하나로 등거리 정의의 일반적 이해나 실제 작도 능력을 확정하지 않는다.', legacyId: 'HC11-d1-T01', file: 'circle_designs.json', pointer: '/designs/0', adapted: true },
];
writeFileSync(resolve(base, 'samples/synthetic-observations.json'), JSON.stringify({ synthetic: true, realLearnerRecords: false, cases: syntheticCases }, null, 2) + '\n');
const syntheticPath = 'samples/synthetic-observations.json';
const observationSource = add('source_document', '합성 관찰 fixture', { ...emptyCore('자동 검증용 가상 사례 3개. 실제 학생 기록이 아니다.', 'recorded'), details: { sourcePath: syntheticPath, sha256: sha(readFileSync(resolve(base, syntheticPath))), synthetic: true } });
edge('part_of', observationSource, family.DATA);
const legacyCrosswalk: unknown[] = [];
const fixtures: Record<string, Record<string, string>> = {};
for (const data of syntheticCases) {
  const file = `source/archive/research_review/${data.file}`;
  const bytes = readFileSync(resolve(moduleBase, file));
  let selected: any = JSON.parse(bytes.toString());
  for (const segment of data.pointer.slice(1).split('/')) selected = selected[segment];
  if ((selected.typeId ?? selected.subtypeId) !== data.legacyId) throw new Error(`Legacy pointer mismatch ${data.legacyId}`);
  const source = add('source_document', `${data.legacyId} 원 설계자료`, { ...emptyCore('사용자가 제공한 연구 설계 원문. 학습효과나 인지구인 검증 자료로 간주하지 않는다.', 'recorded'), synthetic: false, details: { sourcePath: `${sourcePrefix}/${file}`, sha256: sha(bytes), jsonPointer: data.pointer, legacyId: data.legacyId } });
  const sourceClaim = add('source_claim', `${data.legacyId} 설계 의도`, { ...emptyCore(selected.targetStructure ?? '기존 설계의 제한된 구조 설명', 'reported'), sourceRefs: [ref(source)], limitations: ['프로젝트 저작 설계 의도이며 원저자 인증·학습효과·잠재능력 구인 타당화를 의미하지 않는다.'], synthetic: false });
  const concept = add('atomic_concept', data.concept, emptyCore(`${data.concept}을 이번 module-local 분석에서 하나의 개념 단위로 다룬다.`));
  const unit = add('contextual_unit', `${data.concept} 맥락 단위`, emptyCore('개념·표상·조건·과제의 결합. 개념 자체와 다른 identity다.'));
  const item = add('item', data.caseId, { ...emptyCore(data.item), sourceRefs: [ref(source)], details: { adaptedFromLegacyId: data.legacyId, exactCopy: false } });
  const observation = add('observation', `${data.caseId} 최초 관찰`, { ...emptyCore(data.observation, 'observed'), sourceRefs: [ref(observationSource)], targetRefs: [ref(item)], details: { fixtureCaseId: data.caseId, subjectKind: 'synthetic_learner' } });
  const claim = add('evidence_claim', `${data.caseId} 제한된 주장`, { ...emptyCore(data.claim, 'inference'), evidenceRefs: [ref(observation)], limitations: [data.limitation] });
  const probe = add('probe_definition', `${data.caseId} 확인·반증 과제`, emptyCore(data.probe));
  const capability = add('capability_hypothesis', `${data.caseId} 능력 가설`, { ...emptyCore(data.hypothesis, 'hypothesis'), evidenceRefs: [ref(claim)], probeRefs: [ref(probe)], limitations: [data.limitation] });
  const strategy = add('strategy_hypothesis', `${data.caseId} 전략 가설`, { ...emptyCore(data.strategy, 'hypothesis'), evidenceRefs: [ref(claim)], probeRefs: [ref(probe)], limitations: [data.limitation] });
  const rule = add('diagnostic_rule', `${data.caseId} 탐색 규칙`, { ...emptyCore('주장과 관찰을 함께 읽고 추가 probe의 지지·반박 결과를 분리해 기록한다.', 'rule'), targetRefs: [ref(capability), ref(strategy)] });
  const definition = add('action_definition', `${data.caseId} 설명 요청 정의`, emptyCore('교사는 학생에게 조건을 바꿔 같은 설명이 성립하는지 물어본다.'));
  const event = add('teacher_action', `${data.caseId} 가상 교사 행위`, { ...emptyCore('테스트 fixture 안에서만 설명 요청이 실행된 것으로 기록한다.', 'recorded'), sourceRefs: [ref(observationSource)], details: { occurredAt: '2026-10-13T00:00:00Z', actorRole: 'teacher', synthetic: true } });
  const counterObservation = add('observation', `${data.caseId} 반박 관찰`, { ...emptyCore(data.counter, 'observed'), sourceRefs: [ref(observationSource)], targetRefs: [ref(item)], details: { subjectKind: 'synthetic_learner', phase: 'probe' } });
  edge('is_a', concept, family.DATA); edge('part_of', unit, family.DATA); edge('part_of', item, unit); edge('uses', unit, concept); edge('uses', item, concept);
  edge('observes', observation, item); edge('supports', observation, claim); edge('supports', claim, capability); edge('supports', claim, strategy); edge('supports', sourceClaim, capability);
  edge('probes', probe, capability); edge('probes', probe, strategy); edge('refutes', counterObservation, capability); edge('refutes', counterObservation, strategy); edge('observes', counterObservation, item);
  edge('uses', definition, rule); edge('uses', rule, definition); // Intentionally valid cycle in the full relation graph.
  edge('instance_of', event, definition); edge('derived_from', sourceClaim, source);
  for (const r of [source, observation, counterObservation]) edge('part_of', r, family.DATA);
  for (const r of [claim, capability, strategy, rule]) edge('part_of', r, family.LOGIC);
  for (const r of [probe, definition, event]) edge('part_of', r, family.ACTION);
  edge('part_of', sourceClaim, family.GOVERNANCE);
  for (const tone of ['neutral', 'teacher-warm', 'teacher-concise'] as const) bundle.presentations.push({ id: `${data.caseId}-${tone}`, subject: ref(capability), semanticCoreHash: capability.semanticCoreHash, renderMode: 'exact-core', tone, language: 'ko' });
  legacyCrosswalk.push({ relation: 'adaptedFrom', research: ref(item), legacyId: data.legacyId, sourcePath: file, sourceSha256: sha(bytes), jsonPointer: data.pointer, exactCopy: false, preservesOriginalBytes: true });
  fixtures[data.caseId] = { concept: concept.id, unit: unit.id, item: item.id, observation: observation.id, claim: claim.id, capability: capability.id, strategy: strategy.id, probe: probe.id, rule: rule.id, definition: definition.id, event: event.id, counterObservation: counterObservation.id };
}
const provenance = add('provenance_record', '원문 및 합성자료 분리', { ...emptyCore('원문 hash와 locator, 가상 관찰 출처를 구분하여 보존한다.', 'recorded'), sourceRefs: [ref(observationSource)] });
const review = add('review_record', '타당화 범위 검토 대기', { ...emptyCore('필드·관계 규약 검증과 교육학적·경험적 타당화는 별개의 검토다.', 'pending'), targetRefs: [ref(provenance)] });
const acceptance = add('acceptance_record', '별도 사용자 수락 대기', emptyCore('구현 테스트 성공은 실제 사용자 수락으로 간주하지 않는다.', 'pending'));
const policy = add('authorization_policy', '연구 기록의 비권한성', { ...emptyCore('연구 문서·ID·정책 정의는 native 실행 권한을 부여하지 않는다.'), details: { nativePermissionGranted: false, grantsExecution: false } });
for (const r of [provenance, review, acceptance, policy]) edge('part_of', r, family.GOVERNANCE);
const recordsPath = resolve(moduleBase, harnessRelative);
if (existsSync(recordsPath)) {
  const bytes = readFileSync(recordsPath); const parsed = JSON.parse(bytes.toString());
  const records = Array.isArray(parsed) ? parsed : parsed.artifacts ?? parsed.records;
  if (!Array.isArray(records)) throw new Error('Unknown harness record container');
  for (const h of records) bundle.harnessRecords.push({ id: h.id, projectId: h.projectId, kind: h.kind, sourcePath: `${sourcePrefix}/${harnessRelative}`, sourceSha256: sha(bytes) });
  const task = records.find((h: any) => h.kind === 'task'); const run = records.find((h: any) => h.kind === 'run');
  for (const r of bundle.revisions) {
    if (task) bundle.crosswalk.push({ relation: 'createdBy', research: ref(r), harnessArtifactId: task.id });
    if (run) bundle.crosswalk.push({ relation: 'uses', research: ref(r), harnessArtifactId: run.id });
  }
}
const workPath = resolve(moduleBase, 'harness/work-context.json');
if (existsSync(workPath)) { const bytes = readFileSync(workPath); const w = JSON.parse(bytes.toString()); bundle.workContexts.push({ projectId: w.projectId, workId: w.workId, sourcePath: `${sourcePrefix}/harness/work-context.json`, sourceSha256: sha(bytes) }); }
assertValid(bundle);
writeFileSync(resolve(base, 'schemas/research-bundle.schema.json'), JSON.stringify(BUNDLE_SCHEMA, null, 2) + '\n');
writeFileSync(resolve(base, 'schemas/relation-registry.json'), JSON.stringify({ semanticOwner: 'math-research-module', rules: EDGE_RULES }, null, 2) + '\n');
writeFileSync(resolve(base, 'samples/research-bundle.json'), JSON.stringify(bundle, null, 2) + '\n');
writeFileSync(resolve(base, 'samples/fixture-index.json'), JSON.stringify(fixtures, null, 2) + '\n');
writeFileSync(resolve(base, 'samples/legacy-crosswalk.json'), JSON.stringify({ schemaVersion: '0.1.0-pilot', semanticOwner: 'math-research-module', relationMeaning: 'adaptedFrom is not identity equality; original IDs remain untouched', entries: legacyCrosswalk }, null, 2) + '\n');
console.log(`Created ${bundle.revisions.length} revision records, ${bundle.edges.length} typed edges, ${bundle.crosswalk.length} source-pinned harness links; 3 synthetic cases, 0 real diagnoses.`);
