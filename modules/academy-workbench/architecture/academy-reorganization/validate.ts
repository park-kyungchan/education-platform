import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import assert from 'node:assert/strict';
import type {ArchitecturePacket} from './contracts.ts';

// Domain-local topology checks only. Common Work validation is performed by the owner below.
const root = import.meta.dir;
const load = (name: string) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const a = load('architecture.json'), i = load('identity-plan.json'), e = load('execution-plan.json');
const c = load('capability-matrix.json'), m = load('measurement.json'), continuity = load('continuity.json');
const topology = load('topology.json');
const packet: ArchitecturePacket = {modules: a.modules, dependencyEdges: a.dependencyEdges, works: i.proposedWorks, nodes: e.nodes, reviewer: e.reviewer, capabilities: c.rows};
let assertions = 0;
const check = (condition: unknown, message: string) => {assert(condition, message); assertions++;};
function acyclic(nodes: string[], edges: {from: string; to: string}[], label: string) {
  const set = new Set(nodes), visiting = new Set<string>(), visited = new Set<string>();
  check(set.size === nodes.length, `${label}: duplicate node`);
  for (const x of edges) check(set.has(x.from) && set.has(x.to), `${label}: missing endpoint`);
  const visit = (n: string) => {
    check(!visiting.has(n), `${label}: cycle at ${n}`);
    if (visited.has(n)) return;
    visiting.add(n);
    edges.filter(x => x.from === n).forEach(x => visit(x.to));
    visiting.delete(n); visited.add(n);
  };
  nodes.forEach(visit);
}
acyclic(packet.nodes.map(n => n.id), packet.nodes.flatMap(n => n.dependsOn.map(to => ({from:n.id,to}))), 'execution');
acyclic(packet.modules.map(n => n.id), packet.dependencyEdges, 'module-use');
acyclic(topology.nodes.map((n: {id: string}) => n.id), topology.edges, 'infrastructure');
const workKeys = packet.works.map(w => `${w.projectId}/${w.id}`);
check(new Set(workKeys).size === workKeys.length,'duplicate qualified Work identity');
for (const n of packet.nodes) check(packet.works.some(w => w.id === n.workId),'outcome references missing Work');
for (const w of packet.works) {
  const expected = w.projectId === 'education-platform' ? 'education' : 'academy-operations';
  check(w.domainId === expected,'preserve owner Project domain');
  if (w.registration === 'proposed-not-created') check(w.tabId === null && w.nativeSessionId === null && w.accountableSubLead === null,'proposed Work fabricates assignment');
}
const reviewer = packet.reviewer;
check(reviewer.requestedModel === 'gpt-6-astra' && reviewer.requestedEffort === 'xhigh','requested reviewer assignment changed');
check(reviewer.paneId === null && reviewer.tabId === null && reviewer.nativeSessionId === null,'review dispatched before approval');
check(reviewer.launchState === 'not-launched-awaiting-architecture-approval','approval gate missing');
check(packet.capabilities.length === 6 && new Set(packet.capabilities.map(x=>x.environmentId)).size === 6,'per-environment capability coverage missing');
for (const x of packet.capabilities) check(x.configured.academyCommonHarnessAdoption === 'unknown' && x.behaviorallyVerified.actualWorkTurn === null,'installation generalized into adoption');
// These observations belong to the approved historical design. Retain the exact common source
// version after its independently maintained main advances; fresh divergence is recorded separately.
const commonPrefix='/home/palantirkc/projects/agent-platform/';
const {loadSourceAuditor,sourceAuditorSelection}=await import('./source-auditor.ts');
await loadSourceAuditor();
for (const pin of m.sourcePins) {
  let bytes:Uint8Array;
  if(pin.path.startsWith(commonPrefix)){
    const observed=Bun.spawnSync(['git','-C',sourceAuditorSelection.root,'show',`${sourceAuditorSelection.commit}:${pin.path.slice(commonPrefix.length)}`],{stdout:'pipe',stderr:'pipe'});
    check(observed.exitCode===0,'historical common source is unavailable');bytes=observed.stdout;
  }else bytes=readFileSync(pin.path);
  check(createHash('sha256').update(bytes).digest('hex')===pin.sha256,`source drift: ${pin.path}`);
}
check(e.serialization.length >= 4,'shared operational resources not coordinated');
check(e.integrationPolicy.automaticMerge === false && e.integrationPolicy.publication === 'held','publication hold changed');
check(continuity.inFlightDelegations.length === 0,'unapproved in-flight delegation');
check(continuity.priorResults.length >= 3,'preserved completed work omitted');
check(i.preservedWorks.length >= 6,'historical Work identities omitted');
for (const f of load('entrypoint.json').files) check(existsSync(join(root, f)),`missing entrypoint target: ${f}`);
const metadata = JSON.stringify([a,i,e,c,continuity]);
check(!/stu_[a-f0-9]{20}|sk-proj-|Bearer [A-Za-z0-9]/.test(metadata),'private identifier or credential in portable design');
console.log(JSON.stringify({valid: true, assertions, works: packet.works.length, outcomeNodes: packet.nodes.length, environments: packet.capabilities.length, reviewerDispatched: false}));

// Pin before use. This is an external auditor, not an upgrade of ffba Academy consumption.
if (Bun.argv.includes('--canonical')) {
  const commonRoot = sourceAuditorSelection.root;
  const head = Bun.spawnSync(['git','-C',commonRoot,'rev-parse','HEAD'],{stdout:'pipe'}).stdout.toString().trim();
  check(head === '712f90deac0676e662dc5d75d88d89f7b6773bfe','external common audit source changed');
  const dirty = Bun.spawnSync(['git','-C',commonRoot,'status','--porcelain=v1','--untracked-files=no'],{stdout:'pipe'}).stdout.toString().trim();
  check(dirty === '', 'external common audit source has tracked changes');
  const expected = m.sourcePins.find((p: {path: string}) => p.path === '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/records.ts');
  check(!!expected,'external audit source hash missing');
  check(createHash('sha256').update(readFileSync(`${commonRoot}/packages/work-continuity/src/git-work/records.ts`)).digest('hex')===expected.sha256,'selected auditor differs from historical admitted bytes');
  const {openGitWork,validateGitWorkRecords,validateGitWorkTransition} = await loadSourceAuditor();
  const repositoryRoot = resolve(root,'../..');
  const commitArg = Bun.argv.indexOf('--commit');
  const commit = commitArg >= 0 ? Bun.argv[commitArg+1] : Bun.spawnSync(['git','rev-parse','HEAD'],{cwd:repositoryRoot,stdout:'pipe'}).stdout.toString().trim();
  const selection = {repositoryRoot, repositoryId:'park-kyungchan/academy-workbench', projectId:'academy-workbench', workId:'academy-architecture-orchestration-20261021', commit};
  const reader = await openGitWork(selection);
  const snapshot = await validateGitWorkRecords(reader);
  const fromIndex = Bun.argv.indexOf('--from');
  const transition = fromIndex >= 0 ? await validateGitWorkTransition(await openGitWork({...selection,commit:Bun.argv[fromIndex+1]}),reader) : null;
  console.log(JSON.stringify({canonicalAuditorCommit:head, candidateCommit:commit, snapshot, transition, scope:'canonical Work records; not native adoption, operational activation or user acceptance'}));
  if (!snapshot.valid || transition && !transition.valid) process.exitCode = 1;
}
