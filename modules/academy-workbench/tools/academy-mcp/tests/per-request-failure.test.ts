import { expect, test } from 'bun:test';
import { DailyRecordService } from '../src/dailyrecord.ts';
import { backend, clock, context, learningPolicy, observation, safeguard } from './dailyrecord-fixture.ts';

test('P4: a failed read closes only that request; the next request is judged fresh', async () => {
  let calls = 0;
  const flaky = backend(() => {
    calls++;
    if (calls === 1) throw new Error('synthetic_source_failure');
    return observation();
  });
  const service = new DailyRecordService(flaky, safeguard, () => clock, learningPolicy);
  const first = await service.intake({ context: context() });
  expect(first.sourceAvailability).toBe('unavailable');
  const second = await service.intake({ context: context() });
  expect(second.sourceAvailability).toBe('observed');
  expect(calls).toBe(2); // one attempt per request, no automatic retry
});

test('P4: an unavailable read does not latch metadata or later reads', async () => {
  let calls = 0;
  const flaky = backend((() => {
    calls++;
    if (calls === 1) return { status: 'unavailable' as const, reasonCode: 'synthetic_unavailable' };
    return observation();
  }) as never);
  const service = new DailyRecordService(flaky, safeguard, () => clock, learningPolicy);
  const first = await service.intake({ context: context() });
  expect(first.sourceAvailability).toBe('unavailable');
  const second = await service.intake({ context: context() });
  expect(second.sourceAvailability).toBe('observed');
});
