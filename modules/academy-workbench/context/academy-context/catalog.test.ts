import { describe, expect, test } from 'bun:test';
import catalogJson from './catalog.json';
import { selectContext } from './select.ts';
import { validateCatalog } from './validate.ts';
import { readingPlan } from './reading-plan.ts';
import { runContextCli } from './cli.ts';

describe('actual academy metadata integration', () => {
  test('every in-scope workflow has complete, bounded and duplicate-free continuation', () => {
    const catalog = validateCatalog(catalogJson);
    for (const topic of catalog.topics.filter(row => row.kind === 'workflow' && !catalog.scope.excluded.includes(row.id))) {
      const ids: string[] = [];
      let cursor: string | undefined;
      let total = 0;
      do {
        const page = selectContext(catalog, { topicId: topic.id, maxBytes: 16384, ...(cursor ? { cursor } : {}) });
        expect(Buffer.byteLength(JSON.stringify(page))).toBe(page.usedBytes);
        expect(page.usedBytes).toBeLessThanOrEqual(16384);
        ids.push(...page.items.map(item => item.value.id));
        total = page.closure.itemCount;
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(ids.length).toBe(total);
      expect(new Set(ids).size).toBe(total);
    }
  });
  test('required reference intake stays smaller than discovery and preserves actual class duties', () => {
    const plan = readingPlan(catalogJson, 'academy.class-preparation');
    expect(plan.requiredReferenceIds).toContain('SRC-DC-CLASSROOM');
    expect(plan.requiredReferenceIds).toContain('SRC-CURRENT-NAVIGATION');
    expect(plan.requiredReferenceIds).toContain('SRC-CLASS-TIMETABLE-GUIDE');
    const source = catalogJson.sources.find(row => row.id === 'SRC-CLASS-TIMETABLE-GUIDE');
    expect(source?.path).toBe('context/class-timetable/README.ko.md');
    expect(plan.requiredReferenceIds.length).toBeLessThan(plan.discoveryReferenceIds.length);
    expect(plan.sourceBodiesLoaded).toBe(false);
    expect(plan.nativePermissionGranted).toBe(false);
  });
  test('excluded workflows and malformed CLI requests fail without source access', async () => {
    expect(() => selectContext(catalogJson, { topicId: 'academy.parent-communication' })).toThrow('topic-outside-scope');
    expect(() => readingPlan(catalogJson, 'academy.counseling')).toThrow();
    await expect(runContextCli(['select', '--topic', 'academy.class-preparation', '--max-bytes', '1e9'])).rejects.toThrow();
    await expect(runContextCli(['inspect', '--topic', 'academy.class-preparation'])).rejects.toThrow();
  });
  test('entrypoint preserves unknown coverage and dates do not confer permission', async () => {
    const value = await runContextCli(['inspect']);
    expect(value).toMatchObject({ authority: 'none', nativePermissionGranted: false, defaultNavigation: ['date','class','student'], coverage: { complete: false, denominator: null }, sourceBodiesLoaded: false });
  });
});
