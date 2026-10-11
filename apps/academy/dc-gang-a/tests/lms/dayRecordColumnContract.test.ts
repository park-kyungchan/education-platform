import { expect, test } from 'bun:test';
import { currentDayRecordColumns, verifyDayRecordHeaderRows } from '../../src/lms/dayRecordColumnContract';

test('qualifies the actual two-row thirteen-column current/previous-progress header without treating repeated labels as interchangeable',()=>{
  expect(currentDayRecordColumns.headerCells).toHaveLength(13);
  expect(verifyDayRecordHeaderRows(currentDayRecordColumns.headerRows!,currentDayRecordColumns)).toBe(true);
  expect(currentDayRecordColumns.columnGroups.slice(3,7)).toEqual(['previous_progress','previous_progress','previous_progress','previous_progress']);
  expect(currentDayRecordColumns.handlersByColumn[5]).toEqual(['openHomeWorkRate']);
  expect(currentDayRecordColumns.handlersByColumn[10]).toEqual(['onFoPrg']);
});
