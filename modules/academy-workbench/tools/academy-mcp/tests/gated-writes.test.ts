import {describe,expect,test} from 'bun:test';
import {chmod,mkdir,mkdtemp,readFile,readdir,rm,symlink,utimes,writeFile} from 'node:fs/promises';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {lmsRequestRole} from './network-deny.ts';
import {ClinicPaperService} from '../src/clinic-write-tools.ts';
import {keptTools,newSurfaceTools,surfaceOrder} from '../src/consolidated-tools.ts';
import {
  BOOK_INCORRECT_WIRE_SHA256,CLINIC_TOOL_FAMILY,CLINIC_WIRE_SHA256,expectedWireHash,wireSha256OfPage,qualifyClinicRequest,writeFields,
} from '../../../../../apps/academy/dc-gang-a/src/lms/clinicPaperWrite.ts';
import {GatedWriteLedger,changeSha256Of,ledgerRefusedRoot,gatedWriteLedgerConfiguration,reviewTokenOf,type AttemptRecord} from '../../../../../apps/academy/dc-gang-a/src/lms/gatedWriteLedger.ts';
import {clinicRequestEffect,testpageSelectExRequestEffect} from '../../../../../apps/academy/dc-gang-a/src/lms/lmsRouteRegistry.ts';
import {
  BOOK,COOKIE_CANARY,COURSE,NAME_CANARY,PAPER,STUDENT,TESTING,TESTING2,bookPage,clinicPage,fixtureLms,fixturePort,pageHashes,scoreAnswer,type FixtureLms,
} from './gated-write-fixture-lms.ts';

// specs/academy-mcp/gated-writes.md R1-R16 for academy_clinic_paper_review and academy_clinic_paper_save. Invented numeric keys, synthetic
// pages whose hashes come through the `expectedWireHashes` seam, and a scratch 0600 ledger: no real student, no live LMS call. The LMS is a
// recorded fixture that answers write_forbidden (403) to a request classed write while the test has not allowed the one reviewed write.
const root=resolve(import.meta.dir,'..'),repo=resolve(root,'../../../..');
const T0=Date.parse('2040-01-16T09:00:00.000Z');
const PAGE_BOOK='/servlet/controller.coursemanage.TextBookManageServlet',PAGE_CLINIC='/servlet/controller.tutor.fa.TestPageListGrpServlet',SELECT='/servlet/controller.common.TestpageSelectExServlet';
const bookInput=(extra:Record<string,unknown>={})=>({kind:'book_incorrect',studentKey:STUDENT,courseKey:COURSE,bookNo:BOOK,...extra});
const clinicInput=(extra:Record<string,unknown>={})=>({kind:'clinic',studentKey:STUDENT,testingNo:TESTING,clinicMode:'multiply',createSimilar:true,...extra});
const SAVE_SCOPE_BOOK=`book_incorrect:${COURSE}:${BOOK}`,SAVE_SCOPE_CLINIC=`clinic:${TESTING}`;

async function scratch(){
  const dir=await mkdtemp(join(tmpdir(),'gated-writes-'));await chmod(dir,0o700);
  return {dir,ledger:join(dir,'ledger.jsonl'),cleanup:()=>rm(dir,{recursive:true,force:true})};
}
function harness(ledger:string|null,options:{lms?:FixtureLms;hashes?:boolean;pidAlive?:(pid:number)=>boolean}={}){
  const lms=options.lms??fixtureLms(),clock={t:T0};
  let n=0;
  const service=new ClinicPaperService(fixturePort(lms),ledger,{now:()=>clock.t,newId:()=>'id-'+(++n),pidAlive:options.pidAlive,
    ...(options.hashes===false?{}:{expectedWireHashes:pageHashes()})});
  const records=()=>existsSync(ledger??'/nonexistent')?readFileSync(ledger!,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];
  return {lms,clock,service,records,
    attempts:()=>records().filter((r:any)=>r.kind==='attempt') as AttemptRecord[],
    async reviewed(input:Record<string,unknown>){const out:any=await service.review(input);expect(out.status).toBe('reviewed');return out;},
    approve:(review:any,extra:Record<string,unknown>={})=>({reviewToken:review.reviewToken,userApproved:true,change:review.change,...extra}),
    async saved(input:Record<string,unknown>){const review=await this.reviewed(input),out:any=await service.save({reviewToken:review.reviewToken,userApproved:true,change:review.change});return {review,out};}};
}
const sig=(lms:FixtureLms)=>lms.requests.map(r=>`${r.method} ${r.route} ${r.role}`);
const write=(lms:FixtureLms)=>lms.writes()[0]!;
const stepsOf=(h:ReturnType<typeof harness>)=>h.attempts().map(a=>a.step+':'+a.state);

// ---- the pinned values and the route classes ---------------------------------------------------------
describe('gated writes: pinned wire values and request classes',()=>{
  test('gated_writes_pins_the_two_production_wire_hashes_exactly',()=>{
    expect(BOOK_INCORRECT_WIRE_SHA256).toBe('4794a5e8353e93f481d3f5cb4bc448c42e0b314413e55068900d51165893bf8c');
    expect(CLINIC_WIRE_SHA256).toBe('3f726b828586a15d3ed7c2071e63207a54cec231f168e1f838ffdae0f75447fa');
    expect(expectedWireHash('book_incorrect')).toBe(BOOK_INCORRECT_WIRE_SHA256);
    expect(expectedWireHash('clinic')).toBe(CLINIC_WIRE_SHA256);
    expect(expectedWireHash('clinic',{clinic:'a'.repeat(64)})).toBe('a'.repeat(64));
    // The synthetic pages never carry the production hashes.
    expect(pageHashes().bookIncorrect).not.toBe(BOOK_INCORRECT_WIRE_SHA256);
    expect(wireSha256OfPage('clinic',bookPage())).toBeNull();
    // Line ends are normalized, so a CRLF page and an LF page of one handler hash alike.
    expect(wireSha256OfPage('book_incorrect',bookPage().replaceAll('\r\n','\n'))).toBe(pageHashes().bookIncorrect);
  });
  test('gated_writes_without_the_test_seam_a_synthetic_page_is_a_wire_hash_mismatch',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger,{hashes:false});
      for(const input of [bookInput(),clinicInput()])expect(await h.service.review(input)).toMatchObject({status:'refused',code:'wire_hash_mismatch',academyWrites:0});
      expect(h.lms.writes()).toEqual([]);
    }finally{await s.cleanup();}
  });
  test('gated_writes_route_classes_read_only_without_a_create_flag_and_write_otherwise',()=>{
    const form=(process:string,condition?:unknown)=>{const f=new URLSearchParams({p_process:process});if(condition!==undefined)f.set('condition',typeof condition==='string'?condition:JSON.stringify(condition));return f.toString();};
    const flags=(over:Record<string,unknown>={})=>({testing_no:88001,pri_no:77001,student_name:'',score:{create:1},incorrect:{create:0},similar:{create:0},advance:{create:0},report:{create:0},...over});
    const single='getStudyResultSingleTestingSingleUser',multi='getStudyResultMultiTestingMultiUser';
    const table:[string,string,'read'|'write'][]=[
      ['getWrongAnswerNoteResult',form('getWrongAnswerNoteResult'),'read'],['getTestExamList',form('getTestExamList'),'read'],
      // the existing read callers: a score view with score.create 1 and the other flags 0
      [single,form(single,flags()),'read'],['getStudyResultSingleTestingMultiUser',form('getStudyResultSingleTestingMultiUser',flags()),'read'],[multi,form(multi,flags()),'read'],
      [single,form(single,flags({incorrect:{create:1}})),'write'],[single,form(single,flags({similar:{create:1,mode:'divide',exam_cnt:2}})),'write'],
      [single,form(single,flags({advance:{create:1}})),'write'],[multi,form(multi,flags({incorrect:{create:1}})),'write'],
      // a body-less or malformed condition is write
      [single,form(single),'write'],[multi,form(multi),'write'],['getStudyResultSingleTestingMultiUser',form('getStudyResultSingleTestingMultiUser'),'write'],
      [single,form(single,'{not json'),'write'],[single,form(single,'[]'),'write'],[single,form(single,'"x"'),'write'],[single,form(single,'null'),'write'],
      [single,form(single,flags({incorrect:null})),'write'],[single,form(single,flags({similar:{create:'1'}})),'write'],[single,form(single,flags({advance:[]})),'write'],
      ['somethingElse',form('somethingElse'),'write'],
    ];
    for(const [operation,body,expected] of table){
      expect({operation,body,registry:testpageSelectExRequestEffect(operation,body)}).toEqual({operation,body,registry:expected});
      expect({operation,body,registry:testpageSelectExRequestEffect(operation,new URLSearchParams(body)),denyTable:lmsRequestRole('https://dc.gang-a.kr'+SELECT,body,'POST')})
        .toEqual({operation,body,registry:expected,denyTable:expected});
      expect({operation,body,standalone:clinicRequestEffect('POST',SELECT,operation,body)}).toEqual({operation,body,standalone:expected});
    }
    // No body at all.
    for(const operation of ['getStudyResultSingleTestingSingleUser','getStudyResultSingleTestingMultiUser','getStudyResultMultiTestingMultiUser']){
      expect(testpageSelectExRequestEffect(operation)).toBe('write');
      expect(lmsRequestRole(`https://dc.gang-a.kr${SELECT}?p_process=${operation}`)).toBe('write');
    }
  });
  test('gated_writes_route_classes_the_two_wire_pages_read',()=>{
    for(const url of [`https://dc.gang-a.kr${PAGE_BOOK}?reqCmd=getTextBookMain`,`https://dc.gang-a.kr${PAGE_CLINIC}?p_process=Main`])expect(lmsRequestRole(url,undefined,'GET')).toBe('read');
    expect(clinicRequestEffect('GET',PAGE_BOOK,'getTextBookMain')).toBe('read');
    expect(clinicRequestEffect('GET',PAGE_CLINIC,'Main')).toBe('read');
    for(const [path,operation] of [[PAGE_BOOK,'getTextBookSave'],[PAGE_CLINIC,'Save'],['/servlet/controller.other.Servlet','Main']])expect(clinicRequestEffect('GET',path!,operation!)).toBe('write');
    expect(lmsRequestRole(`https://dc.gang-a.kr${PAGE_BOOK}?reqCmd=getTextBookDelete`)).toBe('write');
  });
});

// ---- R1, R2: review ----------------------------------------------------------------------------------
describe('gated writes R1, R2: the review',()=>{
  test('gated_writes_r1_review_sends_only_read_requests_and_reads_the_live_page',async()=>{
    const s=await scratch();
    try{
      const lms=fixtureLms();lms.state.allowWrite=false;
      const h=harness(s.ledger,{lms});
      const book:any=await h.service.review(bookInput());
      expect(book).toMatchObject({status:'reviewed',kind:'book_incorrect',wireSha256:pageHashes().bookIncorrect,academyWrites:0,
        change:{kind:'book_incorrect',studentKey:STUDENT,courseKey:COURSE,bookNo:BOOK,testingNos:[TESTING]}});
      expect(sig(lms)).toEqual([`GET ${PAGE_BOOK} getTextBookMain read`,`POST ${SELECT} getWrongAnswerNoteResult read`]);
      lms.requests.length=0;
      const clinic:any=await h.service.review(clinicInput());
      expect(clinic).toMatchObject({status:'reviewed',kind:'clinic',wireSha256:pageHashes().clinic,scopeKey:SAVE_SCOPE_CLINIC});
      expect(sig(lms)).toEqual([`GET ${PAGE_CLINIC} Main read`]);
      expect(lms.writes()).toEqual([]);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r1_a_drifted_or_missing_handler_is_a_wire_hash_mismatch_with_0_write_requests',async()=>{
    const s=await scratch();
    try{
      for(const [kind,input,drift] of [['book_incorrect',bookInput(),bookPage('var n = 2; return n + 1;')],['clinic',clinicInput(),clinicPage('var m = 9; return m;')],
        ['book_incorrect',bookInput(),'<html>no handler</html>'],['clinic',clinicInput(),clinicPage().replace('externOnCreateOneClinicPaper','somethingElse')],
        ['clinic',clinicInput(),clinicPage()+clinicPage()]] as const){
        const lms=fixtureLms();lms.state.allowWrite=false;lms.state.pages[kind]=drift;
        const out:any=await harness(s.ledger,{lms}).service.review(input);
        expect({kind,status:out.status,code:out.code,writes:lms.writes().length}).toEqual({kind,status:'refused',code:'wire_hash_mismatch',writes:0});
      }
      expect(readFileSync(s.ledger,'utf8')).toBe('');
    }finally{await s.cleanup();}
  });
  test('gated_writes_r2_the_review_token_is_the_sha256_of_the_canonical_change_scope_wire_hash_and_expiry',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger);
      const first:any=await h.reviewed(clinicInput()),again:any=await h.reviewed(clinicInput());
      expect(first.expiresAt).toBe(new Date(T0+15*60*1000).toISOString());
      expect(first.reviewToken).toMatch(/^[a-f0-9]{64}$/);
      expect(again.reviewToken).toBe(first.reviewToken);
      expect(first.reviewToken).toBe(reviewTokenOf({tool:CLINIC_TOOL_FAMILY,change:first.change,studentKey:STUDENT,scopeKey:SAVE_SCOPE_CLINIC,wireSha256:pageHashes().clinic,expiresAt:first.expiresAt}));
      h.clock.t+=1000;
      expect((await h.reviewed(clinicInput())).reviewToken).not.toBe(first.reviewToken);
      expect((await h.reviewed(clinicInput({createAdvance:true}))).reviewToken).not.toBe(first.reviewToken);
      const reviewed=h.records().filter((r:any)=>r.kind==='reviewed')[0];
      expect(reviewed).toEqual({kind:'reviewed',tool:CLINIC_TOOL_FAMILY,reviewToken:first.reviewToken,changeSha256:changeSha256Of(first.change),studentKey:STUDENT,scopeKey:SAVE_SCOPE_CLINIC,
        wireSha256:pageHashes().clinic,reviewedAt:new Date(T0).toISOString(),expiresAt:first.expiresAt});
    }finally{await s.cleanup();}
  });
});

// ---- the exact wire of the write -----------------------------------------------------------------------
describe('gated writes: the posted condition',()=>{
  const sim=(over:Record<string,unknown>={})=>({create:1,mode:'multiply',exam_cnt:1,...over});
  const cond=(similar:unknown,advance:unknown)=>({testing_no:Number(TESTING),pri_no:Number(STUDENT),student_name:'',score:{create:0},incorrect:{create:0},similar,advance,report:{create:0}});
  const pats=[{pat_no:3,d4_cnt:1,d3_cnt:0,d2_cnt:2,d1_cnt:0},{pat_no:7,d4_cnt:0,d3_cnt:0,d2_cnt:0,d1_cnt:4}];
  const cases:[string,Record<string,unknown>,unknown][]=[
    ['multiply similar default',{clinicMode:'multiply',createSimilar:true},cond(sim(),{create:0})],
    ['multiply similar 20',{clinicMode:'multiply',createSimilar:true,similarCount:20},cond(sim({exam_cnt:20}),{create:0})],
    ['multiply advance',{clinicMode:'multiply',createAdvance:true},cond({create:0},sim())],
    ['multiply advance count 1',{clinicMode:'multiply',createAdvance:true,advanceCount:1},cond({create:0},sim())],
    ['multiply both',{clinicMode:'multiply',createSimilar:true,similarCount:3,createAdvance:true},cond(sim({exam_cnt:3}),sim())],
    ['divide similar default',{clinicMode:'divide',createSimilar:true},cond(sim({mode:'divide',exam_cnt:10}),{create:0})],
    ['divide similar 100',{clinicMode:'divide',createSimilar:true,similarCount:100},cond(sim({mode:'divide',exam_cnt:100}),{create:0})],
    ['divide advance default',{clinicMode:'divide',createAdvance:true},cond({create:0},sim({mode:'divide',exam_cnt:10}))],
    ['divide both',{clinicMode:'divide',createSimilar:true,similarCount:4,createAdvance:true,advanceCount:6},cond(sim({mode:'divide',exam_cnt:4}),sim({mode:'divide',exam_cnt:6}))],
    ['custom similar',{clinicMode:'custom',createSimilar:true,patList:pats},cond({create:1,mode:'custom',exam_cnt:0,pat_list:pats},{create:0})],
    ['custom advance',{clinicMode:'custom',createAdvance:true},cond({create:0},{create:1,mode:'custom',exam_cnt:1})],
    ['custom both',{clinicMode:'custom',createSimilar:true,patList:pats,createAdvance:true,advanceCount:1},cond({create:1,mode:'custom',exam_cnt:0,pat_list:pats},{create:1,mode:'custom',exam_cnt:1})],
    ['similar flag false',{clinicMode:'divide',createSimilar:false,createAdvance:true,advanceCount:2},cond({create:0},sim({mode:'divide',exam_cnt:2}))],
  ];
  test('gated_writes_clinic_posts_the_exact_condition_for_every_mode_and_flag_combination',async()=>{
    const s=await scratch();
    try{
      let n=0;
      for(const [label,extra,expected] of cases){
        const h=harness(join(s.dir,`case-${n++}.jsonl`));
        const {review,out}=await h.saved({...clinicInput(),createSimilar:undefined,...extra});
        expect({label,status:out.status}).toEqual({label,status:'saved'});
        const posted=write(h.lms);
        expect({label,process:posted.process,method:posted.method,route:posted.route}).toEqual({label,process:'getStudyResultSingleTestingSingleUser',method:'POST',route:`${SELECT} getStudyResultSingleTestingSingleUser`});
        const raw=new URLSearchParams(posted.body).get('condition')!;
        expect({label,condition:JSON.parse(raw)}).toEqual({label,condition:expected});
        // Exact text: members in the order of the page's own program, similar and advance without members of a flag that is off.
        expect({label,raw}).toEqual({label,raw:JSON.stringify(expected)});
        expect(review.postedParameters).toEqual({path:SELECT,p_process:'getStudyResultSingleTestingSingleUser',condition:expected});
        expect(h.lms.writes()).toHaveLength(1);
      }
      expect(writeFields(qualifyClinicRequest(clinicInput({clinicMode:'divide'})) as any).p_process).toBe('getStudyResultSingleTestingSingleUser');
    }finally{await s.cleanup();}
  });
  test('gated_writes_clinic_refuses_inputs_that_do_not_fit_the_mode_before_any_request',async()=>{
    const s=await scratch();
    try{
      const bad:Record<string,unknown>[]=[
        {createSimilar:undefined},{createSimilar:false},{createSimilar:false,createAdvance:false},{clinicMode:undefined},{clinicMode:'triple'},
        {clinicMode:'multiply',createAdvance:true,advanceCount:2},{clinicMode:'multiply',similarCount:0},{clinicMode:'multiply',similarCount:21},{clinicMode:'multiply',similarCount:1.5},
        {clinicMode:'divide',similarCount:101},{clinicMode:'divide',similarCount:0},{clinicMode:'divide',createAdvance:true,advanceCount:101},
        {clinicMode:'multiply',patList:[{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0}]},{clinicMode:'divide',patList:[]},
        {clinicMode:'custom'},{clinicMode:'custom',patList:[]},{clinicMode:'custom',patList:[{pat_no:1,d4_cnt:0,d3_cnt:0,d2_cnt:0,d1_cnt:0}]},
        {clinicMode:'custom',patList:[{pat_no:0,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0}]},{clinicMode:'custom',patList:[{pat_no:1,d4_cnt:-1,d3_cnt:1,d2_cnt:0,d1_cnt:0}]},
        {clinicMode:'custom',patList:[{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0}]},{clinicMode:'custom',patList:[{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0,extra:1}]},
        {clinicMode:'custom',patList:[{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0},{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0}]},
        {clinicMode:'custom',patList:[{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0}],similarCount:2},{clinicMode:'custom',createSimilar:false,createAdvance:true,patList:[{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0}]},
        {clinicMode:'custom',createAdvance:true,advanceCount:2,patList:[{pat_no:1,d4_cnt:1,d3_cnt:0,d2_cnt:0,d1_cnt:0}]},
        {createSimilar:false,createAdvance:true,similarCount:2},{courseKey:COURSE},{bookNo:BOOK},{testingNos:[TESTING]},{unknownMember:1},
      ];
      for(const extra of bad){
        const lms=fixtureLms(),h=harness(s.ledger,{lms});
        const out:any=await h.service.review({...clinicInput(),...extra});
        expect({extra,status:out.status,code:out.code,requests:lms.requests.length}).toEqual({extra,status:'refused',code:expect.stringMatching(/^(clinic_input_invalid|public_scope_forbidden)$/) as unknown as string,requests:0});
      }
      for(const extra of [{clinicMode:'divide',similarCount:101},{createSimilar:false},{unknownMember:1}])
        expect((await harness(s.ledger).service.review({...clinicInput(),...extra}) as any).code).toBe('clinic_input_invalid');
    }finally{await s.cleanup();}
  });
  test('gated_writes_book_incorrect_posts_the_single_or_multi_user_condition_of_the_frozen_testing_numbers',async()=>{
    const s=await scratch();
    try{
      const one=harness(s.ledger);
      const {review,out}=await one.saved(bookInput());
      expect(out).toMatchObject({status:'saved',kind:'book_incorrect',academyWrites:1});
      const single=write(one.lms);
      expect(single.process).toBe('getStudyResultSingleTestingSingleUser');
      const singleCondition={testing_no:Number(TESTING),pri_no:Number(STUDENT),student_name:'',score:{create:0},incorrect:{create:1},similar:{create:0},advance:{create:0},report:{create:0}};
      expect(single.condition).toEqual(singleCondition);
      expect(new URLSearchParams(single.body).get('condition')).toBe(JSON.stringify(singleCondition));
      expect(review.change.testingNos).toEqual([TESTING]);

      const many=harness(s.ledger);many.lms.state.noteTestingNos=[TESTING2,TESTING,TESTING];
      const multi=await many.saved(bookInput());
      expect(multi.review.change.testingNos).toEqual([TESTING,TESTING2]);
      expect(multi.out).toMatchObject({status:'saved'});
      const multiPost=write(many.lms);
      const multiCondition={score:{create:0},incorrect:{create:1},similar:{create:0},advance:{create:0},report:{create:0},
        user_list:[{pri_no:Number(STUDENT),student_name:'',testing_list:[{testing_no:Number(TESTING)},{testing_no:Number(TESTING2)}]}]};
      expect(multiPost.process).toBe('getStudyResultMultiTestingMultiUser');
      expect(multiPost.condition).toEqual(multiCondition);
      expect(new URLSearchParams(multiPost.body).get('condition')).toBe(JSON.stringify(multiCondition));

      // Explicit testing numbers are validated against the wrong-note list and frozen as given.
      const explicit=harness(s.ledger);explicit.lms.state.noteTestingNos=[TESTING,TESTING2];
      expect((await explicit.reviewed(bookInput({testingNos:[TESTING2]}))).change.testingNos).toEqual([TESTING2]);
      expect(await explicit.service.review(bookInput({testingNos:['88999']}))).toMatchObject({status:'refused',code:'clinic_scope_unresolved'});
      const empty=harness(s.ledger);empty.lms.state.noteTestingNos=[];
      expect(await empty.service.review(bookInput())).toMatchObject({status:'refused',code:'clinic_scope_unresolved'});
      const foreign=harness(s.ledger);foreign.lms.state.noteAnswer=()=>JSON.stringify({result:'ok',noteResultList:[{pri_no:78888,cls_no:Number(COURSE),testing_no:Number(TESTING)}]});
      expect(await foreign.service.review(bookInput())).toMatchObject({status:'refused',code:'clinic_scope_unresolved'});
    }finally{await s.cleanup();}
  });
  const liveNote=(rows:Record<string,unknown>[])=>JSON.stringify({result:'ok',noteResultList:rows.map(r=>({cls_no:0,apply_date:'03-14',p_no:Number(PAPER),name:NAME_CANARY,testing_name:'Invented wrong note',testing_no:Number(TESTING),pri_no:Number(STUDENT),...r}))});
  test('clinic_book_incorrect_cls_no_zero_rows_are_in_scope',async()=>{
    const s=await scratch();
    try{
      // The live shape: cls_no is 0 on every row; the request scope names the one course, book and student.
      const live=harness(s.ledger);live.lms.state.noteAnswer=()=>liveNote([{testing_no:Number(TESTING2)},{testing_no:Number(TESTING)}]);
      const review=await live.reviewed(bookInput());
      expect(review.change.testingNos).toEqual([TESTING,TESTING2]);
      const post=live.lms.requests.find(r=>r.process==='getWrongAnswerNoteResult')!;
      expect(JSON.parse(new URLSearchParams(post.body).get('answerNoteResult')!)).toEqual({courseKeyList:[COURSE],bookNoList:[BOOK],userKeyList:[STUDENT]});
      // The course key itself is still accepted as cls_no.
      const keyed=harness(s.ledger);keyed.lms.state.noteAnswer=()=>liveNote([{cls_no:Number(COURSE)}]);
      expect((await keyed.reviewed(bookInput())).change.testingNos).toEqual([TESTING]);
      // A row of another student is never in scope, whatever its cls_no.
      const foreign=harness(s.ledger);foreign.lms.state.noteAnswer=()=>liveNote([{pri_no:78888}]);
      expect(await foreign.service.review(bookInput())).toMatchObject({status:'refused',code:'clinic_scope_unresolved'});
      const missing=harness(s.ledger);missing.lms.state.noteAnswer=()=>liveNote([{pri_no:undefined}]);
      expect(await missing.service.review(bookInput())).toMatchObject({status:'refused',code:'clinic_scope_unresolved'});
    }finally{await s.cleanup();}
  });
  test('clinic_book_incorrect_cls_no_other_course_refuses_clinic_scope_unresolved',async()=>{
    const s=await scratch();
    try{
      for(const cls of [Number(COURSE)+1,-1,'abc',null,undefined]){
        const other=harness(s.ledger);other.lms.state.noteAnswer=()=>liveNote([{},{cls_no:cls,testing_no:Number(TESTING2)}]);
        expect({cls,out:await other.service.review(bookInput())}).toMatchObject({out:{status:'refused',code:'clinic_scope_unresolved'}});
      }
    }finally{await s.cleanup();}
  });
});

// ---- R3 to R7: refusals found from the input ---------------------------------------------------------
describe('gated writes R3 to R7: refusals before any request',()=>{
  const approvals:[string,unknown][]=[['absent',undefined],['false',false],['string true','true'],['one',1],['null',null],['object',{}]];
  test('gated_writes_r3_save_without_user_approval_true_is_refused_with_0_http_requests',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger),review=await h.reviewed(clinicInput());
      h.lms.requests.length=0;
      for(const [label,value] of approvals){
        const input:Record<string,unknown>={reviewToken:review.reviewToken,change:review.change};if(value!==undefined)input.userApproved=value;
        expect({label,out:await h.service.save(input)}).toMatchObject({label,out:{status:'refused',code:'user_approval_required',academyWrites:0}});
      }
      expect(h.lms.requests).toEqual([]);
      expect(h.attempts()).toEqual([]);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r4_an_unknown_used_foreign_or_changed_token_is_review_token_invalid_with_0_http_requests',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger),review=await h.reviewed(clinicInput({createAdvance:true}));
      h.lms.requests.length=0;
      const refuse=async(label:string,input:unknown)=>expect({label,out:await h.service.save(input)}).toMatchObject({label,out:{status:'refused',code:'review_token_invalid',academyWrites:0}});
      await refuse('unknown token',h.approve({...review,reviewToken:'c'.repeat(64)}));
      await refuse('malformed token',h.approve({...review,reviewToken:'not a token'}));
      await refuse('absent token',{userApproved:true,change:review.change});
      await refuse('absent change',{reviewToken:review.reviewToken,userApproved:true});
      const members:[string,(c:any)=>any][]=[
        ['studentKey',c=>({...c,studentKey:'77002'})],['testingNo',c=>({...c,testingNo:'88002'})],['clinicMode',c=>({...c,clinicMode:'divide'})],
        ['similar count',c=>({...c,similar:{create:1,mode:'multiply',exam_cnt:2}})],['advance off',c=>({...c,advance:{create:0}})],['extra member',c=>({...c,extra:1})],
        ['missing member',c=>{const {advance:_a,...rest}=c;return rest;}],
      ];
      for(const [label,change] of members)await refuse('change differs: '+label,h.approve(review,{change:change(review.change)}));
      // A token of the other tool family is not accepted: write a reviewed record of the exam family (it names targets, never a student) and use it.
      const foreignChange=review.change,foreignExpires=new Date(T0+60000).toISOString(),foreignTargets=['1!'+STUDENT+'!2!31'],foreignScope='fa:'+'c'.repeat(64);
      const foreignToken=reviewTokenOf({tool:'academy_exam_paper',change:foreignChange,targets:foreignTargets,scopeKey:foreignScope,wireSha256:pageHashes().clinic,expiresAt:foreignExpires});
      new GatedWriteLedger(s.ledger).append({kind:'reviewed',tool:'academy_exam_paper',reviewToken:foreignToken,changeSha256:changeSha256Of(foreignChange),targets:foreignTargets,scopeKey:foreignScope,
        wireSha256:pageHashes().clinic,reviewedAt:new Date(T0).toISOString(),expiresAt:foreignExpires});
      await refuse('token of the other tool',h.approve({reviewToken:foreignToken,change:foreignChange}));
      expect(h.lms.requests).toEqual([]);
      // The reviewed change itself still saves, once; the second call finds the token used and sends nothing more.
      expect(await h.service.save(h.approve(review))).toMatchObject({status:'saved'});
      const sent=h.lms.requests.length;
      await refuse('token already used',h.approve(review));
      expect(h.lms.requests).toHaveLength(sent);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r5_a_token_more_than_15_minutes_old_is_review_token_expired_with_0_http_requests',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger),review=await h.reviewed(bookInput());
      h.lms.requests.length=0;
      h.clock.t=T0+15*60*1000+1;
      expect(await h.service.save(h.approve(review))).toMatchObject({status:'refused',code:'review_token_expired',academyWrites:0});
      expect(h.lms.requests).toEqual([]);
      expect(h.attempts()).toEqual([]);
      // The expiry itself is still inside the 15 minutes.
      h.clock.t=T0+15*60*1000;
      expect(await h.service.save(h.approve(review))).toMatchObject({status:'saved'});
    }finally{await s.cleanup();}
  });
  test('gated_writes_r6_a_wire_hash_that_drifted_since_the_review_refuses_before_the_write',async()=>{
    const s=await scratch();
    try{
      for(const [input,kind,page] of [[clinicInput(),'clinic',clinicPage('var m = 3; return m;')],[bookInput(),'book_incorrect',bookPage('var n = 5; return n;')]] as const){
        const h=harness(s.ledger),review=await h.reviewed(input);
        h.lms.requests.length=0;h.lms.state.pages[kind]=page;
        const out:any=await h.service.save(h.approve(review));
        expect({kind,status:out.status,code:out.code,academyWrites:out.academyWrites}).toEqual({kind,status:'refused',code:'wire_hash_mismatch',academyWrites:0});
        expect(sig(h.lms)).toHaveLength(1);
        expect(h.lms.requests[0]).toMatchObject({method:'GET',role:'read'});
        expect(h.lms.writes()).toEqual([]);
        // The token is consumed and the attempt is settled absent: nothing was written.
        expect(stepsOf(h).slice(-2)).toEqual(['before_write:open','reconciled:absent']);
        expect(await h.service.save(h.approve(review))).toMatchObject({code:'review_token_invalid'});
      }
    }finally{await s.cleanup();}
  });
  test('gated_writes_r7_a_key_that_number_cannot_carry_exactly_is_refused_at_review_and_save_with_0_http_requests',async()=>{
    const s=await scratch();
    try{
      const big='9007199254740993',long='1234567890123456',ok15='123456789012345';
      const lms=fixtureLms(),h=harness(s.ledger,{lms});
      for(const [label,input] of [['student',clinicInput({studentKey:big})],['student 16 digits',bookInput({studentKey:long})],['testing',clinicInput({testingNo:big})],
        ['course',bookInput({courseKey:big})],['book',bookInput({bookNo:long})]] as const){
        const out:any=await h.service.review(input);
        expect({label,status:out.status,code:out.code}).toEqual({label,status:'refused',code:'public_scope_forbidden'});
      }
      expect((await h.service.review(bookInput({testingNos:[big]})) as any).code).toBe('clinic_input_invalid');
      for(const change of [{kind:'clinic',studentKey:big,testingNo:TESTING,clinicMode:'multiply',similar:{create:1,mode:'multiply',exam_cnt:1},advance:{create:0}},
        {kind:'book_incorrect',studentKey:STUDENT,courseKey:COURSE,bookNo:BOOK,testingNos:[big]}]){
        const out:any=await h.service.save({reviewToken:'d'.repeat(64),userApproved:true,change});
        expect(out.status).toBe('refused');expect(['public_scope_forbidden','review_token_invalid']).toContain(out.code);
      }
      expect(lms.requests).toEqual([]);
      // Every accepted key is posted as the same number: 15 digits convert exactly.
      const exact=harness(join(s.dir,'exact.jsonl'));
      const {out}=await exact.saved(clinicInput({studentKey:ok15,testingNo:ok15}));
      expect(out.status==='saved'||out.status==='unverified').toBe(true);
      expect(String(write(exact.lms).condition!.pri_no)).toBe(ok15);expect(String(write(exact.lms).condition!.testing_no)).toBe(ok15);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r7_public_all_student_or_missing_scope_is_refused_at_review_and_save_with_0_http_requests',async()=>{
    const s=await scratch();
    try{
      const lms=fixtureLms(),h=harness(s.ledger,{lms});
      const reviews:[string,Record<string,unknown>][]=[
        ['student absent',{...bookInput(),studentKey:undefined}],['student zero',bookInput({studentKey:'0'})],['student all',bookInput({studentKey:'all'})],['student ALL',clinicInput({studentKey:'ALL'})],
        ['student name',bookInput({studentKey:'Invented Student'})],['student number',bookInput({studentKey:77001})],['student negative',bookInput({studentKey:'-1'})],['student list',bookInput({studentKey:['77001','77002']})],
        ['course absent',{...bookInput(),courseKey:undefined}],['course text',bookInput({courseKey:'all'})],['book absent',{...bookInput(),bookNo:undefined}],['book zero',bookInput({bookNo:'0'})],
        ['testing absent',{...clinicInput(),testingNo:undefined}],['testing text',clinicInput({testingNo:'x'})],['testing zero',clinicInput({testingNo:'0'})],
        ['allStudents true',bookInput({allStudents:true})],['allClasses true',clinicInput({allClasses:true})],['academyWide',clinicInput({academyWide:true})],['public flag false',bookInput({public:false})],
        ['publicPool',clinicInput({publicPool:true})],['schoolWide',bookInput({schoolWide:true})],['everyone',bookInput({everyone:1})],['isPublic',clinicInput({isPublic:'no'})],
      ];
      for(const [label,input] of reviews){
        const out:any=await h.service.review(input);
        expect({label,status:out.status,code:out.code,academyWrites:out.academyWrites}).toEqual({label,status:'refused',code:'public_scope_forbidden',academyWrites:0});
      }
      // A save whose change names a public scope is refused for the scope, whatever its token.
      const token='d'.repeat(64);
      for(const change of [{...bookInput(),testingNos:[TESTING],studentKey:'all'},{...bookInput(),testingNos:[TESTING],allStudents:true},{kind:'clinic',studentKey:'0',testingNo:TESTING},
        {kind:'clinic',studentKey:STUDENT,similar:{create:0},advance:{create:0},clinicMode:'multiply',testingNo:'all'}]){
        const out:any=await h.service.save({reviewToken:token,userApproved:true,change});
        expect({change,code:out.code,status:out.status}).toEqual({change,code:'public_scope_forbidden',status:'refused'});
      }
      expect(lms.requests).toEqual([]);
      expect(existsSync(s.ledger)?readFileSync(s.ledger,'utf8'):'').toBe('');
    }finally{await s.cleanup();}
  });
});

// ---- R8, R14: the save --------------------------------------------------------------------------------
describe('gated writes R8, R14: the save and its readback',()=>{
  test('gated_writes_r8_a_save_sends_one_pre_write_read_one_write_and_one_readback_read',async()=>{
    const s=await scratch();
    try{
      const clinic=harness(s.ledger),c=await clinic.saved(clinicInput({createAdvance:true}));
      expect(c.out).toMatchObject({status:'saved',kind:'clinic',scopeKey:SAVE_SCOPE_CLINIC,academyWrites:1,parentSends:0,automaticRetryAllowed:false,readback:'scope_confirmed_by_read_only_request'});
      expect(c.out.printListSha256).toMatch(/^[a-f0-9]{64}$/);expect(c.out.paperKeys).toEqual(['99101']);
      expect(sig(clinic.lms).slice(1)).toEqual([`GET ${PAGE_CLINIC} Main read`,`POST ${SELECT} getStudyResultSingleTestingSingleUser write`,`POST ${SELECT} getStudyResultSingleTestingSingleUser read`]);
      // The readback is the score view of the attempt: score.create 1 and no creation.
      expect(clinic.lms.requests.at(-1)!.condition).toEqual({testing_no:Number(TESTING),pri_no:Number(STUDENT),student_name:'',score:{create:1},incorrect:{create:0},similar:{create:0},advance:{create:0},report:{create:0}});
      const book=harness(join(s.dir,'book.jsonl')),b=await book.saved(bookInput());
      expect(b.out).toMatchObject({status:'saved',kind:'book_incorrect',scopeKey:SAVE_SCOPE_BOOK,academyWrites:1});
      expect(sig(book.lms).slice(2)).toEqual([`GET ${PAGE_BOOK} getTextBookMain read`,`POST ${SELECT} getStudyResultSingleTestingSingleUser write`,`POST ${SELECT} getWrongAnswerNoteResult read`]);
      expect(stepsOf(book)).toEqual(['before_write:open','write_dispatched:open','response_received:open','reconciled:persisted']);
      const done=book.attempts().at(-1)!;
      expect(done).toMatchObject({tool:CLINIC_TOOL_FAMILY,studentKey:STUDENT,scopeKey:SAVE_SCOPE_BOOK,state:'persisted',paperKeys:['99101']});
      expect(done.responseSha256).toMatch(/^[a-f0-9]{64}$/);
      // The lock is released after the call.
      expect(existsSync(s.ledger+'.lock')).toBe(false);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r14_an_unconfirmed_write_answers_unverified_and_keeps_the_attempt_open',async()=>{
    const s=await scratch();
    try{
      const answers:[string,(lms:FixtureLms)=>void,string,string][]=[
        ['empty print_list',lms=>{lms.state.writeAnswer=()=>JSON.stringify({result:'OK',print_list:[]});},'clinic_response_unverified','write_dispatched'],
        ['missing print_list',lms=>{lms.state.writeAnswer=()=>JSON.stringify({result:'OK'});},'clinic_response_unverified','write_dispatched'],
        ['result not OK',lms=>{lms.state.writeAnswer=()=>JSON.stringify({result:'FAIL',print_list:[{exam_list:[{exam_no:1}]}]});},'clinic_response_unverified','write_dispatched'],
        ['paper without exam items',lms=>{lms.state.writeAnswer=()=>JSON.stringify({result:'OK',print_list:[{p_no:1,exam_list:[]}]});},'clinic_response_unverified','write_dispatched'],
        ['exam item without a key',lms=>{lms.state.writeAnswer=()=>JSON.stringify({result:'OK',print_list:[{p_no:1,exam_list:[{lecture_key:1}]}]});},'clinic_response_unverified','write_dispatched'],
        ['another student paper',lms=>{lms.state.writeAnswer=()=>JSON.stringify({result:'OK',print_list:[{pri_no:78888,exam_list:[{exam_no:1}]}]});},'clinic_response_unverified','write_dispatched'],
        ['not json',lms=>{lms.state.writeAnswer=()=>'<html>error</html>';},'clinic_response_unverified','write_dispatched'],
        ['readback refused',lms=>{lms.state.scoreAnswer=()=>new Response('denied',{status:403});},'clinic_readback_unverified','response_received'],
        ['readback without papers',lms=>{lms.state.scoreAnswer=()=>JSON.stringify({result:'OK',print_list:[]});},'clinic_readback_unverified','response_received'],
        ['readback result not OK',lms=>{lms.state.scoreAnswer=()=>JSON.stringify({result:'FAIL'});},'clinic_readback_unverified','response_received'],
      ];
      for(const [label,setup,code,step] of answers){
        const h=harness(s.ledger);setup(h.lms);
        const {out}=await h.saved(clinicInput());
        expect({label,status:out.status,code:out.code,writes:h.lms.writes().length}).toEqual({label,status:'unverified',code,writes:1});
        expect(out).toMatchObject({academyWrites:null,effectStatus:'unknown'});
        expect(h.attempts().at(-1)).toMatchObject({step,state:'open'});
        // No further write is sent by this call, and a second save of the same target is blocked until a review reconciles it.
        expect(h.lms.writes()).toHaveLength(1);
        const second:any=await h.service.review(clinicInput());
        expect({label,second:second.status,code:second.code}).toEqual({label,second:'refused',code:'reconcile_blocks_retry'});
        await rm(s.ledger,{force:true});
      }
      // A book readback that lost one reviewed testing number is unverified too.
      const book=harness(s.ledger);book.lms.state.noteTestingNos=[TESTING,TESTING2];
      const review=await book.reviewed(bookInput());book.lms.state.noteTestingNos=[TESTING];
      expect(await book.service.save(book.approve(review))).toMatchObject({status:'unverified',code:'clinic_readback_unverified'});
    }finally{await s.cleanup();}
  });
  test('gated_writes_r14_a_failed_write_request_leaves_the_attempt_open_at_write_dispatched_and_rejects',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger);h.lms.state.writeAnswer=()=>{throw Error('synthetic_transport_failure');};
      const review=await h.reviewed(clinicInput());
      await expect(h.service.save(h.approve(review))).rejects.toThrow('synthetic_transport_failure');
      expect(stepsOf(h)).toEqual(['before_write:open','write_dispatched:open']);
      expect(h.lms.writes()).toHaveLength(1);
      expect(existsSync(s.ledger+'.lock')).toBe(false);
    }finally{await s.cleanup();}
  });
});

// ---- R10: ledger -------------------------------------------------------------------------------------
describe('gated writes R10: the private attempt ledger',()=>{
  test('gated_writes_r10_an_unset_relative_symlinked_or_loose_ledger_is_ledger_unavailable_before_any_request',async()=>{
    const s=await scratch();
    try{
      await writeFile(join(s.dir,'real.jsonl'),'',{mode:0o600});await symlink(join(s.dir,'real.jsonl'),join(s.dir,'link.jsonl'));
      await writeFile(join(s.dir,'group.jsonl'),'',{mode:0o600});await chmod(join(s.dir,'group.jsonl'),0o640);
      await writeFile(join(s.dir,'world.jsonl'),'',{mode:0o600});await chmod(join(s.dir,'world.jsonl'),0o606);
      await mkdir(join(s.dir,'open'),{mode:0o700});await chmod(join(s.dir,'open'),0o777);
      await mkdir(join(s.dir,'asdir.jsonl'));
      const variants:[string,string|null|undefined][]=[
        ['unset',null],['undefined',undefined],['empty',''],['relative','ledger.jsonl'],['dot relative','./ledger.jsonl'],['symlink',join(s.dir,'link.jsonl')],
        ['group readable',join(s.dir,'group.jsonl')],['world writable file',join(s.dir,'world.jsonl')],['world writable directory',join(s.dir,'open','ledger.jsonl')],
        ['missing directory',join(s.dir,'missing','ledger.jsonl')],['a directory',join(s.dir,'asdir.jsonl')],['not normalized',s.dir+'/../'+s.dir.split('/').at(-1)+'/n.jsonl'],
        ['inside the repository',join(repo,'academy-gated-write-ledger.jsonl')],['inside the module',join(root,'tests','ledger.jsonl')],
      ];
      for(const [label,path] of variants){
        const lms=fixtureLms(),h=harness(path as string|null,{lms});
        const review=await h.service.review(clinicInput());
        expect({label,review:review}).toMatchObject({label,review:{status:'refused',code:'ledger_unavailable',academyWrites:0}});
        const save:any=await h.service.save({reviewToken:'a'.repeat(64),userApproved:true,change:{kind:'clinic',studentKey:STUDENT,testingNo:TESTING,clinicMode:'multiply',similar:{create:1,mode:'multiply',exam_cnt:1},advance:{create:0}}});
        expect({label,save:save.code,status:save.status}).toEqual({label,save:'ledger_unavailable',status:'refused'});
        expect({label,requests:lms.requests.length}).toEqual({label,requests:0});
      }
      expect(existsSync(join(repo,'academy-gated-write-ledger.jsonl'))).toBe(false);
      expect(existsSync(join(root,'tests','ledger.jsonl'))).toBe(false);
      // A launch without the flag and without the variable has no default path.
      expect(gatedWriteLedgerConfiguration(['--other'],{})).toEqual({path:null,remainingArgs:['--other']});
      expect(gatedWriteLedgerConfiguration(['--gated-write-ledger',join(s.dir,'x.jsonl'),'--other'],{ACADEMY_GATED_WRITE_LEDGER_PATH:'/ignored'})).toEqual({path:join(s.dir,'x.jsonl'),remainingArgs:['--other']});
      expect(gatedWriteLedgerConfiguration([],{ACADEMY_GATED_WRITE_LEDGER_PATH:join(s.dir,'y.jsonl')}).path).toBe(join(s.dir,'y.jsonl'));
      expect(gatedWriteLedgerConfiguration([],{ACADEMY_GATED_WRITE_LEDGER_PATH:''}).path).toBeNull();
      expect(()=>gatedWriteLedgerConfiguration(['--gated-write-ledger'],{})).toThrow('gated_write_ledger_argument_invalid');
    }finally{await s.cleanup();}
  });
  test('gated_writes_r10_a_ledger_inside_the_repository_is_refused_when_run_from_source',async()=>{
    const s=await scratch();
    try{
      // Run from source: the module's directory sits in a tree with a .git entry (a directory, or a file in a worktree).
      expect(ledgerRefusedRoot(resolve(repo,'apps/academy/dc-gang-a/src/lms'))).toBe(repo);
      for(const path of [join(repo,'academy-gated-write-ledger.jsonl'),join(repo,'apps','x','ledger.jsonl'),join(root,'tests','ledger.jsonl')])
        expect(()=>new GatedWriteLedger(path).assertAvailable()).toThrow('ledger_unavailable');
      expect(()=>new GatedWriteLedger(s.ledger).assertAvailable()).not.toThrow();
      // A .git file (a worktree) marks the root as well as a .git directory.
      const tree=join(s.dir,'tree'),lms=join(tree,'a','b');await mkdir(lms,{recursive:true});await writeFile(join(tree,'.git'),'gitdir: elsewhere\n');
      expect(ledgerRefusedRoot(lms)).toBe(tree);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r10_an_installed_bundle_accepts_a_ledger_outside_its_own_directory',async()=>{
    const s=await scratch();
    try{
      // A temporary tree without .git: the bundle's directory, and a sibling private directory under the same parent.
      const bundle=join(s.dir,'profiles','artifacts','release'),data=join(s.dir,'data');
      await mkdir(bundle,{recursive:true});await mkdir(data,{mode:0o700});await chmod(data,0o700);
      expect(ledgerRefusedRoot(bundle)).toBe(bundle);
      const ledger=join(data,'ledger.jsonl');
      new GatedWriteLedger(ledger,undefined,bundle).assertAvailable();
      expect(statSync(ledger).mode&0o777).toBe(0o600);
      // The parent of the bundle is not refused (the old rule took a directory five levels above the file).
      await mkdir(join(s.dir,'profiles','private'),{mode:0o700});await chmod(join(s.dir,'profiles','private'),0o700);
      new GatedWriteLedger(join(s.dir,'profiles','private','ledger.jsonl'),undefined,bundle).assertAvailable();
      // The other R10 refusals still hold for a bundle.
      await chmod(data,0o777);
      expect(()=>new GatedWriteLedger(join(data,'other.jsonl'),undefined,bundle).assertAvailable()).toThrow('ledger_unavailable');
      expect(()=>new GatedWriteLedger('relative.jsonl',undefined,bundle).assertAvailable()).toThrow('ledger_unavailable');
    }finally{await s.cleanup();}
  });
  test('gated_writes_r10_an_installed_bundle_refuses_a_ledger_in_its_own_directory',async()=>{
    const s=await scratch();
    try{
      const bundle=join(s.dir,'profiles','artifacts','release');
      await mkdir(join(bundle,'inner'),{recursive:true,mode:0o700});await chmod(bundle,0o700);await chmod(join(bundle,'inner'),0o700);
      for(const path of [join(bundle,'ledger.jsonl'),join(bundle,'inner','ledger.jsonl')]){
        expect(()=>new GatedWriteLedger(path,undefined,bundle).assertAvailable()).toThrow('ledger_unavailable');
        expect(existsSync(path)).toBe(false);
      }
    }finally{await s.cleanup();}
  });
  test('gated_writes_r10_the_ledger_is_created_0600_and_each_record_is_durable_before_the_request_it_guards',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger);
      const review=await h.reviewed(bookInput());
      expect(statSync(s.ledger).mode&0o777).toBe(0o600);
      const seen:string[][]=[];
      h.lms.state.onRequest=req=>{seen.push([req.method+' '+req.route,...(existsSync(s.ledger)?readFileSync(s.ledger,'utf8').split('\n').filter(Boolean).map(l=>{const r=JSON.parse(l);return r.kind==='attempt'?r.step+':'+r.state:r.kind;}):[])]);};
      expect(await h.service.save(h.approve(review))).toMatchObject({status:'saved'});
      expect(seen.map(x=>x[0])).toEqual([`GET ${PAGE_BOOK} getTextBookMain`,`POST ${SELECT} getStudyResultSingleTestingSingleUser`,`POST ${SELECT} getWrongAnswerNoteResult`]);
      // The attempt is open before the pre-write read, and write_dispatched is on disk before the write request leaves.
      expect(seen[0]!.slice(1)).toEqual(['reviewed','before_write:open']);
      expect(seen[1]!.slice(1)).toEqual(['reviewed','before_write:open','write_dispatched:open']);
      expect(seen[2]!.slice(1)).toEqual(['reviewed','before_write:open','write_dispatched:open','response_received:open']);
      expect(statSync(s.ledger).mode&0o777).toBe(0o600);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r10_a_record_that_cannot_be_made_refuses_ledger_unavailable_and_sends_no_write',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger),review=await h.reviewed(clinicInput());
      // The ledger becomes group-readable while the pre-write read is in flight: write_dispatched cannot be recorded.
      h.lms.state.onRequest=async req=>{if(req.method==='GET')await chmod(s.ledger,0o640);};
      const out:any=await h.service.save(h.approve(review));
      expect(out).toMatchObject({status:'refused',code:'ledger_unavailable',academyWrites:0});
      expect(h.lms.writes()).toEqual([]);
      await chmod(s.ledger,0o600);
      expect(stepsOf(h)).toEqual(['before_write:open']);
      // A save whose ledger turned loose before the first record sends nothing at all.
      const h2=harness(s.ledger),review2=await h2.reviewed(bookInput());
      await chmod(s.ledger,0o660);h2.lms.requests.length=0;
      expect(await h2.service.save(h2.approve(review2))).toMatchObject({status:'refused',code:'ledger_unavailable'});
      expect(h2.lms.requests).toEqual([]);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r10_records_survive_a_separate_process_and_a_corrupt_line_makes_the_ledger_unavailable',async()=>{
    const s=await scratch();
    try{
      const module=resolve(repo,'apps/academy/dc-gang-a/src/lms/gatedWriteLedger.ts');
      const script=`import {GatedWriteLedger} from ${JSON.stringify(module)};
        const l=new GatedWriteLedger(process.env.LEDGER);
        l.append({kind:'attempt',attemptId:'child-1',tool:'academy_clinic_paper',reviewToken:'a'.repeat(64),changeSha256:'b'.repeat(64),studentKey:'77001',scopeKey:'clinic:88001',step:'write_dispatched',state:'open',at:'2040-01-16T09:00:00.000Z',runId:'child-run'});`;
      const child=Bun.spawnSync([process.execPath,'-e',script],{env:{PATH:process.env.PATH??'/usr/bin:/bin',LEDGER:s.ledger}});
      expect(child.exitCode).toBe(0);
      expect(statSync(s.ledger).mode&0o777).toBe(0o600);
      // The next process (this one) sees the child's record; the open attempt blocks a save of its target.
      const h=harness(s.ledger);
      expect(h.attempts().map(a=>a.attemptId)).toEqual(['child-1']);
      expect(new GatedWriteLedger(s.ledger).read()).toHaveLength(1);
      expect(await h.service.review(clinicInput())).toMatchObject({status:'refused',code:'reconcile_blocks_retry'});
      await writeFile(s.ledger,'{"kind":"attempt"\n',{mode:0o600});
      expect(await harness(s.ledger).service.review(clinicInput())).toMatchObject({status:'refused',code:'ledger_unavailable'});
    }finally{await s.cleanup();}
  });
});

// ---- R11: concurrency and crash guard ----------------------------------------------------------------
describe('gated writes R11: the open-attempt guard',()=>{
  const lockBody=(pid:number,runId='other-run')=>JSON.stringify({pid,runId,at:new Date(T0).toISOString()})+'\n';
  const openAttempt=(over:Partial<AttemptRecord>={}):AttemptRecord=>({kind:'attempt',attemptId:'crashed-1',tool:CLINIC_TOOL_FAMILY,reviewToken:'1'.repeat(64),changeSha256:'2'.repeat(64),studentKey:STUDENT,scopeKey:SAVE_SCOPE_CLINIC,
    step:'write_dispatched',state:'open',at:new Date(T0).toISOString(),runId:'crashed-run',...over});
  test('gated_writes_r11_a_live_lock_refuses_attempt_already_open_with_0_http_requests',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger),review=await h.reviewed(clinicInput());
      h.lms.requests.length=0;
      for(const pid of [process.pid,process.ppid]){
        await writeFile(s.ledger+'.lock',lockBody(pid),{mode:0o600});
        expect(await h.service.save(h.approve(review))).toMatchObject({status:'refused',code:'attempt_already_open',academyWrites:0});
        expect(await h.service.review(clinicInput())).toMatchObject({status:'refused',code:'attempt_already_open'});
      }
      // A pid that exists but belongs to another user (EPERM) counts as live.
      const eperm=harness(s.ledger,{pidAlive:()=>{try{process.kill(1,0);return true;}catch(e:any){return e.code==='EPERM';}}});
      expect(await eperm.service.save(eperm.approve(review))).toMatchObject({code:'attempt_already_open'});
      // A lock file that cannot be read yet and is only seconds old is a call still writing it.
      await writeFile(s.ledger+'.lock','',{mode:0o600});
      expect(await h.service.save(h.approve(review))).toMatchObject({code:'attempt_already_open'});
      expect(h.lms.requests).toEqual([]);
      expect(existsSync(s.ledger+'.lock')).toBe(true);
      // The refused call did not consume the token: once the lock is gone the reviewed change saves.
      await rm(s.ledger+'.lock');
      expect(await h.service.save(h.approve(review))).toMatchObject({status:'saved'});
    }finally{await s.cleanup();}
  });
  test('gated_writes_r11_a_stale_lock_is_removed_and_the_unresolved_attempt_blocks_with_reconcile_blocks_retry',async()=>{
    const s=await scratch();
    try{
      const dead=Bun.spawn(['true']);await dead.exited;
      const h=harness(s.ledger),review=await h.reviewed(clinicInput());
      h.lms.requests.length=0;
      new GatedWriteLedger(s.ledger).append(openAttempt());
      await writeFile(s.ledger+'.lock',lockBody(dead.pid,'crashed-run'),{mode:0o600});
      expect(await h.service.save(h.approve(review))).toMatchObject({status:'refused',code:'reconcile_blocks_retry',academyWrites:0});
      expect(existsSync(s.ledger+'.lock')).toBe(false);
      expect(h.lms.requests).toEqual([]);
      // An unreadable stale lock with an unresolved attempt of the ledger blocks too.
      await writeFile(s.ledger+'.lock','garbage',{mode:0o600});await utimes(s.ledger+'.lock',new Date(Date.now()-60000),new Date(Date.now()-60000));
      expect(await h.service.save(h.approve(review))).toMatchObject({code:'reconcile_blocks_retry'});
      expect(existsSync(s.ledger+'.lock')).toBe(false);
      expect(h.lms.requests).toEqual([]);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r11_a_stale_lock_with_no_unresolved_attempt_is_cleaned_and_the_save_proceeds',async()=>{
    const s=await scratch();
    try{
      const dead=Bun.spawn(['true']);await dead.exited;
      const h=harness(s.ledger),review=await h.reviewed(clinicInput());
      await writeFile(s.ledger+'.lock',lockBody(dead.pid,'ghost-run'),{mode:0o600});
      expect(await h.service.save(h.approve(review))).toMatchObject({status:'saved'});
      expect(existsSync(s.ledger+'.lock')).toBe(false);
      const old=harness(s.ledger),review2=await old.reviewed(clinicInput({createAdvance:true}));
      await writeFile(s.ledger+'.lock','',{mode:0o600});await utimes(s.ledger+'.lock',new Date(Date.now()-60000),new Date(Date.now()-60000));
      expect(await old.service.save(old.approve(review2))).toMatchObject({status:'saved'});
    }finally{await s.cleanup();}
  });
  test('gated_writes_r11_an_unresolved_attempt_of_the_same_student_and_scope_blocks_a_save_other_scopes_are_not_blocked',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger);
      const first=await h.reviewed(clinicInput()),second=await h.reviewed(clinicInput({createAdvance:true})),other=await h.reviewed(clinicInput({testingNo:TESTING2}));
      // A crashed save of the first review: its attempt is open at write_dispatched.
      new GatedWriteLedger(s.ledger).append(openAttempt({reviewToken:first.reviewToken}));
      h.lms.requests.length=0;
      expect(await h.service.save(h.approve(second))).toMatchObject({status:'refused',code:'reconcile_blocks_retry'});
      expect(await h.service.save(h.approve(first))).toMatchObject({code:'review_token_invalid'});
      expect(h.lms.requests).toEqual([]);
      expect(await h.service.save(h.approve(other))).toMatchObject({status:'saved',scopeKey:`clinic:${TESTING2}`});
      const flipped=h.attempts().filter(a=>a.attemptId==='crashed-1');
      expect(flipped.at(-1)!.state).toBe('open');
    }finally{await s.cleanup();}
  });
});

// ---- R12, R13: reconciliation -------------------------------------------------------------------------
describe('gated writes R12, R13: the review reconciles an unresolved attempt by read-only readback',()=>{
  const attempt=(scopeKey:string,step:AttemptRecord['step'],over:Partial<AttemptRecord>={}):AttemptRecord=>({kind:'attempt',attemptId:'crashed-'+step,tool:CLINIC_TOOL_FAMILY,reviewToken:'1'.repeat(64),changeSha256:'2'.repeat(64),
    studentKey:STUDENT,scopeKey,step,state:'open',at:new Date(T0).toISOString(),runId:'crashed-run',...over});
  const kinds:[string,Record<string,unknown>,string][]=[['clinic',clinicInput(),SAVE_SCOPE_CLINIC],['book_incorrect',bookInput(),SAVE_SCOPE_BOOK]];
  test('gated_writes_r12_r13_a_before_write_attempt_is_absent_and_the_review_answers_a_fresh_token',async()=>{
    const s=await scratch();
    try{
      for(const [kind,input,scope] of kinds){
        const lms=fixtureLms();lms.state.allowWrite=false;
        const h=harness(s.ledger,{lms});
        new GatedWriteLedger(s.ledger).append(attempt(scope,'before_write'));
        const out:any=await h.service.review(input);
        expect({kind,status:out.status}).toEqual({kind,status:'reviewed'});
        expect(out.reviewToken).toMatch(/^[a-f0-9]{64}$/);
        expect(lms.writes()).toEqual([]);
        expect(lms.requests.every(r=>r.role==='read')).toBe(true);
        expect(h.attempts().filter(a=>a.attemptId==='crashed-before_write').map(a=>a.step+':'+a.state)).toEqual(['before_write:open','reconciled:absent']);
        // Nothing is open any more: the fresh review saves.
        lms.state.allowWrite=true;
        expect(await h.service.save(h.approve(out))).toMatchObject({status:'saved'});
        await rm(s.ledger,{force:true});await writeFile(s.ledger,'',{mode:0o600});
      }
    }finally{await s.cleanup();}
  });
  test('gated_writes_r12_r13_a_response_received_attempt_is_persisted_and_the_review_offers_nothing_to_save',async()=>{
    const s=await scratch();
    try{
      for(const [kind,input,scope] of kinds){
        const lms=fixtureLms();lms.state.allowWrite=false;
        const h=harness(s.ledger,{lms});
        new GatedWriteLedger(s.ledger).append(attempt(scope,'response_received',{responseSha256:'3'.repeat(64),paperKeys:['99101','99102']}));
        const out:any=await h.service.review(input);
        expect({kind,status:out.status,done:out.done,nothingToSave:out.nothingToSave}).toEqual({kind,status:'persisted',done:true,nothingToSave:true});
        expect(out.reviewToken).toBeUndefined();expect(out.paperKeys).toEqual(['99101','99102']);
        expect(lms.writes()).toEqual([]);
        expect(h.attempts().at(-1)).toMatchObject({step:'reconciled',state:'persisted',responseSha256:'3'.repeat(64)});
        // The attempt is settled: a later review is an ordinary review again.
        expect(await h.service.review(input)).toMatchObject({status:'reviewed'});
        await rm(s.ledger,{force:true});await writeFile(s.ledger,'',{mode:0o600});
      }
    }finally{await s.cleanup();}
  });
  test('gated_writes_r12_a_write_dispatched_attempt_or_a_failed_readback_stays_open_with_reconcile_blocks_retry',async()=>{
    const s=await scratch();
    try{
      for(const [kind,input,scope] of kinds){
        for(const [label,step,readbackFails] of [['write_dispatched',  'write_dispatched',false],['before_write, readback refused','before_write',true],['response_received, readback refused','response_received',true]] as const){
          const lms=fixtureLms();lms.state.allowWrite=false;
          if(readbackFails){lms.state.scoreAnswer=()=>new Response('denied',{status:403});lms.state.noteAnswer=()=>new Response('denied',{status:403});}
          const h=harness(s.ledger,{lms});
          new GatedWriteLedger(s.ledger).append(attempt(scope,step,step==='response_received'?{responseSha256:'3'.repeat(64)}:{}));
          const out:any=await h.service.review(input);
          expect({kind,label,status:out.status,code:out.code}).toEqual({kind,label,status:'refused',code:'reconcile_blocks_retry'});
          expect(out.reviewToken).toBeUndefined();
          expect(lms.writes()).toEqual([]);
          expect(h.attempts().map(a=>a.state)).toEqual(['open']);
          await rm(s.ledger,{force:true});await writeFile(s.ledger,'',{mode:0o600});
        }
      }
    }finally{await s.cleanup();}
  });
  test('gated_writes_r12_r13_a_crashed_save_is_reconciled_end_to_end_through_the_review',async()=>{
    const s=await scratch();
    try{
      // The write was answered but the readback failed: the attempt is open at response_received; the next review reads the scope back.
      const h=harness(s.ledger);h.lms.state.scoreAnswer=()=>new Response('denied',{status:503});
      const {out}=await h.saved(clinicInput());
      expect(out).toMatchObject({status:'unverified',code:'clinic_readback_unverified'});
      expect(await h.service.review(clinicInput())).toMatchObject({status:'refused',code:'reconcile_blocks_retry'});
      h.lms.state.scoreAnswer=()=>scoreAnswer();
      h.lms.requests.length=0;h.lms.state.allowWrite=false;
      const done:any=await h.service.review(clinicInput());
      expect(done).toMatchObject({status:'persisted',done:true,nothingToSave:true});
      expect(h.lms.requests.every(r=>r.role==='read')).toBe(true);
      expect(stepsOf(h).slice(-1)).toEqual(['reconciled:persisted']);
      // A save that crashed at write_dispatched is never retried blindly.
      const crash=harness(s.ledger);crash.lms.state.writeAnswer=()=>{throw Error('synthetic_transport_failure');};
      const review=await crash.reviewed(clinicInput({testingNo:TESTING2}));
      await expect(crash.service.save(crash.approve(review))).rejects.toThrow();
      crash.lms.state.writeAnswer=()=>scoreAnswer();crash.lms.requests.length=0;
      expect(await crash.service.review(clinicInput({testingNo:TESTING2}))).toMatchObject({status:'refused',code:'reconcile_blocks_retry'});
      expect(crash.lms.writes()).toEqual([]);
    }finally{await s.cleanup();}
  });
});

// ---- R15, R16: refusals and privacy ------------------------------------------------------------------
describe('gated writes R15, R16: no write after a refusal, and nothing private in a record',()=>{
  test('gated_writes_r15_every_refusal_sends_0_write_requests_of_any_method',async()=>{
    const s=await scratch();
    try{
      const lms=fixtureLms();lms.state.allowWrite=false;
      const h=harness(s.ledger,{lms}),review=await h.reviewed(bookInput());
      const bad=[
        ()=>h.service.review({kind:'clinic'}),()=>h.service.review(clinicInput({studentKey:'all'})),()=>h.service.review(clinicInput({createSimilar:false})),
        ()=>h.service.save({reviewToken:review.reviewToken,change:review.change}),()=>h.service.save(h.approve(review,{reviewToken:'f'.repeat(64)})),
        ()=>h.service.save(h.approve(review,{change:{...review.change,bookNo:'1'}})),
        ()=>{h.clock.t=T0+16*60*1000;return h.service.save(h.approve(review));},
      ];
      for(const run of bad)expect(await run()).toMatchObject({status:'refused',academyWrites:0});
      expect(lms.writes()).toEqual([]);
      expect(lms.requests.filter(r=>r.method!=='GET'&&r.method!=='POST')).toEqual([]);
    }finally{await s.cleanup();}
  });
  test('gated_writes_r16_no_answer_or_record_holds_a_name_cookie_or_password',async()=>{
    const s=await scratch();
    try{
      const h=harness(s.ledger),outputs:unknown[]=[];
      const book=await h.saved(bookInput()),clinic=await h.saved(clinicInput({createAdvance:true,testingNo:TESTING2}));
      outputs.push(book.review,book.out,clinic.review,clinic.out,await h.service.review(bookInput()),await h.service.review(clinicInput({studentKey:'all'})));
      const pwField=['pass','word'].join(''),pwCanary=['invented','pw','canary'].join('-');
      const bad=harness(s.ledger);bad.lms.state.writeAnswer=()=>JSON.stringify({result:'OK',print_list:[{student_name:NAME_CANARY,exam_list:[]}],cookie:COOKIE_CANARY,[pwField]:pwCanary});
      outputs.push((await bad.saved(clinicInput({testingNo:'88003'}))).out);
      const text=JSON.stringify(outputs)+readFileSync(s.ledger,'utf8');
      for(const canary of [NAME_CANARY,COOKIE_CANARY,pwCanary,'JSESSIONID',pwField])expect({canary,found:text.includes(canary)}).toEqual({canary,found:false});
      // The ledger holds only keys, hashes, steps and times.
      for(const record of h.records()){
        const allowed=record.kind==='reviewed'?['kind','tool','reviewToken','changeSha256','studentKey','scopeKey','wireSha256','reviewedAt','expiresAt']
          :['kind','attemptId','tool','reviewToken','changeSha256','studentKey','scopeKey','step','responseSha256','paperKeys','state','at','runId'];
        expect(Object.keys(record).filter(k=>!allowed.includes(k))).toEqual([]);
      }
      expect(book.review.postedParameters.condition.student_name).toBe('');
    }finally{await s.cleanup();}
  });
});

// ---- through the endpoint and the bridge ----------------------------------------------------------------
describe('gated writes: the audited endpoint and the bridge',()=>{
  const deny=resolve(import.meta.dir,'network-deny.ts'),fixture=resolve(import.meta.dir,'gated-write-fixture.ts'),entry=resolve(import.meta.dir,'../src/neutral-server.ts');
  async function bridge(run:(x:{base:string;events:string;ledger:string;client:Client})=>Promise<void>,command?:{command:string;args:string[]}){
    const base=await mkdtemp(resolve(tmpdir(),'gated-writes-bridge-'));await chmod(base,0o700);
    const events=resolve(base,'events.txt'),ledger=resolve(base,'ledger.jsonl'),lock=resolve(base,'account.lock');
    let client:Client|undefined,transport:StdioClientTransport|undefined;
    try{
      await writeFile(events,'');await writeFile(lock,'');
      await writeFile(resolve(base,'endpoints.json'),JSON.stringify({dailyrecord:command?{command:command.command,args:command.args.map(a=>a.replaceAll('{lock}',lock).replaceAll('{ledger}',ledger).replaceAll('{base}',base).replaceAll('{events}',events))}
        :{command:process.execPath,args:['--preload',deny,fixture,ledger,base,events]}}),{mode:0o600});
      await writeFile(resolve(base,'routing.json'),'{}',{mode:0o600});
      const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
      const discovery=Bun.spawn([process.execPath,'--preload',deny,entry,'--discover'],{env,stdout:'pipe',stderr:'pipe'});
      expect(await discovery.exited).toBe(0);
      client=new Client({name:'fictional-gated-client',version:'1.0.0'});
      transport=new StdioClientTransport({command:process.execPath,args:['--preload',deny,entry],env,stderr:'pipe'});
      await client.connect(transport);
      await run({base,events,ledger,client});
    }finally{await client?.close();await transport?.close();await rm(base,{recursive:true,force:true});}
  }
  const receipts=async(base:string)=>Promise.all((await readdir(resolve(base,'receipts'))).map(async n=>({name:n,value:JSON.parse(await readFile(resolve(base,'receipts',n),'utf8'))})));
  test('gated_writes_bridge_a_saved_paper_records_academy_writes_1_and_an_unconfirmed_post_records_an_unknown_effect',async()=>{
    await bridge(async({base,client})=>{
      const tools=(await client.listTools()).tools.map(t=>t.name);
      expect(tools).toContain('academy_clinic_paper_review');expect(tools).toContain('academy_clinic_paper_save');
      const review:any=await client.callTool({name:'academy_clinic_paper_review',arguments:clinicInput({createAdvance:true})});
      expect(review.structuredContent).toMatchObject({status:'reviewed',academyWrites:0});
      const saved:any=await client.callTool({name:'academy_clinic_paper_save',arguments:{reviewToken:review.structuredContent.reviewToken,userApproved:true,change:review.structuredContent.change}});
      expect(saved.structuredContent).toMatchObject({status:'saved',academyWrites:1});
      expect((await receipts(base)).filter(r=>r.name.endsWith('-result.json')&&r.value.tool==='academy_clinic_paper_save').map(r=>r.value.academyWrites)).toEqual([1]);
      expect((await receipts(base)).filter(r=>r.name.endsWith('-result.json')&&r.value.tool==='academy_clinic_paper_review').map(r=>r.value.academyWrites)).toEqual([0]);
      // The attempt ledger of the first process serves the next one: its token is used.
      const again:any=await client.callTool({name:'academy_clinic_paper_save',arguments:{reviewToken:review.structuredContent.reviewToken,userApproved:true,change:review.structuredContent.change}});
      expect(again.structuredContent).toMatchObject({status:'refused',code:'review_token_invalid'});
      // A write request that fails after it was dispatched is an unknown effect, never a retry.
      await writeFile(resolve(base,'inject-post-throw'),'on');
      const secondReview:any=await client.callTool({name:'academy_clinic_paper_review',arguments:clinicInput({testingNo:TESTING2})});
      const secondTok=secondReview.structuredContent.reviewToken,secondChange=secondReview.structuredContent.change;
      const crashed:any=await client.callTool({name:'academy_clinic_paper_save',arguments:{reviewToken:secondTok,userApproved:true,change:secondChange}});
      expect(crashed.structuredContent).toMatchObject({status:'blocked',academyWrites:null,effectStatus:'unknown',automaticRetryAllowed:false});
      expect(crashed.structuredContent.code).not.toBe('review_token_invalid');
      const blocked:any=await client.callTool({name:'academy_clinic_paper_review',arguments:clinicInput({testingNo:TESTING2})});
      expect(blocked.structuredContent).toMatchObject({status:'refused',code:'reconcile_blocks_retry'});
    });
  },60000);
  test('gated_writes_bridge_a_saved_exam_records_academy_writes_4_and_a_dropped_assignment_records_an_unknown_effect',async()=>{
    const exam=(extra:Record<string,unknown>={})=>({family:'fa',testName:'Invented FA 1',testgubunNo:1180,items:[{key:'100000001',type:'obj'},{key:'100000002',type:'sbj'}],
      targets:[{studentName:'Invented Alpha',studentKey:'77001'}],start:'2040-01-16T09:00',end:'2040-01-16T10:30',testingMinutes:60,...extra});
    await bridge(async({base,client})=>{
      const tools=(await client.listTools()).tools.map(t=>t.name);
      expect(tools).toContain('academy_exam_paper_review');expect(tools).toContain('academy_exam_paper_save');
      const review:any=await client.callTool({name:'academy_exam_paper_review',arguments:exam()});
      expect(review.structuredContent).toMatchObject({status:'reviewed',academyWrites:0,change:{steps:'ABC'}});
      const saveOf=(r:any)=>({name:'academy_exam_paper_save',arguments:{reviewToken:r.structuredContent.reviewToken,userApproved:true,change:r.structuredContent.change}});
      const saved:any=await client.callTool(saveOf(review));
      expect(saved.structuredContent).toMatchObject({status:'saved',academyWrites:4,effectStatus:'persisted'});
      const done=await receipts(base);
      expect(done.filter(r=>r.name.endsWith('-result.json')&&r.value.tool==='academy_exam_paper_save').map(r=>r.value.academyWrites)).toEqual([4]);
      expect(done.filter(r=>r.name.endsWith('-result.json')&&r.value.tool==='academy_exam_paper_review').map(r=>r.value.academyWrites)).toEqual([0]);
      // The attempt ledger of the first process serves the next one: its token is used.
      expect((await client.callTool(saveOf(review)) as any).structuredContent).toMatchObject({status:'refused',code:'review_token_invalid'});
      // A write request that fails after it was dispatched is an unknown effect, never a retry.
      await writeFile(resolve(base,'inject-hang-throw'),'on');
      const second:any=await client.callTool({name:'academy_exam_paper_review',arguments:exam({testName:'Invented FA 2',targets:[{studentName:'Invented Beta',studentKey:'77002'}]})});
      expect(second.structuredContent).toMatchObject({status:'reviewed'});
      const crashed:any=await client.callTool(saveOf(second));
      expect(crashed.structuredContent).toMatchObject({status:'blocked',academyWrites:null,effectStatus:'unknown',automaticRetryAllowed:false});
      expect(crashed.structuredContent.code).not.toBe('review_token_invalid');
    });
  },60000);
  test('gated_writes_r9_a_held_account_lock_ends_each_call_with_owner_account_busy_and_sends_no_request',async()=>{
    // Through the bridge: the endpoint is launched as `flock --wait 0 --conflict-exit-code 75 <lock> …` while the lock is held.
    let holder:ReturnType<typeof Bun.spawn>|undefined;
    try{
      await bridge(async({base,events,client})=>{
        const lock=resolve(base,'account.lock');
        holder=Bun.spawn(['/usr/bin/flock',lock,'/bin/sh','-c','read held'],{stdin:'pipe',stdout:'ignore',stderr:'ignore'});
        for(let i=0;i<200&&Bun.spawnSync(['/usr/bin/flock','--nonblock',lock,'true']).exitCode===0;i++)await Bun.sleep(10);
        expect(Bun.spawnSync(['/usr/bin/flock','--nonblock',lock,'true']).exitCode).toBe(1);
        await writeFile(events,'');
        for(const [name,args] of [['academy_clinic_paper_review',clinicInput()],['academy_clinic_paper_review',bookInput()],
          ['academy_clinic_paper_save',{reviewToken:'a'.repeat(64),userApproved:true,change:{kind:'clinic'}}]] as const){
          const result:any=await client.callTool({name,arguments:{...args}});
          expect({name,isError:result.isError}).toEqual({name,isError:true});
          expect(result.structuredContent).toMatchObject({status:'blocked',code:'owner_account_busy'});
        }
        expect(await readFile(events,'utf8')).toBe('');
      },{command:'/usr/bin/flock',args:['--wait','0','--conflict-exit-code','75','{lock}',process.execPath,'--preload',deny,fixture,'{ledger}','{base}','{events}']});
    }finally{if(holder){(holder.stdin as {end():void}).end();await Promise.race([holder.exited,Bun.sleep(2000)]);holder.kill('SIGKILL');}}
  },60000);
});

// ---- the surface, the manifest and the skill ---------------------------------------------------------------
describe('gated writes: the tool surface, the exposure manifest and the lesson-day skill',()=>{
  const surface=JSON.parse(readFileSync(resolve(root,'release/surface.json'),'utf8')) as {tools:{name:string;title:string;description:string;inputSchema:any}[]};
  const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');
  test('gated_writes_surface_entries_are_within_793_bytes_and_the_20_tools_within_the_running_cap',()=>{
    const review=surface.tools.find(t=>t.name==='academy_clinic_paper_review')!,save=surface.tools.find(t=>t.name==='academy_clinic_paper_save')!;
    for(const entry of [review,save]){expect(entry).toBeDefined();expect(bytes(entry)).toBeLessThanOrEqual(793);}
    expect(review.title).toBe('오답·클리닉지 검토');
    expect(bytes(review.description)-2).toBeLessThanOrEqual(135);
    for(const word of ['book_incorrect','clinic','multiply','divide','custom','Read-only'])expect(review.description).toContain(word);
    expect(Object.keys(review.inputSchema.properties)).toEqual(['kind','studentKey','courseKey','bookNo','testingNo','testingNos','clinicMode','createSimilar','similarCount','createAdvance','advanceCount','patList']);
    expect(review.inputSchema.required).toEqual(['kind','studentKey']);
    expect(Object.keys(save.inputSchema.properties)).toEqual(['reviewToken','userApproved','change']);
    expect(save.inputSchema.required).toEqual(['reviewToken','userApproved','change']);
    expect(surface.tools).toHaveLength(22);
    expect(bytes(surface.tools.slice(0,15))).toBe(18317);
    expect(bytes(surface.tools)).toBeLessThanOrEqual(24000);
    expect(newSurfaceTools).toContain('academy_clinic_paper_review');expect(newSurfaceTools).toContain('academy_clinic_paper_save');
    expect(surfaceOrder.slice(-4)).toEqual(['academy_clinic_paper_review','academy_clinic_paper_save','academy_exam_paper_review','academy_exam_paper_save']);
    expect(keptTools.map(t=>t.name)).toEqual(expect.arrayContaining(['academy_clinic_paper_review','academy_clinic_paper_save']));
  });
  test('gated_writes_manifest_and_registration_class_the_save_as_a_gated_write_and_the_review_as_a_read',()=>{
    const manifest=JSON.parse(readFileSync(resolve(root,'docs/runtime-exposure-manifest.json'),'utf8')) as {tools:{name:string;class:string;exposure:string}[]};
    expect(manifest.tools.find(t=>t.name==='academy_clinic_paper_review')).toEqual({name:'academy_clinic_paper_review',class:'read',exposure:'open'});
    expect(manifest.tools.find(t=>t.name==='academy_clinic_paper_save')).toEqual({name:'academy_clinic_paper_save',class:'write',exposure:'gated_save_admission'});
    const source=(file:string)=>readFileSync(resolve(root,'src',file),'utf8');
    expect(source('neutral-server.ts')).toContain("['academy_dailyrecord_save','academy_cism_weekly_save','academy_clinic_paper_save','academy_exam_paper_save'].includes(entry.upstreamName)");
    expect(source('neutral-server.ts')).toContain("entry.upstreamName==='academy_clinic_paper_save'||entry.upstreamName==='academy_exam_paper_save')saveIssued=true");
    expect(manifest.tools.find(t=>t.name==='academy_exam_paper_review')).toEqual({name:'academy_exam_paper_review',class:'read',exposure:'open'});
    expect(manifest.tools.find(t=>t.name==='academy_exam_paper_save')).toEqual({name:'academy_exam_paper_save',class:'write',exposure:'gated_save_admission'});
    expect(source('exam-write-tools.ts')).toMatch(/academy_exam_paper_save[\s\S]{0,900}readOnlyHint:false/);
    expect(source('exam-write-tools.ts')).toMatch(/academy_exam_paper_review[\s\S]{0,900}readOnlyHint:true/);
    // tool-audit marks every tool whose annotations are not readOnlyHint true as a possible write.
    expect(source('tool-audit.ts')).toContain("config.annotations?.readOnlyHint!==true)writes.add(name)");
    expect(source('clinic-write-tools.ts')).toMatch(/academy_clinic_paper_save[\s\S]{0,900}readOnlyHint:false/);
    expect(source('clinic-write-tools.ts')).toMatch(/academy_clinic_paper_review[\s\S]{0,900}readOnlyHint:true/);
  });
  test('gated_writes_skill_names_both_tools_the_readback_the_print_list_and_the_manual_recovery',()=>{
    const skill=readFileSync(resolve(repo,'content/skills/academy-lesson-day/SKILL.md'),'utf8');
    for(const term of ['academy_clinic_paper_review','academy_clinic_paper_save','userApproved','reviewToken','print_list','readback','reconcile_blocks_retry','unverified','book_incorrect','multiply','divide','custom'])
      expect({term,found:skill.includes(term)}).toEqual({term,found:true});
    expect(skill).toMatch(/manual|by hand|teacher inspect/i);
  });
  test('gated_writes_spec_tests_lines_name_tests_that_exist',()=>{
    // The tests of the clinic pair are in this file, those of the exam pair in tests/exam-paper-writes.test.ts and tests/exam-write-client.test.ts.
    const spec=readFileSync(resolve(repo,'specs/academy-mcp/gated-writes.md'),'utf8');
    const source=['gated-writes.test.ts','exam-paper-writes.test.ts','exam-write-client.test.ts'].map(f=>readFileSync(resolve(import.meta.dir,f),'utf8')).join('\n');
    const rules=spec.split('\n').filter(l=>/^- R\d+:/.test(l));
    expect(rules.map(l=>l.match(/^- (R\d+):/)![1])).toEqual(Array.from({length:16},(_,i)=>'R'+(i+1)));
    for(const line of rules){
      const named=[...(line.match(/Tests?: ([^\n]*)$/)?.[1]??'').matchAll(/`([a-z0-9_]+)`/g)].map(m=>m[1]!);
      expect({line:line.slice(0,6),named:named.length>0}).toEqual({line:line.slice(0,6),named:true});
      for(const name of named)expect({name,found:source.includes("test('"+name+"'")}).toEqual({name,found:true});
    }
  });
});
