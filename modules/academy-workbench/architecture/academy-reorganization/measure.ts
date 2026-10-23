import {createHash} from 'node:crypto';
import {readFileSync, existsSync, statfsSync} from 'node:fs';
import {hostname, release, cpus, totalmem, freemem} from 'node:os';
import {join} from 'node:path';

// Read-only, allowlisted survey. It neither invokes agent turns nor reads credentials/student records.
const root = import.meta.dir;
if (existsSync(join(root,'measurement.json'))) throw Error('Preserve the original measurement; capture a successor at a new explicit path.');
const run = (args: string[]) => {
  const r = Bun.spawnSync(args, {stdout: 'pipe', stderr: 'pipe'});
  return {exitCode: r.exitCode, stdout: r.stdout.toString().trim(), stderr: r.exitCode ? r.stderr.toString().slice(0, 500) : ''};
};
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const git = (path: string, ...args: string[]) => run(['git', '-C', path, ...args]).stdout;
const names = ['academy-workbench','education-platform','agent-platform','dc-gang-a','gang-a','math-research-module','math-education'];
const repositories = names.map(id => {
  const path = `/home/palantirkc/projects/${id}`;
  const worktrees = git(path, 'worktree', 'list', '--porcelain').split('\n\n').filter(Boolean).map(block => {
    const rows = block.split('\n');
    return {path: rows.find(s => s.startsWith('worktree '))?.slice(9), commit: rows.find(s => s.startsWith('HEAD '))?.slice(5), branch: rows.find(s => s.startsWith('branch '))?.slice(7) ?? null};
  });
  return {id, path, commit: git(path, 'rev-parse','HEAD'), branch: git(path,'branch','--show-current'), trackedChangeCount: git(path,'status','--porcelain=v1','--untracked-files=no').split('\n').filter(Boolean).length, main: git(path,'rev-parse','refs/heads/main'), observedOriginMain: git(path,'rev-parse','refs/remotes/origin/main'), worktreeCount: worktrees.length, relevantWorktrees: worktrees.filter(x => /academy-|month-end-/.test(x.path ?? '')), unrelatedWorktreeDetailsOmitted: true};
});
const containers = run(['docker','ps','-a','--format','{{json .}}']).stdout.split('\n').filter(Boolean).map(x => JSON.parse(x)).filter(x => x.Names.startsWith('hermes-agent-2q3y-')).map(x => {
  const v = JSON.parse(run(['docker','inspect', x.Names]).stdout)[0];
  return {name: x.Names, id: v.Id, imageId: v.Image, image: x.Image, status: v.State.Status, startedAt: v.State.StartedAt, health: v.State.Health?.Status ?? null, mounts: v.Mounts.map((m: any) => ({type: m.Type, source: m.Source, destination: m.Destination, writable: m.RW}))};
});
const executables = ['codex','claude','grok','grok-cli','muse','antigravity','agy','hermes','herdr','bun','node'].map(name => ({name, path: run(['sh','-c','command -v "$1"','survey',name]).stdout || null}));
const runtimeMetadata = run(['docker','exec','--user','10000:10000','hermes-agent-2q3y-hermes-serve-1','python3','-c',`import pathlib,json,subprocess,hashlib
p=pathlib.Path('/opt/hermes/install-stamp.json'); d=json.loads(p.read_text())
g=lambda *a: subprocess.check_output(['git','-C','/opt/data/workspace/dc-gang-a',*a],text=True).strip()
print(json.dumps({'installStamp':{k:d.get(k) for k in ['commit','baseVersion','displayVersion','distribution','builtAt']},'stampSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'launcherExists':pathlib.Path('/opt/hermes/bin/hermes').is_file(),'tuiEntryExists':pathlib.Path('/opt/hermes/ui-tui/dist/entry.js').is_file(),'profileExists':pathlib.Path('/opt/data/profiles/dc-gang-a-dev').is_dir(),'academyHead':g('rev-parse','HEAD'),'academyTrackedChangeCount':len(g('status','--porcelain=v1','--untracked-files=no').splitlines()),'nativeSessionAndHookAdoption':'not inspected; no startup performed'}))`]);
const agents = JSON.parse(run(['herdr','agent','list']).stdout).result.agents.map((x: any) => ({kind: x.agent, paneId: x.pane_id, tabId: x.tab_id, workspaceId: x.workspace_id, status: x.agent_status, nativeSessionId: x.agent_session?.value ?? null, cwd: x.foreground_cwd ?? x.cwd, agentName: x.name ?? null}));
const sourcePaths = [
  '/home/palantirkc/projects/agent-platform/architecture/capability-source-owners.json',
  '/home/palantirkc/projects/agent-platform/architecture/connector-policy.json',
  '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/records.ts',
  '/home/palantirkc/projects/education-platform/architecture/source-map.json',
  '/home/palantirkc/projects/education-platform/apps/academy/run.ts',
  '/home/palantirkc/projects/academy-workbench/architecture/architecture.json',
  '/home/palantirkc/projects/academy-workbench/harness/module.json',
  '/home/palantirkc/worktrees/academy-context-consolidation-20261021/context/academy-context/catalog.json',
  '/home/palantirkc/worktrees/academy-context-consolidation-20261021/context/academy-context/execution-contracts.ts',
  '/home/palantirkc/worktrees/academy-context-consolidation-20261021/context/academy-context/repository-plan.json',
  '/home/palantirkc/worktrees/academy-context-consolidation-20261021/context/academy-context/reviews/final-964ca56-review.json',
  '/root/.codex/skills/academy-student-context/SKILL.md',
];
const sourcePins = sourcePaths.map(path => ({path, sha256: sha(path), bytes: readFileSync(path).length}));
const cachePath = '/root/.codex/models_cache.json';
const model = JSON.parse(readFileSync(cachePath,'utf8')).models.find((x: any) => x.slug === 'gpt-6-astra');
const fs = statfsSync('/home/palantirkc');
const result = {
  schemaVersion: 'academy.architecture-measurement/1', observedAtUtc: new Date().toISOString(),
  scope: 'Academy reorganization dependencies only; no unrelated service contents, credentials, student originals, native configuration or agent transcript bodies.',
  host: {id: hostname(), kernel: release(), cpuLogical: cpus().length, totalMemoryBytes: totalmem(), freeMemoryBytes: freemem(), diskAvailableBytes: Number(fs.bavail) * Number(fs.bsize)},
  repositories, containers, executables, agents,
  hermes: runtimeMetadata.exitCode === 0 ? JSON.parse(runtimeMetadata.stdout) : {error: runtimeMetadata.stderr},
  reviewerCapability: {requestedModel: 'gpt-6-astra', requestedEffort: 'xhigh', declaredInNativeModelCache: !!model, supportedReasoningLevels: model?.supported_reasoning_levels?.map((x: any) => x.effort) ?? [], cacheIsAccountAccessProof: false, launchPerformed: false},
  versions: {codex: run(['codex','--version']).stdout, claude: run(['claude','--version']).stdout, bun: run(['bun','--version']).stdout, node: run(['node','--version']).stdout, herdr: run(['herdr','--version']).stdout},
  sourcePins,
  changesPerformedBySurvey: [],
  limitations: ['No live academy request, model inference, cross-environment turn or current native hook adoption test.', 'Git status does not establish another Work owner liveness or completion.', 'Other worktrees are counted but unrelated paths and contents are omitted.', 'Executable and model-cache presence are not end-to-end qualification.'],
};
await Bun.write(join(root,'measurement.json'), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({repositories: repositories.length, scopedContainers: containers.length, liveAgents: agents.length, sourcePins: sourcePins.length, output: join(root,'measurement.json')}));
