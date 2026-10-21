import {assertInstant,digest} from '../learning/model';
import {createAcademyReadPlan,readLiteralKey,readLiteralName} from './academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';
import {createStudentCourseRequest} from './studentCourseRead';
import {createItemAnswerAudit} from './itemAnswerAudit';

/** Pure source normalization and integrity, not permission, storage or conceptual mastery. */
export function createAcademySourceAudit(input:unknown) {
  const snapshot=readInputRecord(input);
  const allowed=['schemaVersion','family','status','records','dailyResults','dayRecords','itemMetadata','itemAnswers','requestedAnswerLabels','pendingAnswerLabels','answerBlockedReason','studentCourses','studentCourseScope','requestedScope','observedAt','coverage','unknownStates','nativePrintInvoked','automaticRetryAllowed'];
  if(Object.keys(snapshot).some(key=>!allowed.includes(key)))throw new Error('unexpected_source_audit_field');
  for(const [field,family] of [['records','textbook'],['dailyResults','daily_zero'],['dayRecords','day_record'],['itemMetadata','item_metadata'],['itemAnswers','item_answer'],['studentCourses','student_course']] as const) {
    const rows=snapshot[field];
    if(rows!==undefined&&(!Array.isArray(rows)||(snapshot.family!==family&&rows.length!==0)))throw new Error('source_family_conflict');
  }
  if(snapshot.requestedScope!==undefined&&snapshot.family!=='day_record')throw new Error('source_scope_conflict');
  if(snapshot.studentCourseScope!==undefined&&snapshot.family!=='student_course')throw new Error('source_scope_conflict');
  if(snapshot.family!=='item_answer'&&['requestedAnswerLabels','pendingAnswerLabels','answerBlockedReason'].some(key=>snapshot[key]!==undefined))throw Error('source_scope_conflict');
  if(snapshot.family==='item_answer')return createItemAnswerAudit(snapshot);
  if(snapshot.family==='student_course') {
    if(snapshot.schemaVersion!==1||snapshot.status!=='observed'||snapshot.nativePrintInvoked!==false||snapshot.automaticRetryAllowed!==false
      ||snapshot.coverage!=='observed_rows_not_all_assignments_or_pagination'||!Array.isArray(snapshot.studentCourses)||snapshot.studentCourses.length>1000
      ||typeof snapshot.observedAt!=='string'||!Array.isArray(snapshot.unknownStates))throw new Error('invalid_source_audit');
    assertInstant(snapshot.observedAt);
    const requestedScope=createStudentCourseRequest(snapshot.studentCourseScope),seen=new Set<string>();
    const rows=snapshot.studentCourses.map(readInputRecord).map(row=>{
      const identity=readInputRecord(row.identity);
      if(Object.keys(row).length!==4||Object.keys(row).some(k=>!['identity','sourceCells','coverage','handlersInvoked'].includes(k))
        ||row.handlersInvoked!==false||row.coverage!=='observed_row_not_all_assignments_or_pagination'
        ||!Array.isArray(row.sourceCells)||row.sourceCells.length!==7||row.sourceCells.some(x=>typeof x!=='string')
        ||Object.keys(identity).length!==5||Object.keys(identity).some(k=>!['sourceNamespace','studentKey','collegeKey','courseKey','userCourseKey'].includes(k))
        ||identity.sourceNamespace!=='academy_student_course')throw new Error('invalid_course_audit');
      const sourceIdentity={sourceNamespace:'academy_student_course',studentKey:readLiteralKey(identity.studentKey),collegeKey:readLiteralKey(identity.collegeKey),
        courseKey:readLiteralKey(identity.courseKey),userCourseKey:readLiteralKey(identity.userCourseKey)};
      if(sourceIdentity.studentKey!==requestedScope.studentKey)throw new Error('source_scope_conflict');
      const key=JSON.stringify(sourceIdentity);if(seen.has(key))throw new Error('duplicate_source_identity');seen.add(key);
      return {identity:sourceIdentity,sourceCells:[...row.sourceCells],coverage:row.coverage,handlersInvoked:false};
    }).sort((a,b)=>JSON.stringify(a.identity)<JSON.stringify(b.identity)?-1:JSON.stringify(a.identity)>JSON.stringify(b.identity)?1:0);
    if(new Set(rows.map(row=>row.identity.collegeKey)).size>1)throw new Error('source_principal_conflict');
    const content={sourceNamespace:'academy_student_course',requestedScope,coverage:snapshot.coverage,rows,
      unknownStates:[...new Set(snapshot.unknownStates.map(readLiteralName))].sort(),queryMeaning:'absence_of_rows_does_not_establish_not_performed'};
    return {schemaVersion:1,kind:'normalized_academy_source_audit',contentDigest:digest(content),observedAt:snapshot.observedAt,
      digestMeaning:'same_source_content_excluding_observation_time_not_signature_or_permission',content,
      entities:rows.map(row=>({kind:'source_enrollment_candidate',sourceNamespace:'academy_student_course',sourceIdentity:row.identity})),
      semanticClaims:{mastery:'not_established',effectiveDates:'unknown',completeEnrollment:'unknown'},productionWriteAuthorized:false,unattendedAuthenticationEstablished:false};
  }
  if(snapshot.family==='item_metadata') {
    if(snapshot.schemaVersion!==1||snapshot.status!=='observed'||snapshot.nativePrintInvoked!==false||snapshot.automaticRetryAllowed!==false
      ||snapshot.coverage!=='one_exact_verified_item_not_all_content_or_batch_encoding'||!Array.isArray(snapshot.itemMetadata)||snapshot.itemMetadata.length!==1
      ||typeof snapshot.observedAt!=='string'||!Array.isArray(snapshot.unknownStates))throw new Error('invalid_source_audit');
    assertInstant(snapshot.observedAt);
    const item=readInputRecord(snapshot.itemMetadata[0]),identity=readInputRecord(item.identity);
    if(Object.keys(item).length!==6||Object.keys(item).some(k=>!['identity','sourceUnitName','sourcePatternName','sourcePlaySeconds','sourceDifficulty','conceptMapping'].includes(k)))throw new Error('invalid_item_audit');
    if(Object.keys(identity).length!==4||Object.keys(identity).some(k=>!['sourceNamespace','lectureKey','outerLectureKey','sourceId'].includes(k))
      ||identity.sourceNamespace!=='academy_item'||item.conceptMapping!=='unverified'
      ||typeof item.sourceUnitName!=='string'||typeof item.sourcePatternName!=='string'
      ||typeof item.sourcePlaySeconds!=='number'||!Number.isFinite(item.sourcePlaySeconds)||item.sourcePlaySeconds<0
      ||typeof item.sourceDifficulty!=='number'||!Number.isFinite(item.sourceDifficulty))throw new Error('invalid_item_audit');
    const sourceIdentity={sourceNamespace:'academy_item',lectureKey:readLiteralKey(identity.lectureKey),outerLectureKey:readLiteralKey(identity.outerLectureKey),sourceId:readLiteralKey(identity.sourceId)};
    if(sourceIdentity.lectureKey!==sourceIdentity.sourceId)throw new Error('item_identity_conflict');
    const rows=[{identity:sourceIdentity,sourceUnitName:item.sourceUnitName,sourcePatternName:item.sourcePatternName,
      sourcePlaySeconds:item.sourcePlaySeconds,sourceDifficulty:item.sourceDifficulty,conceptMapping:'unverified'}];
    const content={sourceNamespace:'academy_item',coverage:snapshot.coverage,rows,unknownStates:[...new Set(snapshot.unknownStates.map(readLiteralName))].sort()};
    return {schemaVersion:1,kind:'normalized_academy_source_audit',contentDigest:digest(content),observedAt:snapshot.observedAt,
      digestMeaning:'same_source_content_excluding_observation_time_not_signature_or_permission',content,
      entities:rows.map(row=>({kind:'shared_source_item_metadata',sourceNamespace:'academy_item',sourceIdentity:row.identity})),
      semanticClaims:{mastery:'not_established',conceptMapping:'unknown',videoWatchHistory:'unknown'},productionWriteAuthorized:false,unattendedAuthenticationEstablished:false};
  }
  if(snapshot.family==='daily_zero') {
    if(snapshot.schemaVersion!==1||!['observed','partial','blocked'].includes(snapshot.status as string)||snapshot.nativePrintInvoked!==false
      ||snapshot.automaticRetryAllowed!==false||snapshot.coverage!=='requested_daily_targets'||!Array.isArray(snapshot.dailyResults)
      ||snapshot.dailyResults.length<1||snapshot.dailyResults.length>2||typeof snapshot.observedAt!=='string'||!Array.isArray(snapshot.unknownStates))throw new Error('invalid_source_audit');
    assertInstant(snapshot.observedAt);
    const seen=new Set<string>();
    const outcomes=snapshot.dailyResults.map(readInputRecord).map(row=>{
      const identity={studentKey:readLiteralKey(row.studentKey),attemptKey:readLiteralKey(row.attemptKey)};
      const key=JSON.stringify(identity);if(seen.has(key))throw new Error('duplicate_source_identity');seen.add(key);
      const studentName=readLiteralName(row.studentName);
      if(row.status==='blocked') {
        if(!['contract_rejected','authentication_required','transport_failed'].includes(row.reason as string))throw new Error('invalid_source_blocker');
        return {identity,studentName,status:'blocked',reason:row.reason};
      }
      if(row.status!=='observed'||typeof row.score!=='number'||!Number.isFinite(row.score)||row.score<0||row.score>100
        ||![row.itemCount,row.correctCount,row.wrongCount].every(x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0)
        ||row.itemCount===0||(row.correctCount as number)+(row.wrongCount as number)!==row.itemCount)throw new Error('invalid_source_grade');
      if(typeof row.paperKey!=='string'||!/^[0-9]+$/.test(row.paperKey)||/^0+$/.test(row.paperKey))throw new Error('invalid_source_paper_key');
      return {identity,studentName,status:'observed',paperKey:row.paperKey,score:row.score,
        itemCount:row.itemCount,correctCount:row.correctCount,wrongCount:row.wrongCount};
    }).sort((a,b)=>JSON.stringify(a.identity)<JSON.stringify(b.identity)?-1:JSON.stringify(a.identity)>JSON.stringify(b.identity)?1:0);
    const blockedTargets=outcomes.filter(x=>x.status==='blocked'),observed=outcomes.filter(x=>x.status==='observed');
    if(snapshot.status!==(observed.length===outcomes.length?'observed':observed.length?'partial':'blocked'))throw new Error('source_status_count_conflict');
    const unknownStates=[...new Set((snapshot.unknownStates as unknown[]).map(readLiteralName))].sort();
    const content={sourceNamespace:'academy_daily_zero',coverage:snapshot.coverage,outcomes,blockedTargets,unknownStates};
    return {schemaVersion:1,kind:'normalized_academy_source_audit',contentDigest:digest(content),observedAt:snapshot.observedAt,
      digestMeaning:'same_source_content_excluding_observation_time_not_signature_or_permission',content,
      entities:observed.map(row=>({kind:'source_assessment_attempt',sourceNamespace:'academy_daily_zero',sourceIdentity:row.identity})),
      semanticClaims:{mastery:'not_established',clinicSolving:'unknown',clinicAppReentry:'unknown',teacherAcceptance:'unknown',durablePrintReceipt:'unknown'},
      productionWriteAuthorized:false,unattendedAuthenticationEstablished:false};
  }
  if(snapshot.family==='day_record') {
    if(snapshot.schemaVersion!==1||!['observed','partial','blocked'].includes(snapshot.status as string)||snapshot.nativePrintInvoked!==false||snapshot.automaticRetryAllowed!==false
      ||snapshot.coverage!=='requested_date_groups_students_not_cohort_completeness'||!Array.isArray(snapshot.dayRecords)
      ||snapshot.dayRecords.length>64||typeof snapshot.observedAt!=='string'||!Array.isArray(snapshot.unknownStates))throw new Error('invalid_source_audit');
    assertInstant(snapshot.observedAt);
    const prepared=snapshot.requestedScope===undefined?null:createAcademyReadPlan(snapshot.requestedScope);
    if(prepared!==null&&prepared.family!=='day_record')throw new Error('source_scope_conflict');
    const requestedScope=prepared?.family==='day_record'?prepared.request:null;
    if(requestedScope===null&&(snapshot.status!=='observed'||snapshot.dayRecords.length===0))throw new Error('requested_scope_required');
    const seen=new Set<string>();
    const rows=snapshot.dayRecords.map(readInputRecord).map(row=>{
      const identity={teacherKey:readLiteralKey(row.teacherKey),date:readLiteralName(row.date),groupId:readLiteralKey(row.groupId),studentKey:readLiteralKey(row.studentKey),
        courseKey:readLiteralKey(row.courseKey),recordKey:readLiteralKey(row.recordKey),membershipKey:readLiteralKey(row.membershipKey)};
      if(!/^\d{4}-\d{2}-\d{2}$/.test(identity.date)||!Number.isFinite(Date.parse(identity.date+'T00:00:00Z'))
        ||new Date(identity.date+'T00:00:00Z').toISOString().slice(0,10)!==identity.date)throw new Error('invalid_source_date');
      const key=JSON.stringify(identity);if(seen.has(key))throw new Error('duplicate_source_identity');seen.add(key);
      const fields=readInputRecord(row.fields);
      if(Object.keys(fields).some(key=>!['attendance','progress','homework','lessonMemo','persistentMemo'].includes(key))
        ||Object.values(fields).some(x=>typeof x!=='string'))throw new Error('invalid_journal_source_fields');
      const studentName=readLiteralName(row.studentName);
      if(requestedScope&&(identity.date!==requestedScope.date||!requestedScope.groupIds.includes(identity.groupId)||!requestedScope.studentNames.includes(studentName)))throw new Error('source_scope_conflict');
      return {identity,studentName,fields};
    }).sort((a,b)=>JSON.stringify(a.identity)<JSON.stringify(b.identity)?-1:JSON.stringify(a.identity)>JSON.stringify(b.identity)?1:0);
    if(new Set(rows.map(row=>row.identity.teacherKey)).size>1)throw new Error('source_principal_conflict');
    if(new Set(rows.map(row=>row.studentName)).size!==rows.length)throw new Error('duplicate_source_subject');
    const unobservedTargets=requestedScope?requestedScope.studentNames.filter(name=>!rows.some(row=>row.studentName===name)).sort().map(studentName=>({studentName,meaning:'not_observed_not_absent_or_incomplete'})):[];
    const expectedStatus=rows.length===0?'blocked':unobservedTargets.length?'partial':'observed';
    if(snapshot.status!==expectedStatus)throw new Error('source_status_count_conflict');
    const unknownStates=[...new Set((snapshot.unknownStates as unknown[]).map(readLiteralName))].sort();
    if(requestedScope===null)unknownStates.push('requested_scope_not_retained_in_legacy_snapshot');
    const scope=requestedScope?{...requestedScope,groupIds:[...requestedScope.groupIds].sort(),studentNames:[...requestedScope.studentNames].sort()}:null;
    const content={sourceNamespace:'academy_dayrecord',status:snapshot.status,requestedScope:scope,coverage:snapshot.coverage,rows,unobservedTargets,unknownStates};
    return {schemaVersion:1,kind:'normalized_academy_source_audit',contentDigest:digest(content),observedAt:snapshot.observedAt,
      digestMeaning:'same_source_content_excluding_observation_time_not_signature_or_permission',content,
      entities:rows.map(row=>({kind:'source_lesson_occurrence',sourceNamespace:'academy_dayrecord',sourceIdentity:row.identity})),
      semanticClaims:{mastery:'not_established',clinicSolving:'unknown',clinicAppReentry:'unknown',teacherAcceptance:'unknown',durablePrintReceipt:'unknown'},
      productionWriteAuthorized:false,unattendedAuthenticationEstablished:false};
  }
  if(snapshot.schemaVersion!==1||snapshot.family!=='textbook'||snapshot.status!=='observed'||snapshot.nativePrintInvoked!==false
    ||snapshot.automaticRetryAllowed!==false||snapshot.coverage!=='exact_selected_existing_records_not_whole_book'
    ||!Array.isArray(snapshot.records)||snapshot.records.length<1||snapshot.records.length>12
    ||!Array.isArray(snapshot.unknownStates)||!snapshot.unknownStates.every(x=>typeof x==='string'&&/^[a-z_]+$/.test(x)))throw new Error('invalid_source_audit');
  if(typeof snapshot.observedAt!=='string')throw new Error('invalid_source_audit');
  assertInstant(snapshot.observedAt);
  const identities=new Set<string>();
  const records=snapshot.records.map(readInputRecord).map(record=>{
    const identity={studentKey:readLiteralKey(record.studentKey),courseKey:readLiteralKey(record.courseKey),bookNo:readLiteralKey(record.bookNo),
      paperKey:readLiteralKey(record.paperKey),attemptKey:readLiteralKey(record.attemptKey)};
    const key=JSON.stringify(identity);
    if(identities.has(key))throw new Error('duplicate_source_identity');identities.add(key);
    if(typeof record.score!=='number'||!Number.isFinite(record.score)||record.score<0||record.score>100
      ||!Array.isArray(record.items)||record.items.length<1||record.items.length>500)throw new Error('invalid_source_grade');
    const seen=new Set<string>();
    const items=record.items.map(readInputRecord).map(item=>{
      const originalOrdinal=readLiteralKey(item.originalOrdinal);
      if(seen.has(originalOrdinal)||!['O','X'].includes(item.scoring as string))throw new Error('invalid_source_item');seen.add(originalOrdinal);
      return {originalOrdinal,lectureKey:item.lectureKey===null?null:readLiteralKey(item.lectureKey),
        outerLectureKey:item.outerLectureKey===null?null:readLiteralKey(item.outerLectureKey),scoring:item.scoring as 'O'|'X'};
    }).sort((a,b)=>Number(a.originalOrdinal)-Number(b.originalOrdinal));
    const date=readInputRecord(record.sourceDate);
    if(!(date.literal===null||typeof date.literal==='string')||!['month_day','unknown'].includes(date.precision as string)
      ||date.meaning!=='source_apply_date_not_exact_grade_time')throw new Error('invalid_source_date');
    return {identity,studentName:readLiteralName(record.studentName),sourceTitle:readLiteralName(record.sourceTitle),score:record.score,items,
      sourceDate:{literal:date.literal,precision:date.precision,meaning:date.meaning}};
  }).sort((a,b)=>JSON.stringify(a.identity).localeCompare(JSON.stringify(b.identity),'en'));
  const unknownStates=[...new Set(snapshot.unknownStates as string[])].sort();
  const content={sourceNamespace:'academy_textbook',coverage:snapshot.coverage,records,unknownStates};
  return {schemaVersion:1,kind:'normalized_academy_source_audit',contentDigest:digest(content),observedAt:snapshot.observedAt,
    digestMeaning:'same_source_content_excluding_observation_time_not_signature_or_permission',content,
    entities:records.map(record=>({kind:'source_assessment_attempt',sourceNamespace:'academy_textbook',sourceIdentity:record.identity,
      itemKeys:record.items.map(item=>({originalOrdinal:item.originalOrdinal,lectureKey:item.lectureKey}))})),
    semanticClaims:{mastery:'not_established',clinicSolving:'unknown',clinicAppReentry:'unknown',teacherAcceptance:'unknown',durablePrintReceipt:'unknown'},
    productionWriteAuthorized:false,unattendedAuthenticationEstablished:false};
}
