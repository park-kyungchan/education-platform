import {expect,test} from 'bun:test';
test('inert function extraction ends at its own balanced body and ignores quoted/comment braces',async()=>{
 const module=await import('../../src/lms/sourceFunctionText').catch(()=>({selectSourceFunction:undefined}));expect(typeof module.selectSourceFunction).toBe('function');
 const source='function goPage(page){const q="}"; /* } */ if(page){document.search.action="/read";} }\nconst otherStudent="withheld";';
 const result=module.selectSourceFunction!(source,'goPage');expect(result).toContain('document.search.action');expect(result).not.toContain('otherStudent');expect(()=>module.selectSourceFunction!('function goPage(){','goPage')).toThrow();
});
