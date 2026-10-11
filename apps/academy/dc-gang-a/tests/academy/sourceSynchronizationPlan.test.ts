import {expect,test} from 'bun:test';
import {planSourceAreas,normalizeSourceArea} from '../../src/academy/sourceSynchronization';
import {normalizeCohortDiscovery} from '../../src/academy/sourceBridge';
import {directScope,directWitness} from './directSourceFixture';
import type {RecordVersion,StoredStudent} from '../../src/academy/postgresStore';
import type {AcademyRecord} from '../../src/academy/records';
const cohort=normalizeCohortDiscovery(directWitness().books,directScope.studentNames);
const student:StoredStudent={...cohort.students[0]!.registration,registeredAt:'2025-01-01T00:00:00Z'};
const head=(payload:AcademyRecord):RecordVersion=>({ownerId:cohort.ownerId,studentId:student.id,entityId:'fixture-'+payload.kind,sequence:1,revisionId:'fixture-'+payload.kind,previousRevisionId:null,previousDigest:null,payload,contentDigest:'synthetic-not-storage-integrity',integrityDigest:'synthetic-not-storage-integrity',sourceObservedAt:'2025-01-01T00:00:00Z',recordedAt:'2025-01-01T00:00:00Z',actorId:'fixture',idempotencyKey:'fixture',commandDigest:'fixture'});
const textbook={schemaVersion:1,family:'textbook',status:'observed',records:[{studentKey:'91001',studentName:'Invented Learner',courseKey:'71001',bookNo:'61001',paperKey:'51001',attemptKey:'41001',sourceTitle:'Invented retained section',score:50,items:[{originalOrdinal:'1',lectureKey:'31001',outerLectureKey:'21001',scoring:'X'}],sourceDate:{literal:'01-01',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}}],dailyResults:[],dayRecords:[],observedAt:'2025-01-02T00:00:00Z',coverage:'exact_selected_existing_records_not_whole_book',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false};
const daily={schemaVersion:1,family:'daily_zero',status:'observed',records:[],dayRecords:[],dailyResults:[{studentKey:'91001',studentName:'Invented Learner',attemptKey:'42001',paperKey:'52001',status:'observed',score:50,itemCount:2,correctCount:1,wrongCount:1,authenticationMode:'direct_http_api'}],observedAt:'2025-01-02T00:00:00Z',coverage:'requested_daily_targets',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false};
const heads=[head(cohort.students[0]!.books[0]!.payload),head({kind:'source_audit',acquisition:textbook,contractRef:'fixture-textbook'}),head({kind:'source_audit',acquisition:daily,contractRef:'fixture-daily'})];
const config={ownerId:cohort.ownerId,...directScope};
test('plans exact retained textbook and daily attempts without inventing new assignments or source labels',()=>{
 const tasks=planSourceAreas(config,[student],heads,'2025-01-02');
 expect(tasks.map(task=>task.request.family).sort()).toEqual(['daily_zero','student_course','textbook']);
 for(const family of ['textbook','daily_zero']){
  const task=tasks.find(task=>task.request.family===family)!;
  const snapshot=family==='textbook'?textbook:daily;
  const value=normalizeSourceArea(cohort.ownerId,task,[student],{schemaVersion:1,observedAt:snapshot.observedAt,authentication:directWitness().authentication,source:snapshot,academyWrites:0,parentSends:0},heads);
  expect(value.records).toHaveLength(1);expect(value.records[0]!.studentId).toBe(student.id);expect(value.records[0]!.payload.kind).toBe('source_audit');expect(value.transport).toBe('direct_http_api');
 }
 expect(planSourceAreas(config,[student],[],'2025-01-02').map(task=>task.request.family)).toEqual(['student_course']);
});
