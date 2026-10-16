import {expect,test} from 'bun:test';
import {filterItems,requirePreviewData,validDate,validTimeZone} from '../src/model';
import {makeExamples} from '../src/fixtures';
import {inspectExamPreselection,elementaryExamRequirement} from '../../dc-gang-a/src/academy/examSelection';
import {unknown} from '../../dc-gang-a/src/learning/model';

test('filtering preserves original IDs and ordering without forming a paper',()=>{
  const items=makeExamples(),before=JSON.stringify(items);
  const result=filterItems(items,{query:'오류',unit:'나눗셈',completeness:'complete'});
  expect(result.map(item=>item.candidate.sourceItem.literalKey)).toEqual(['demo-004']);
  expect(JSON.stringify(items)).toBe(before);
  expect(result[0]).not.toHaveProperty('points');
});
test('unknown inputs remain explicit and an empty search does not imply an empty source',()=>{
  expect(filterItems(makeExamples(),{query:'없는예시',unit:'',completeness:''})).toEqual([]);
  expect(filterItems(makeExamples(),{query:'',unit:'',completeness:'partial'})).toHaveLength(2);
  const analysis=inspectExamPreselection({kind:'exam_selection_workspace',schemaVersion:1,requirementRevision:elementaryExamRequirement.revision,
    title:'합성 검증',examDate:unknown('미확정'),timeZone:unknown('미확정'),selections:[]},[]);
  const data={schema:'academy.month-end-static-preview.v1',requirement:analysis.requirement,analysis,examples:makeExamples(),sourceMode:'synthetic_examples_only',actualInventory:'unknown'};
  expect(requirePreviewData(data).analysis.coverage.inventoryCompleteness.state).toBe('unknown');
  expect(()=>requirePreviewData({...data,actualInventory:0})).toThrow('preview_boundary_conflict');
  expect(()=>requirePreviewData({...data,examples:[{...data.examples[0],provenance:'real'}]})).toThrow('preview_boundary_conflict');
});
test('calendar validation never supplies a timezone or normalizes invalid dates',()=>{
  expect(validDate('2026-02-30')).toBe(false);expect(validDate('2026-10-31')).toBe(true);
  expect(validTimeZone('')).toBe(false);expect(validTimeZone('not/a-zone')).toBe(false);
  expect(validTimeZone('Asia/Seoul')).toBe(true);
});
