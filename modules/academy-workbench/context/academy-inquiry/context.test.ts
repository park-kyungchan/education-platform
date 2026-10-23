import { beforeAll, test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createValidator, checkInquiry } from './validate.ts';
import { projectClinicJudgment } from './projections.ts';
import { clinicPolicy } from '../../architecture/logical-model-v2.ts';
import type { InquiryContext, AssessmentIdentity, TeacherClinicJudgment } from './context.types.ts';
let original: InquiryContext;
let validate: Awaited<ReturnType<typeof createValidator>>;
beforeAll(async () => {
  original = JSON.parse(await readFile(new URL('./context.json',import.meta.url),'utf8'));
  validate = await createValidator();
});
const copy = () => structuredClone(original);
const record = (context: InquiryContext, key: string): any => context.records.find(x=>x.key===key)!;

test('full context and separate local canonical Work/Task/Run validate', async () => {
  expect(validate(original).coverage.completeProgressTable).toBe(false);
  expect((await checkInquiry()).canonicalArtifacts).toBe('pass');
});
test('10/9 closure correction retains blank observation and 10/14 uncertainty', () => {
  const x = validate(copy());
  expect(record(x,'daily-1009').observation.rawStatus).toBe('blank');
  expect(record(x,'closure-1009').decision.value).toBe('academy-closed');
  expect(record(x,'daily-1014').observation.attendanceInterpretation).toBe('unresolved');
});
for (const [name,key,mutate] of [
  ['blank cannot become absence','daily-1014',(r:any)=>r.observation.attendanceInterpretation='absence-record'],
  ['closure is date scoped','closure-1009',(r:any)=>r.scope='all-holidays'],
  ['paper missing is not app missing','homework-app-coverage',(r:any)=>r.observation.paperCompletion='not-solved'],
  ['7/17 cannot become progress percent','homework-app-coverage',(r:any)=>r.observation.completionRatio=7/17],
  ['video OK cannot become teacher inspection','video-ok',(r:any)=>r.observation.teacherInspection='complete'],
  ['server cannot revoke teacher completion','teacher-clinic-completion',(r:any)=>r.decision.serverCanRevokeTeacherJudgment=true],
  ['teacher judgment count must match exact paths','teacher-clinic-completion',(r:any)=>r.decision.judgmentCount=37],
  ['delivery ordinal 11 cannot inherit completion','teacher-clinic-completion',(r:any)=>{r.decision.completedOrdinals.push(11);r.decision.judgmentCount=38;}],
  ['100 score exclusion is not teacher review','perfect-score-comparison-exclusion',(r:any)=>r.decision.teacherReviewInferred=true],
  ['scope supersession requires preserved prior range','latest-delivery-range',(r:any)=>r.links=[]],
  ['parent report is not cause diagnosis','parent-signals',(r:any)=>r.report.causeDiagnosis=true],
  ['source failure cannot be rewritten as read','progress-extension-block',(r:any)=>r.observation.outcome='read'],
  ['context grants no external send','no-external-effects',(r:any)=>r.effects.send=true],
  ['record cannot claim another layer','cloud-login',(r:any)=>r.layer='GOVERNANCE'],
  ['unknown fields are rejected','cloud-login',(r:any)=>r.privateStudentName='synthetic-forbidden']
] as const) test(name,()=>{const x=copy();mutate(record(x,key));expect(()=>validate(x)).toThrow();});
test('corrections cannot delete original observation or reference missing source',()=>{
  const x=copy();record(x,'closure-1009').links.push({relation:'supersedes',target:'daily-1009'});expect(()=>validate(x)).toThrow('immutable-observation');
  const y=copy();record(y,'cloud-login').sourceKeys=['missing'];expect(()=>validate(y)).toThrow('missing-source');
});
test('hierarchy cycles and capture window reversal are rejected',()=>{
  const x=copy();x.hierarchy.find(n=>n.key==='DATA.reads')!.parent='DATA.reads';expect(()=>validate(x)).toThrow('hierarchy-cycle');
  const y=copy();const w=y.sources.find(s=>s.key==='browser-observation')!.times.captureWindow!;[w.from,w.to]=[w.to,w.from];expect(()=>validate(y)).toThrow('capture-window-order');
});
test('36 teacher judgments survive latest server 미학습, preserving input bytes',()=>{
  const teacher=record(original,'teacher-clinic-completion').decision;
  const originalBytes=JSON.stringify(original);let count=0;
  for(const ordinal of teacher.completedOrdinals) for(const path of teacher.paths) {
    const identity={originalTestId:`synthetic-original-${ordinal}`,unitId:`synthetic-unit-${ordinal}`,attemptedAt:'2026-10-07T07:00:00Z'};
    const judgment:TeacherClinicJudgment={identity,path,outcome:'complete',evidenceRef:`synthetic-teacher-${ordinal}-${path}`};
    const source={identity,path,rawStatus:'미학습' as const,capturedAt:'2026-10-14T07:05:00Z'};
    const before=JSON.stringify([judgment,source]);const result=projectClinicJudgment(judgment,source);
    expect(result.effectiveTeacherOutcome).toBe('complete');expect(result.server.rawStatus).toBe('미학습');expect(result.conflict).toBe(true);
    result.teacher.evidenceRef='changed-return-copy';expect(JSON.stringify([judgment,source])).toBe(before);count++;
  }
  expect(count).toBe(36);expect(JSON.stringify(original)).toBe(originalBytes);
});
test('5 기본도형 총괄 completion never joins 6 평면도형 총괄 or another attempt/path',()=>{
  const identity:AssessmentIdentity={originalTestId:'synthetic-test-5-basic',unitId:'synthetic-unit-basic-geometry',attemptedAt:'2026-10-01T07:00:00Z'};
  const judgment:TeacherClinicJudgment={identity,path:'original-wrong',outcome:'complete',evidenceRef:'synthetic-teacher-proof'};
  for(const mismatch of [
    {...identity,originalTestId:'synthetic-test-6-plane'},
    {...identity,unitId:'synthetic-unit-plane-geometry'},
    {...identity,attemptedAt:'2026-10-07T07:00:00Z'}
  ])expect(()=>projectClinicJudgment(judgment,{identity:mismatch,path:'original-wrong',rawStatus:'미학습',capturedAt:'2026-10-14T07:05:00Z'})).toThrow('assessment-or-path-mismatch');
  expect(()=>projectClinicJudgment(judgment,{identity,path:'similar-clinic',rawStatus:'미학습',capturedAt:'2026-10-14T07:05:00Z'})).toThrow('assessment-or-path-mismatch');
});
test('existing clinicPolicy keeps historical 100 score exclusion separate from teacher review',()=>{
  expect(clinicPolicy({assessmentScopeConfirmed:true,coverage:'complete',score:100,maximum:100,wrongCount:0,teacherConfirmed:false})).toEqual({clinic:'not_required_default',rework:'pending_judgment',review:'pending'});
});
test('context checks do not rewrite their JSON input',async()=>{
  const path=fileURLToPath(new URL('./context.json',import.meta.url));const before=await readFile(path);await checkInquiry();expect(await readFile(path)).toEqual(before);
});
