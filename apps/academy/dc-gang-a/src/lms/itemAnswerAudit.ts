import {assertInstant,digest} from '../learning/model';
import {parseItemAnswer} from './itemAnswerRead';
import {readLiteralKey,readLiteralName} from './academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';

export function createItemAnswerAudit(snapshot:Record<string,unknown>){
  if(snapshot.schemaVersion!==1||snapshot.family!=='item_answer'||!['observed','partial','blocked'].includes(snapshot.status as string)
    ||snapshot.coverage!=='exact_requested_shared_answers_not_printed_versions'||snapshot.nativePrintInvoked!==false||snapshot.automaticRetryAllowed!==false
    ||!Array.isArray(snapshot.itemAnswers)||!Array.isArray(snapshot.requestedAnswerLabels)||!Array.isArray(snapshot.pendingAnswerLabels)
    ||typeof snapshot.observedAt!=='string'||!Array.isArray(snapshot.unknownStates))throw Error('invalid_answer_audit');
  assertInstant(snapshot.observedAt);
  const requested=snapshot.requestedAnswerLabels.map(readLiteralKey),pending=snapshot.pendingAnswerLabels.map(readLiteralKey);
  if(requested.length<1||requested.length>32||new Set(requested).size!==requested.length||snapshot.itemAnswers.length>requested.length)throw Error('invalid_answer_audit_scope');
  const rows=snapshot.itemAnswers.map(readInputRecord).map((item,index)=>{
    const identity=readInputRecord(item.identity);
    const fields=['identity','sourceUnitName','sourcePatternName','sourcePlaySeconds','sourceDifficulty','conceptMapping','answerLiteral','answerAvailability','answerMeaning','rendering','paperMembership'];
    if(Object.keys(item).length!==fields.length||Object.keys(item).some(key=>!fields.includes(key))
      ||Object.keys(identity).length!==4||Object.keys(identity).some(key=>!['sourceNamespace','lectureKey','outerLectureKey','sourceId'].includes(key))
      ||identity.sourceNamespace!=='academy_item'||item.answerMeaning!=='source_official_item_answer_not_student_response'||item.rendering!=='not_qualified'||item.paperMembership!=='unqualified'||item.conceptMapping!=='unverified')throw Error('invalid_answer_audit_item');
    // Structural validation of retained content; this does not synthesize a source observation or permission.
    const parsed=parseItemAnswer({result:'OK',rows:[{id:identity.sourceId,lecture_key:identity.lectureKey,outer_lecture_key:identity.outerLectureKey,
      unit_name:item.sourceUnitName,pat_name:item.sourcePatternName,play_seconds:item.sourcePlaySeconds,difficulty:item.sourceDifficulty,answer:item.answerLiteral}]},requested[index]!);
    if(item.answerAvailability!==parsed.answerAvailability)throw Error('answer_availability_conflict');
    return parsed;
  });
  if(JSON.stringify(pending)!==JSON.stringify(requested.slice(rows.length))||snapshot.status!==(rows.length===requested.length?'observed':rows.length?'partial':'blocked')
    ||(pending.length===0?snapshot.answerBlockedReason!==null:typeof snapshot.answerBlockedReason!=='string'||!/^[a-z_]+$/.test(snapshot.answerBlockedReason)))throw Error('answer_audit_status_conflict');
  const content={sourceNamespace:'academy_item_answer',coverage:snapshot.coverage,requestedLabels:requested,pendingLabels:pending,blockedReason:snapshot.answerBlockedReason,rows,unknownStates:[...new Set(snapshot.unknownStates.map(readLiteralName))].sort()};
  return {schemaVersion:1,kind:'normalized_academy_source_audit',contentDigest:digest(content),observedAt:snapshot.observedAt,
    digestMeaning:'same_source_content_excluding_observation_time_not_signature_or_permission',content,
    entities:rows.map(row=>({kind:'shared_source_item_answer',sourceNamespace:'academy_item_answer',sourceIdentity:row.identity})),
    semanticClaims:{mastery:'not_established',generatedPaperMembership:'unknown',printedAnswerVersion:'unknown',teacherAcceptance:'unknown'},productionWriteAuthorized:false,unattendedAuthenticationEstablished:false};
}
