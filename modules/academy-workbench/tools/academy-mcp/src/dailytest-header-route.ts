import {z} from 'zod';
import {createHash} from 'node:crypto';
import {encodePaperCode} from '../../../../../apps/academy/dc-gang-a/src/lms/printedPaperCode.ts';
import {dailyRecordDateSchema,dailyRecordIdSchema} from './dailyrecord-context.ts';
import {toolResultBytes} from './tool-result.ts';

const selector=z.enum(['11','12','13','14','15','16']);
const key=z.string().regex(/^[1-9][0-9]{0,15}$/);
const instant=z.iso.datetime({offset:true});
export const dailyTestHeaderRouteSchema=z.object({
  displayName:z.string().trim().min(1).max(200),lessonDate:dailyRecordDateSchema,
  purpose:dailyRecordIdSchema,currentRequestRef:dailyRecordIdSchema,
  periods:z.array(selector).min(1).max(6).refine(x=>new Set(x).size===x.length,'unique_metadata_selectors_required'),
  maxHeaders:z.number().int().min(1).max(32).default(32),
  headerOffset:z.number().int().min(0).max(12000).default(0),
  expectedSelectionSha256:z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict().refine(v=>v.headerOffset===0||v.expectedSelectionSha256!==undefined,'dailytest_header_selection_pin_required');
export const dailyTestHeaderRouteDescription='교사가 학생의 DailyTest 소단원별 이력과 남은 평가를 검토할 때 사용합니다. 승인된 학생·날짜 범위에서 현재와 선택한 상대 기간별 첫 페이지의 관측 응시를 원천 시험지 제목·평가구분·문항 수와 결합합니다. 결과의 시험지 키를 공식 출력코드로 변환하고 반환된 시험지 키의 일치를 확인해 제목을 연결합니다. 교재 소단원 매핑은 별도 단계입니다: 해당 교재·판본의 확인된 목차와 원천 제목의 단원명·학습 내용을 대조하고 양쪽 근거를 보존하세요. 번호만 같다는 이유로 연결하지 말고, 제목이 대단원 범위이거나 판본·목차 근거가 부족하거나 일치가 모호하면 후보 또는 미확정으로 표시하고 교사에게 확인하세요. 이 도구는 목차를 조회하거나 소단원 매핑을 자동 확정하지 않습니다. 빠진 행은 미응시나 미완료의 증거가 아닙니다. 제목의 기본·발전은 원문으로 보존하며, 표시가 없으면 기본으로 추정하지 않습니다. 정확한 응시일은 추가 확인이 필요합니다. 점수와 교사 완료판정은 별개이며 DailyTest, 유사클리닉, 오답클리닉 및 교재 내 평가는 별도 활동입니다. 대단원 총괄평가도 별도 단원으로 다룰 수 있으나 시험지 정의는 실제 출력이나 완료를 증명하지 않습니다. 승인 거부, 인증 실패, 학생 식별 모호성 등 조회 차단 사유는 미발견과 구분해 반환합니다. 32개씩 조회하며 다음 묶음은 nextHeaderOffset을 headerOffset에, selectionSha256을 expectedSelectionSha256에 넣으세요. 쓰기·인쇄·발송·자동 재시도 없음.';
const row=z.object({studentKey:key,studentName:z.string(),paperKey:key,attemptKey:key,sourceRowId:z.string().nullable(),sourceScore:z.number().finite().nullable()});
const rows=z.array(row).max(2000);
const page=z.object({selector,rows,observedAt:instant,operation:z.literal('DtResultSearch'),page:z.literal(1),
  coverage:z.literal('one_observed_student_search_page_not_complete_history'),fixedSourceFilter:z.object({sort_date:selector})});
const metadata=z.object({status:z.literal('observed'),scope:z.object({sourceNamespace:z.literal('academy.lms.metadata'),studentId:key,lessonDate:dailyRecordDateSchema}),
  results:z.array(z.object({query:z.object({kind:z.literal('daily_history'),periods:z.array(selector)}),
    observation:z.object({status:z.literal('observed'),studentKey:key,studentName:z.string(),
      currentFilterQualification:z.object({selector:z.literal('1'),observedAt:instant,rows}),observations:z.array(page),
      coverage:z.literal('all_parsed_embedded_rows_on_each_observed_response_not_complete_history')})})).length(1)});
const headerRow=z.object({status:z.literal('observed'),paperCode:z.string(),requestedPaperKey:key,observedAt:instant,
  contentHeader:z.object({sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),metadataRows:z.array(z.object({label:z.string().max(200),value:z.string().max(2000)})).max(128)})});
const headers=z.object({status:z.literal('observed'),scope:z.object({studentId:key}),observation:z.object({status:z.literal('observed'),rows:z.array(headerRow).max(32)})});

/** Two independently admitted upstream reads; only keys observed in the first read may be joined. */
export async function readDailyTestHeaders(value:unknown,port:{metadata(input:unknown):Promise<unknown>;headers(input:unknown):Promise<unknown>}){
  const input=dailyTestHeaderRouteSchema.parse(value);
  const raw=await port.metadata({displayName:input.displayName,lessonDate:input.lessonDate,purpose:input.purpose,
    currentRequestRef:input.currentRequestRef,queries:[{kind:'daily_history',periods:input.periods}]});
  const result=metadata.parse(raw), history=result.results[0]!;
  if(result.scope.lessonDate!==input.lessonDate||history.observation.studentKey!==result.scope.studentId||history.observation.studentName!==input.displayName
    ||JSON.stringify(history.query.periods)!==JSON.stringify(input.periods)||history.observation.observations.length!==input.periods.length)
    throw Error('dailytest_header_scope_conflict');
  const pages=history.observation.observations;
  pages.forEach((p,i)=>{if(p.selector!==input.periods[i]||p.fixedSourceFilter.sort_date!==p.selector||p.rows.some(r=>r.studentKey!==result.scope.studentId||r.studentName!==input.displayName))throw Error('dailytest_header_scope_conflict');});
  const current=history.observation.currentFilterQualification;
  if(current.rows.some(r=>r.studentKey!==result.scope.studentId||r.studentName!==input.displayName))throw Error('dailytest_header_scope_conflict');
  const selectionSha256=createHash('sha256').update(JSON.stringify({scope:result.scope,
    pages:[{selector:current.selector,rows:current.rows},...pages.map(p=>({selector:p.selector,rows:p.rows}))]})).digest('hex');
  if(input.expectedSelectionSha256&&input.expectedSelectionSha256!==selectionSha256)throw Error('dailytest_header_selection_changed');
  const unique=[...new Set([...current.rows,...pages.flatMap(p=>p.rows)].map(r=>r.paperKey))];
  if(input.headerOffset>unique.length)throw Error('dailytest_header_offset_out_of_range');
  const selected=unique.slice(input.headerOffset,input.headerOffset+input.maxHeaders), codes=selected.map(encodePaperCode);
  const mapped=new Map<string,{title:string|null;category:string|null;questionCount:string|null;sourceSha256:string;observedAt:string}>();
  if(codes.length){
    const h=headers.parse(await port.headers({studentId:result.scope.studentId,paperCodes:codes}));
    if(h.scope.studentId!==result.scope.studentId||h.observation.rows.length!==codes.length)throw Error('dailytest_header_scope_conflict');
    for(const entry of h.observation.rows){
      const i=selected.indexOf(entry.requestedPaperKey);
      if(i<0||entry.paperCode!==codes[i]||mapped.has(entry.requestedPaperKey))throw Error('dailytest_header_identity_conflict');
      const get=(label:string)=>{const matches=entry.contentHeader.metadataRows.filter(x=>x.label===label);if(matches.length>1)throw Error('dailytest_header_duplicate_field');return matches[0]?.value||null;};
      mapped.set(entry.requestedPaperKey,{title:get('시험지 제목'),category:get('평가구분'),questionCount:get('총 문제수'),sourceSha256:entry.contentHeader.sourceSha256,observedAt:entry.observedAt});
    }
  }
  const output={status:unique.length>selected.length?'partial':'observed',displayName:input.displayName,lessonDate:input.lessonDate,purpose:input.purpose,currentRequestRef:input.currentRequestRef,
    scope:result.scope,periods:[{selector:current.selector,observedAt:current.observedAt,coverage:'one_observed_student_search_page_not_complete_history',rows:current.rows},...pages].map(p=>({selector:p.selector,observedAt:p.observedAt,coverage:p.coverage,
      rows:p.rows.map(r=>({paperKey:r.paperKey,attemptKey:r.attemptKey,sourceScore:r.sourceScore,sourceRowId:r.sourceRowId,
        header:mapped.get(r.paperKey)??null,headerStatus:mapped.has(r.paperKey)?'observed':'not_requested_limit'}))})),
    sourcePaperCount:unique.length,headersRead:selected.length,headerLimit:input.maxHeaders,headerOffset:input.headerOffset,selectionSha256,
    nextHeaderOffset:input.headerOffset+selected.length<unique.length?input.headerOffset+selected.length:null,
    calendarBounds:'source_relative_labels_only_not_exact_calendar_bounds',coverage:'one_page_per_selector_not_complete_history',
    bookEdition:'unqualified',attemptDate:'unqualified',teacherCompletion:'unqualified',level:'source_title_only',
    academyWrites:0,parentSends:0,nativePrintInvoked:false,automaticRetryAllowed:false,sourceContentIsUntrustedData:true,execution:'read_only'};
  if(toolResultBytes(output)>512*1024)throw Error('dailytest_header_result_too_large');
  return output;
}
