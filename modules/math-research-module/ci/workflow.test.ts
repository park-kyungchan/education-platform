import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mathSourceCi } from './source-contract.ts';
const root = resolve(import.meta.dir, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const workflow = Bun.YAML.parse(read(mathSourceCi.workflow)) as any;
describe('source-safe CI contract', () => {
  test('bounded triggers, read-only token, cancellation and fail-closed gate', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request','push','workflow_dispatch']);
    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.permissions).toEqual(mathSourceCi.permissions);
    expect(workflow.concurrency['cancel-in-progress']).toBe(true);
    const gate = workflow.jobs[mathSourceCi.gate.jobId];
    expect(gate.if).toBe('${{ always() }}');
    expect(gate.needs).toEqual(mathSourceCi.gate.needs);
    expect(gate.steps[0].run).toContain('test "$SYNTHETIC_RESULT" = success && test "$CONTRACT_RESULT" = success && test "$REVIEW_RESULT" = success');
  });
  test('immutable actions, exact toolchains and no persistent credentials', () => {
    for (const job of Object.values(workflow.jobs) as any[]) {
      expect(job['runs-on']).toBe('ubuntu-24.04');
      expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
      expect(job['continue-on-error']).toBeUndefined();
      for (const step of job.steps) {
        expect(step['continue-on-error']).toBeUndefined();
        if (step.uses) expect(step.uses).toMatch(/^[\w./-]+@[0-9a-f]{40}$/);
        if (step.uses?.startsWith('actions/checkout@')) expect(step.with['persist-credentials']).toBe(false);
        if (step.uses?.startsWith('oven-sh/setup-bun@')) expect(step.with['bun-version']).toBe(mathSourceCi.runtime.bun);
        if (step.uses?.startsWith('actions/setup-node@')) expect(step.with['node-version']).toBe(mathSourceCi.runtime.node);
        if (step.uses?.includes('/.github/actions/bun-source@')) {
          expect(step.uses).toBe(mathSourceCi.sharedAction);
          expect(step.with['project-id']).toBe(mathSourceCi.owner.projectId);
          expect(step.with.repository).toBe(mathSourceCi.owner.repository);
          expect(step.with['source-sha']).toBe(mathSourceCi.sourceSha);
          expect(step.with['source-author-metadata']).toBe(mathSourceCi.sourceAuthorMetadata);
          expect(step.with['bun-version']).toBe(mathSourceCi.runtime.bun);
          expect(step.with['install-dependencies']).toBeUndefined();
          expect(step.env).toBeUndefined();
        }
      }
    }
  });
  test('generated canonical core and owner review pins need no private checkout', () => {
    const pin = JSON.parse(read('harness/agent-platform.lock.json'));
    const core=JSON.parse(read('ci/generated/canonical-api.manifest.json')),review=JSON.parse(read(mathSourceCi.nativeReview.policyPath));
    expect(pin.commit).toBe('ffba2462a08b9f8c83c6f87b1043403e5cb748d7');
    expect(core.source.commit).toBe(pin.commit);expect(core.source.inputs).toHaveLength(55);
    expect(review.source.commit).toMatch(/^[a-f0-9]{40}$/);expect(review.source.commit).not.toBe(pin.commit);
    expect(review.policy.repository).toBe(mathSourceCi.owner.repository);
    expect(review.policy.projectId).toBe(mathSourceCi.owner.projectId);
    expect(review.policy.semanticOwner).toBe(mathSourceCi.owner.projectId);expect(review.policy.domainId).toBe(mathSourceCi.owner.domainId);
    const project=JSON.parse(read('project.json'));
    expect(project.projectId).toBe(mathSourceCi.owner.projectId);expect(project.domainId).toBe(mathSourceCi.owner.domainId);
    for(const job of Object.values(workflow.jobs) as any[])for(const step of job.steps)if(step.uses?.startsWith('actions/checkout@'))expect(step.with?.repository).toBeUndefined();
    expect(JSON.parse(read('package.json')).packageManager).toBe(`bun@${mathSourceCi.runtime.bun}`);
  });
  test('canonical exact-head native review cannot self-approve or execute native tools', () => {
    const review = workflow.jobs[mathSourceCi.nativeReview.jobId];
    expect(review.permissions).toEqual({contents:'read',statuses:'read'});
    const step = review.steps.find((s:any) => s.run?.includes('ci/native-review.ts'));
    expect(step.run).toBe('bun --no-env-file ci/native-review.ts');
    expect(step.env.REVIEW_HEAD_SHA).toBe(mathSourceCi.sourceSha);
    expect(step.env.GITHUB_TOKEN).toBe('${{ github.token }}');
    expect(Object.keys(step.env).sort()).toEqual(['GITHUB_TOKEN','REVIEW_HEAD_SHA']);
    expect(read('ci/native-review.entry.ts')).toContain('ownerScopedReviewGate(policy)');
    expect(read('ci/native-review.ts')).toContain('loadOwnerReviewProjection()');
    expect(JSON.parse(read(mathSourceCi.nativeReview.policyPath)).policy.publisher).toEqual({id:'241037670',login:'park-kyungchan',type:'User'});
    expect(review.if).toBeUndefined();
  });
  test('frozen installs, required verification and no native effects or secret setup', () => {
    const raw = read(mathSourceCi.workflow);
    expect(raw).not.toMatch(/secrets\.|pull_request_target|id-token:|contents: write|statuses: write|upload-artifact|workflow_run:/);
    for (const line of raw.split('\n').filter(s => /bun .*install /.test(s))) {
      expect(line).toContain('--frozen-lockfile'); expect(line).toContain('--ignore-scripts');
    }
    const scripts = JSON.parse(read('package.json')).scripts;
    const commands = (job:any) => job.steps.flatMap((step:any) => {
      if (!step.uses?.includes('/.github/actions/bun-source@')) return [step.run??''];
      return JSON.parse(step.with.scripts).map((name:string) => {
        expect(typeof scripts[name]).toBe('string');
        return scripts[name];
      });
    }).join('\n');
    for(const [id,contract] of Object.entries(mathSourceCi.sourceJobs)) {
      const job=workflow.jobs[id];
      expect(job.env??{}).toEqual(contract.env);
      const checkouts=job.steps.filter((step:any)=>step.uses?.startsWith('actions/checkout@'));
      expect(checkouts).toHaveLength(1);
      expect(checkouts[0].with['fetch-depth']).toBe(0);
      const shared=job.steps.filter((step:any)=>step.uses===mathSourceCi.sharedAction);
      expect(shared).toHaveLength(1);
      expect(JSON.parse(shared[0].with.scripts)).toEqual(contract.scripts);
    }
    const synthetic = commands(workflow.jobs.synthetic);
    for (const command of ['ci/verify-projection.ts','test ci/workflow.test.ts',scripts.check]) expect(synthetic).toContain(command);
    const contracts = commands(workflow.jobs.contracts);
    for (const command of ['ci/verify-projection.ts',scripts.verify,'ci/check-identity.ts']) expect(contracts).toContain(command);
  });
  test('all64 aggregate outcomes accept only all-success',async()=>{
    const states=['success','failure','cancelled','skipped'];
    for(const synthetic of states)for(const contracts of states)for(const review of states){
      const child=Bun.spawn(['bash','-c',workflow.jobs[mathSourceCi.gate.jobId].steps[0].run],{env:{SYNTHETIC_RESULT:synthetic,CONTRACT_RESULT:contracts,REVIEW_RESULT:review},stdout:'pipe',stderr:'pipe'});
      expect((await child.exited)===0).toBe(synthetic==='success'&&contracts==='success'&&review==='success');
    }
  });
});
