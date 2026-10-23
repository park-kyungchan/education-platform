import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { moduleRoot, readPin } from '../../scripts/agent-platform.ts';
import { validateHandoff } from '../../scripts/check-onboarding.ts';
const json = async (path: string) => JSON.parse(await readFile(resolve(moduleRoot, path), 'utf8'));
const records = await json('harness/records.json');
const handoff = await json('harness/current-handoff.json');
const pin = await readPin();
test('dated handoff joins to the preserved Project, Domain, Work, Task and Run', () => {
  expect(validateHandoff(handoff, records, pin.commit).projectId).toBe(handoff.projectId);
});
for (const field of ['domainId', 'projectId', 'projectArtifactId']) test(`handoff rejects mismatched ${field}`, () => {
  const bad = structuredClone(handoff); bad[field] += '-different';
  expect(() => validateHandoff(bad, records, pin.commit)).toThrow('identity');
});
test('handoff rejects stale source pin, wrong Work relation and unobserved authority claims', () => {
  expect(() => validateHandoff(handoff, records, '0'.repeat(40))).toThrow('source pin');
  const badWork = structuredClone(handoff); badWork.historicalWork.workId += '-different';
  expect(() => validateHandoff(badWork, records, pin.commit)).toThrow('identity');
  for (const field of ['globallyRegistered', 'nativePermissionGranted', 'acceptanceDecisionObserved']) {
    const bad = structuredClone(handoff); bad[field] = true;
    expect(() => validateHandoff(bad, records, pin.commit)).toThrow('cannot grant');
  }
});
test('publication evidence cannot silently point at another repository or SHA', () => {
  const bad = structuredClone(handoff); bad.lastObservedPublication.url += '-different';
  expect(() => validateHandoff(bad, records, pin.commit)).toThrow('publication evidence');
});
