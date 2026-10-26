import { expect, test } from 'bun:test';
import { DailyRecordService } from '../src/dailyrecord.ts';
import { backend, clock, context, learningPolicy, safeguard } from './dailyrecord-fixture.ts';

test('P3: without owner-injected backend, intake is unavailable and writes nothing', async () => {
  const service = new DailyRecordService(null, safeguard, () => clock, learningPolicy);
  const result = await service.intake({ context: context() });
  expect(result.status).toBe('held');
  expect(result.blockers).toContain('dailyrecord_read_backend_not_configured');
});

test('P3: with owner-injected fake backend, intake observes the same scope', async () => {
  const service = new DailyRecordService(backend(), safeguard, () => clock, learningPolicy);
  const result = await service.intake({ context: context() });
  expect(result.sourceAvailability).toBe('observed');
  expect(result.fields.length).toBeGreaterThan(0);
});
