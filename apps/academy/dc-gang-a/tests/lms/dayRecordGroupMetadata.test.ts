import {test,expect} from 'bun:test';
import {JSDOM} from 'jsdom';
import {inspectDayRecordGroupMetadata} from '../../src/lms/dayRecordGroupMetadata';
const parse=(raw:string)=>new JSDOM(raw).window.document;
const page=(extra='')=>`<input name="std_ymd" value="20261019"><input name="teacher_pri_no" value="PRIVATE_OWNER"><select name="grp_seq"><option value="0">전체</option><option value="81">월요일 1부</option><option value="82">월요일 2부</option></select><select name="cls_no"><option value="999">OTHER_NAMESPACE</option></select><table><tr><td>PRIVATE_STUDENT</td></tr></table><script>globalThis.executed=true</script>${extra}`;
test('only exact group namespace and observed source date are projected, with inert source and no student/principal data',()=>{
  const result=inspectDayRecordGroupMetadata(page(),parse,'2026-10-19');
  expect(result.returnedDate).toBe('2026-10-19');expect(result.dateMatches).toBe(true);expect(result.groupSelectorQualified).toBe(true);
  expect(result.selectors).toEqual([{name:'grp_seq',options:[{value:'0',label:'전체'},{value:'81',label:'월요일 1부'},{value:'82',label:'월요일 2부'}]}]);
  expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|OTHER_NAMESPACE|executed|teacher_pri_no|cls_no/);
  expect((globalThis as any).executed).toBeUndefined();
});
test('missing or mismatched date and absent or ambiguous group namespace do not become inferred bindings',()=>{
  expect(inspectDayRecordGroupMetadata(page().replace('name="std_ymd"','name="std_date"'),parse,'2026-10-19')).toMatchObject({returnedDate:null,dateMatches:false});
  expect(inspectDayRecordGroupMetadata(page().replace('20261019','20261018'),parse,'2026-10-19').dateMatches).toBe(false);
  expect(inspectDayRecordGroupMetadata('<select name="cls_no"><option value="81">1부</option></select>',parse,'2026-10-19')).toMatchObject({selectors:[],groupSelectorQualified:false});
  expect(inspectDayRecordGroupMetadata(page('<select name="grp_seq"><option value="83">Other</option></select>'),parse,'2026-10-19').groupSelectorQualified).toBe(false);
});
test('malformed or duplicate IDs, authentication challenges and resource bounds fail closed',()=>{
  for(const value of ['081','-1','1.2','123456789012345678901','no'])expect(()=>inspectDayRecordGroupMetadata(page().replace('value="81"',`value="${value}"`),parse,'2026-10-19')).toThrow();
  expect(()=>inspectDayRecordGroupMetadata(page().replace('value="82"','value="81"'),parse,'2026-10-19')).toThrow();
  expect(()=>inspectDayRecordGroupMetadata(page('<input type="password">'),parse,'2026-10-19')).toThrow();
  expect(()=>inspectDayRecordGroupMetadata(' '.repeat(2_000_001),parse,'2026-10-19')).toThrow();
  expect(()=>inspectDayRecordGroupMetadata(page(),parse,'2026-02-30')).toThrow();
});
