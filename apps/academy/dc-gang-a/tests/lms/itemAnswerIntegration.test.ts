import {expect,test} from 'bun:test';
import {createAcademyReadPlan,executeAcademyRead} from '../../src/lms/academyReadProtocol';
import {createAcademySourceAudit} from '../../src/lms/academySourceAudit';
test('public preparation admits explicit exact answers without widening metadata output',async()=>{
  const plan=createAcademyReadPlan({family:'item_answer',teacherLabel:'Invented teacher',teacherKey:'7001',lectureKeys:['8101','8102'],answerReadAdmission:true});
  expect(plan.family).toBe('item_answer');
  const result=await executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,principalKey:'7001',fetcher:async(url)=>{
    const key=new URL(url,'https://dc.gang-a.kr').searchParams.get('lecture_list')!;
    return Response.json({result:'OK',rows:[{id:key,lecture_key:key,outer_lecture_key:'8201',unit_name:'Invented unit',pat_name:'Invented pattern',difficulty:1,play_seconds:0,answer:'1|_|42'}]});
  }});
  expect(result).toMatchObject({family:'item_answer',status:'observed',pendingAnswerLabels:[],nativePrintInvoked:false,automaticRetryAllowed:false});
  expect(result.itemAnswers).toHaveLength(2);
  expect(createAcademySourceAudit(result).content.sourceNamespace).toBe('academy_item_answer');
  expect(createAcademySourceAudit({...result,observedAt:'2099-01-01T00:00:00Z'}).contentDigest).toBe(createAcademySourceAudit(result).contentDigest);
  expect(()=>createAcademyReadPlan({family:'item_answer',teacherLabel:'Invented teacher',teacherKey:'7001',lectureKeys:['8101'],answerReadAdmission:false})).toThrow();
});
test('a foreign principal cannot read any answer even with a visible login shell',async()=>{
  const plan=createAcademyReadPlan({family:'item_answer',teacherLabel:'Invented teacher',teacherKey:'7001',lectureKeys:['8101'],answerReadAdmission:true});
  let calls=0;
  await expect(executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,principalKey:'7002',fetcher:async()=>{calls++;return Response.json({});}})).rejects.toThrow('exact_teacher_principal_required');
  expect(calls).toBe(0);
});
test('answer audits reject wrong pending/status relations and foreign-family leakage',async()=>{
  const plan=createAcademyReadPlan({family:'item_answer',teacherLabel:'Invented teacher',teacherKey:'7001',lectureKeys:['8101','8102'],answerReadAdmission:true});
  const result=await executeAcademyRead(plan,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,principalKey:'7001',fetcher:async()=>{throw Error('network_failed');}});
  expect(createAcademySourceAudit(result).entities).toHaveLength(0);
  expect(()=>createAcademySourceAudit({...result,pendingAnswerLabels:[]})).toThrow('answer_audit_status_conflict');
  expect(()=>createAcademySourceAudit({...result,status:'observed'})).toThrow('answer_audit_status_conflict');
  expect(()=>createAcademySourceAudit({...result,family:'item_metadata'})).toThrow('source_scope_conflict');
});
