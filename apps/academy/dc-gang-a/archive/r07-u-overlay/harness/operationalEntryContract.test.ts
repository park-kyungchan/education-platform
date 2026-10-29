import {describe, expect, test} from 'bun:test';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {endpointCli} from '../../harness/endpoints';
import {contextPurposes, entryReadPlan} from '../../harness/context_routing';

const root = resolve(import.meta.dir, '../..');

// Adapted from the retained contract-audit candidate; runs against the actual main consumers.
describe('operational contract adoption at current main entrypoints', () => {
  test('endpoint help and topic select direct HTTP without a browser fallback', () => {
    expect(endpointCli(['--help'])).toMatchObject({
      requiredReadTransport: 'direct_http_api', automaticBrowserFallback: false,
      directClientQualification: 'not_qualified_by_this_contract',
    });
    expect(endpointCli(['--contract-topic', 'source_access'])).toMatchObject({
      topic: 'source_access', authorizesEffects: false,
      selection: {requiredTransport: 'direct_http_api', academyEffect: 'read_only'},
    });
  });
  test('default browser compilation refuses before opening caller paths', () => {
    expect(() => endpointCli(['--prepare-read', '/synthetic/not-opened.json', '--output-script', '/synthetic/not-written.js']))
      .toThrow(/^direct_http_client_required$/);
  });
  test('every current purpose retains its typed policy owner including Bot development', () => {
    const routing = JSON.parse(readFileSync(resolve(root, 'docs/workflow-routing.json'), 'utf8')).contextReadRouting;
    for (const purpose of contextPurposes) {
      const plan = entryReadPlan(root, routing, purpose);
      expect(plan.ok).toBe(true);
      expect(plan.requiredReads.map(r => r.path)).toContain('docs/academy-operational-contract.json');
    }
    const bot = entryReadPlan(root, routing, 'bot_development');
    expect(bot.requiredReads.map(r => r.path)).toContain('docs/bot-development-contract.ts');
    expect(bot.requiredReads.map(r => r.path)).toContain('docs/bot-development-runbook.ts');
  });
  test('actual workflow CLI emits the validated current contract with no effect grant', () => {
    const result = Bun.spawnSync({cmd: [process.execPath, '--no-env-file', resolve(root, 'harness/workflow_checkpoint.ts'), 'context', 'bot_development'], cwd: root, stdout: 'pipe', stderr: 'pipe'});
    expect(result.exitCode).toBe(0);
    const context = JSON.parse(new TextDecoder().decode(result.stdout));
    expect(context.kind).toBe('selected_atomic_workflow_context');
    expect(context.atoms.find((atom: any) => atom.kind === 'effect_boundary').value).toMatchObject({
      profile: 'dc-gang-a-dev', sourceTransport: 'direct_http_api', nativeAuthorityVerified: false,
    });
    expect(context.authorizesProductionEffects).toBe(false);
  });
});
