/** Deterministic subprocess clock for lossless serialization tests only. */
const fixed = Date.parse(process.env.WORKFLOW_TEST_CLOCK ?? '2099-01-01T12:00:00Z');
class WorkflowFixedDate extends Date {
  constructor(value?: string | number | Date) {
    super(value === undefined ? fixed : value instanceof Date ? value.getTime() : value);
  }
  static now(): number { return fixed; }
}
globalThis.Date = WorkflowFixedDate as DateConstructor;
export {};
