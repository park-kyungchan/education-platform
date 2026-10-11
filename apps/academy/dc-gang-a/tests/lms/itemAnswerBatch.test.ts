import {expect,test} from 'bun:test';
import {readItemAnswerBatch} from '../../src/lms/itemAnswerBatch';
const body=(key:string)=>({result:'OK',rows:[{id:key,lecture_key:key,outer_lecture_key:'8201',unit_name:'Invented unit',pat_name:'Invented pattern',play_seconds:0,difficulty:1,answer:'1|_|42'}]});
test('a stopped exact-answer batch keeps observations and pending labels without automatic retries',async()=>{
  const requests:string[]=[],retained:string[]=[];
  const result=await readItemAnswerBatch(['8101','8102','8103'],{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async(url)=>{
    const key=new URL(url,'https://dc.gang-a.kr').searchParams.get('lecture_list')!;requests.push(key);if(key==='8102')throw Error('network_failed');return Response.json(body(key));
  }},answer=>{retained.push(answer.identity.lectureKey);});
  expect(requests).toEqual(['8101','8102']);expect(retained).toEqual(['8101']);
  expect(result.pendingLabels).toEqual(['8102','8103']);expect(result.status).toBe('partial');
  expect(result.automaticRetryAllowed).toBe(false);
});
test('persistence failure prevents advancing to another answer',async()=>{
  let calls=0;
  await expect(readItemAnswerBatch(['8101','8102'],{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>{calls++;return Response.json(body('8101'));}},()=>{throw Error('private_persistence_failed');})).rejects.toThrow('private_persistence_failed');
  expect(calls).toBe(1);
});
test('duplicate, oversized and malformed answer batches are refused before fetching',async()=>{
  let calls=0;const environment={origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>{calls++;return Response.json(body('8101'));}};
  for(const labels of [[],['8101','8101'],['08101'],Array.from({length:33},(_,i)=>String(8101+i))])await expect(readItemAnswerBatch(labels,environment,()=>{})).rejects.toThrow('invalid_answer_batch_scope');
  expect(calls).toBe(0);
});
