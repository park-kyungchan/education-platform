import {expect,test} from 'bun:test';
import {createJournalRequestAdmission,type JournalUserRequestEvidence} from '../../src/lms/journalRequestAdmission';
import type {JournalHttpAction} from '../../src/lms/lessonJournalHttp';
const request:JournalUserRequestEvidence={runtime:'fictional-runtime',requestRef:'fixture-user-message',requestTextSha256:'1'.repeat(64),currentUserEventRef:'fixture-latest-event'};
const action=():JournalHttpAction=>({attemptId:'fixture-attempt',target:{studentName:'Fictional student',date:'2040-01-21',groupId:'1',teacherKey:'2',studentKey:'3',courseKey:'4',recordKey:'5',membershipKey:'6'},field:'progress',effectRecordKey:'5',before:'',after:'- Fictional supplied lesson',wireDigest:'2'.repeat(64)});
test('runtime-owned current request admits only the exact reviewed action once',async()=>{
 const consumed:string[]=[];const a=action();
 const port=createJournalRequestAdmission({request,actions:[a],owner:{readCurrentRequest:async()=>({...request}),consumeOnce:async key=>{consumed.push(key);return true;}}});
 expect((await port.consumeApproval({...a,after:'foreign'})).status).toBe('rejected');
 expect((await port.consumeApproval(a)).status).toBe('verified');
 expect((await port.consumeApproval(a)).status).toBe('rejected');expect(consumed.length).toBe(1);
});
test('changed latest event or evidence holds before consumption',async()=>{
 for(const changed of [{currentUserEventRef:'new-message'},{requestTextSha256:'3'.repeat(64)},{runtime:'foreign'},{requestRef:'other'}]){
  let writes=0;const a=action();const port=createJournalRequestAdmission({request,actions:[a],owner:{readCurrentRequest:async()=>({...request,...changed}),consumeOnce:async()=>{writes++;return true;}}});
  expect((await port.consumeApproval(a)).status).toBe('rejected');expect(writes).toBe(0);
 }
});
test('durable consumption cannot be renewed by a new attempt ID or output location',async()=>{
 const ledger=new Set<string>();const owner={readCurrentRequest:async()=>({...request}),consumeOnce:async(key:string)=>{if(ledger.has(key))return false;ledger.add(key);return true;}};
 const first=action(),second={...action(),attemptId:'different-attempt'};
 expect((await createJournalRequestAdmission({request,actions:[first],owner}).consumeApproval(first)).status).toBe('verified');
 expect((await createJournalRequestAdmission({request,actions:[second],owner}).consumeApproval(second)).status).toBe('rejected');
});
test('missing or unavailable actual user evidence cannot become a caller approval',async()=>{
 const a=action();expect(()=>createJournalRequestAdmission({request:{...request,requestTextSha256:'approved'},actions:[a],owner:null as any})).toThrow();
 let writes=0;const port=createJournalRequestAdmission({request,actions:[a],owner:{readCurrentRequest:async()=>{throw Error('actual_runtime_event_unavailable');},consumeOnce:async()=>{writes++;return true;}}});
 await expect(port.consumeApproval(a)).rejects.toThrow('actual_runtime_event_unavailable');expect(writes).toBe(0);
});
