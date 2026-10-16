import {expect,test} from 'bun:test';
import {inspectTestPoolDocument,testPoolSelectorDefaults} from '../../src/lms/testPoolInspection';
import {sourceDomParser,AcademyHttpClient} from '../../src/lms/academyHttpClient';
test('TestPool inspection exports structure without executing write controls or exporting private values',()=>{
  const html='<iframe src="/common/etest_pool.jsp"></iframe><input name="teacher" value="synthetic-private"><select name="unit"><option value="secret-id">label</option></select><button onclick="create()">생성</button><script>function create(){fetch("/common/etest_pool.jsp")}globalThis.executed=true</script>';
  const result=inspectTestPoolDocument(html,sourceDomParser.parseFromString);
  expect(result.etestPoolTabReferenced).toBe(true);expect(result.controls[1]!.optionCount).toBe(1);
  expect(result.functionNames).toEqual(['create']);expect(result.sourceHandlersExecuted).toBe(false);
  expect(JSON.stringify(result)).not.toContain('synthetic-private');expect(JSON.stringify(result)).not.toContain('secret-id');
  expect((globalThis as any).executed).toBeUndefined();
});
test('session error scripts are authentication failures, even under HTTP 200',()=>{
  expect(()=>inspectTestPoolDocument('<script>top.location.href="/error/normal_session_error.jsp"</script>',sourceDomParser.parseFromString)).toThrow('test_pool_authentication_required');
});
test('unauthenticated index inspection sends no requests',async()=>{
  let calls=0;const client=new AcademyHttpClient({teacherLabel:'Synthetic',teacherKey:'1',collegeKey:'2'},async()=>{calls++;return new Response('');});
  await expect(client.inspectTestPoolIndex()).rejects.toThrow('authentication_required');expect(calls).toBe(0);
});
test('selector scope requires exact rendered literals and rejects missing or conflicting defaults',()=>{
  const source='var make_school_key=0; var category_iden="SYNTHETIC"; var categ_type="0";';
  expect(testPoolSelectorDefaults(source)).toEqual({make_school_key:'0',category_iden:'SYNTHETIC',categ_type:'0'});
  expect(()=>testPoolSelectorDefaults(source+'var categ_type="1";')).toThrow('test_pool_selector_default_unqualified');
  expect(()=>testPoolSelectorDefaults('var category_iden=guess();')).toThrow('test_pool_selector_default_unqualified');
});
