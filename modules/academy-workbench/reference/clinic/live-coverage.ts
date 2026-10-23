/** Pure readers of saved live coverage. No source function or HTTP request is executed. */
import { digest, instant } from '../../architecture/logical-model-v2.ts';
export type ObservedIds = {assNo: string; pNo: string; testingNo: string; priNo: string};
export type CandidateSelection = {fullTestingName: string; section: string; observedIds: ObservedIds};
export type HeaderCandidate = CandidateSelection & {shortHeader: string; applyDateExact: string; occurredAt: null};
export type DiscoveryEvidence = {
  kind: 'saved_actual_dom' | 'synthetic_fixture'; sourceDigest: string; reportDigest: string;
  entry: {mode: 'canonical_UserByMain' | 'direct_result_url'; url: string};
  studentScope: string[];
  observation: {observedAt: string; source: string; form: {method: string; assChecked: string[]; startDate: string; endDate: string; student: string}; pagination: Array<{classes: string; text: string; icon?: string; onclick: string | null}>; rows: Array<{assNo: number; pNo: number; testingNo: number; priNo: number; testingName: string; printTestingName: string; testTypeName: string; applyDate: string}>};
};
export type DiscoverySummary = {observedAt: string; sourceDigest: string; reportDigest: string; evidenceKind: DiscoveryEvidence['kind']; assessmentMode: 'NA'; displayedDateWindow: {from: string; through: string}; currentPage: string; coverage: 'observed_page_only_not_complete_history'; nextLink: 'disabled_observed' | 'active_or_unknown'; completeHistory: false};
export type DiscoveryResolution =
  | {state: 'not_applicable'; summary?: DiscoverySummary}
  | {state: 'selected'; candidate: HeaderCandidate; summary: DiscoverySummary}
  | {state: 'blocked'; code: string; candidates: HeaderCandidate[]; summary?: DiscoverySummary};
const validText = (x: unknown): x is string => typeof x === 'string' && !!x.trim();
function sourceRoute(raw: string, operation: string): boolean {
  try {const u = new URL(raw); return u.origin === 'https://dc.gang-a.kr' && !u.username && !u.password && u.pathname === '/servlet/controller.tutor.base.TestPageListServlet' && u.searchParams.getAll('p_process').length === 1 && u.searchParams.get('p_process') === operation && u.searchParams.getAll('ass_no').length === 1 && u.searchParams.get('ass_no') === '1002';} catch{return false;}
}
export function inspectDiscovery(evidence: DiscoveryEvidence): {ok: true; summary: DiscoverySummary} | {ok: false; code: string} {
  try {
    instant(evidence.observation.observedAt);
    const form=evidence.observation.form;
    if(evidence.entry.mode!=='canonical_UserByMain'||!sourceRoute(evidence.entry.url,'UserByMain')||!sourceRoute(evidence.observation.source,'UserBySearchTestResult'))return {ok:false,code:'SEARCH_ENTRY_UNVERIFIED'};
    if(form.method.toLowerCase()!=='post'||!form.assChecked.includes('check_na_test')||form.assChecked.some(x=>x!=='check_na_test')||!validText(form.student))return {ok:false,code:'SEARCH_CONDITIONS_UNVERIFIED'};
    for(const d of [form.startDate,form.endDate]) {if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return {ok:false,code:'DATE_FILTER_UNVERIFIED'};instant(d+'T00:00:00Z');}
    if(form.startDate>form.endDate)return {ok:false,code:'DATE_FILTER_UNVERIFIED'};
    const pages=evidence.observation.pagination.filter(x=>x.classes.split(/\s+/).includes('o2-page-select-box'));
    if(pages.length!==1||!/^\d+$/.test(pages[0]!.text)||Number(pages[0]!.text)<1)return {ok:false,code:'PAGE_STATE_UNVERIFIED'};
    const next=evidence.observation.pagination.filter(x=>x.icon==='angle-right');
    return {ok:true,summary:{observedAt:evidence.observation.observedAt,sourceDigest:evidence.sourceDigest,reportDigest:evidence.reportDigest,evidenceKind:evidence.kind,assessmentMode:'NA',displayedDateWindow:{from:form.startDate,through:form.endDate},currentPage:pages[0]!.text,coverage:'observed_page_only_not_complete_history',nextLink:next.length===1&&next[0]!.classes.split(/\s+/).includes('disable')&&next[0]!.onclick===null?'disabled_observed':'active_or_unknown',completeHistory:false}};
  } catch{return {ok:false,code:'SEARCH_CONDITIONS_UNVERIFIED'};}
}
export function resolveObservedHeader(evidence: DiscoveryEvidence, query: {studentKey: string; header: string; selection?: CandidateSelection}): DiscoveryResolution {
  if(!evidence.studentScope.includes(query.studentKey))return {state:'not_applicable'};
  const check=inspectDiscovery(evidence);if(!check.ok)return {state:'blocked',code:check.code,candidates:[]};
  const rows=evidence.observation.rows.filter(r=>String(r.priNo)===query.studentKey);
  if(!rows.length)return {state:'blocked',code:'NO_MATCH_IN_OBSERVED_FILTER_WINDOW',candidates:[],summary:check.summary};
  if(rows.some(r=>r.assNo!==1002||![r.pNo,r.testingNo,r.priNo].every(n=>Number.isSafeInteger(n)&&n>0)||![r.testingName,r.printTestingName,r.testTypeName,r.applyDate].every(validText)))return {state:'blocked',code:'MALFORMED_DISCOVERY_ROW',candidates:[],summary:check.summary};
  const candidates: HeaderCandidate[]=rows.filter(r=>r.printTestingName===query.header||r.testingName===query.header).map(r=>({fullTestingName:r.testingName,section:r.testTypeName,observedIds:{assNo:String(r.assNo),pNo:String(r.pNo),testingNo:String(r.testingNo),priNo:String(r.priNo)},shortHeader:r.printTestingName,applyDateExact:r.applyDate,occurredAt:null}));
  if(!candidates.length)return query.selection?{state:'blocked',code:'CANDIDATE_SELECTION_MISMATCH',candidates:[],summary:check.summary}:{state:'not_applicable',summary:check.summary};
  if(query.selection){const selected=candidates.filter(c=>c.fullTestingName===query.selection!.fullTestingName&&c.section===query.selection!.section&&digest(c.observedIds)===digest(query.selection!.observedIds));if(selected.length!==1)return {state:'blocked',code:'CANDIDATE_SELECTION_MISMATCH',candidates,summary:check.summary};return {state:'selected',candidate:selected[0]!,summary:check.summary};}
  if(candidates.length!==1)return {state:'blocked',code:'HEADER_AMBIGUOUS',candidates,summary:check.summary};
  // Even a currently unique abbreviated label is insufficient for an automatic assessment choice.
  if(query.header!==candidates[0]!.fullTestingName)return {state:'blocked',code:'FULL_HEADER_SELECTION_REQUIRED',candidates,summary:check.summary};
  return {state:'selected',candidate:candidates[0]!,summary:check.summary};
}

export type BracketRead = {
  first: {observedAt:string;url:string;icons:string[];rows:Array<{pNo:string;testingNo:string;priNo:number;score:number;items:Array<{ordinal:number;ox:string;originalOx:string;examScore:number;examScoreMax:number}>}>};
  answer:{observedAt:string;url:string;header:string;items:Array<{ordinal:number;label:string;answerText:string}>};
  second: BracketRead['first'];
};
/** Equal bracket observations provide corroboration, not an atomic snapshot or server version. */
export function inspectBracketRead(input: BracketRead, expected: ObservedIds) {
  const deny=(code:string)=>({ok:false as const,code,atomicSnapshot:false as const,serverRevision:null,historicalPrintProven:false as const});
  try {
    if(expected.assNo !== '1002')return deny('ASSESSMENT_MODE_UNVERIFIED');
    for(const p of [input.first,input.answer,input.second])instant(p.observedAt);
    if(!(Date.parse(input.first.observedAt)<=Date.parse(input.answer.observedAt)&&Date.parse(input.answer.observedAt)<=Date.parse(input.second.observedAt)))return deny('OBSERVATION_ORDER_INVALID');
    const parse=(part:BracketRead['first'])=>{
      const u=new URL(part.url);if(['p_process','p_no','testing_no'].some(k=>u.searchParams.getAll(k).length!==1)||u.username||u.password||u.origin!=='https://dc.gang-a.kr'||u.pathname!=='/servlet/controller.tutor.na.TestPageListServlet'||u.searchParams.get('p_process')!=='PupilSearch'||u.searchParams.get('p_no')!==expected.pNo||u.searchParams.get('testing_no')!==expected.testingNo)throw new Error();
      const rows=part.rows.filter(r=>r.pNo===expected.pNo&&r.testingNo===expected.testingNo&&String(r.priNo)===expected.priNo);if(rows.length!==1)throw new Error();const row=rows[0]!;
      if(!row.items.length||row.items.some((r,i)=>r.ordinal!==i+1||!['X','O'].includes(r.ox)||r.ox!==r.originalOx||!Number.isFinite(r.examScore)||!Number.isFinite(r.examScoreMax)||r.examScore<0||r.examScoreMax<=0||r.examScore>r.examScoreMax)||row.items.reduce((n,r)=>n+r.examScore,0)!==row.score)throw new Error();
      return {row:row,grades:row.items.map(r=>({ordinal:r.ordinal,ox:r.ox}))};
    };
    const first=parse(input.first),second=parse(input.second),a=new URL(input.answer.url);
    if(['p_process','p_no','testing_no'].some(k=>a.searchParams.getAll(k).length!==1)||a.username||a.password||a.origin!=='https://dc.gang-a.kr'||a.pathname!=='/servlet/controller.tutor.base.TestPageListServlet'||a.searchParams.get('p_process')!=='ViewAnswerList'||a.searchParams.get('p_no')!==expected.pNo||a.searchParams.get('testing_no')!==expected.testingNo)return deny('ASSESSMENT_JOIN_UNVERIFIED');
    if(input.answer.items.length!==first.grades.length||input.answer.items.some((r,i)=>r.ordinal!==i+1||!validText(r.label)))return deny('ORIGINAL_MEMBERSHIP_UNVERIFIED');
    if(digest(first.grades)!==digest(second.grades)||digest(first.row.items)!==digest(second.row.items)||first.row.score!==second.row.score)return deny('GRADING_CHANGED_BETWEEN_READS');
    return {ok:true as const,gradeItems:first.grades,orderedLabels:input.answer.items.map(i=>i.label),sourceObservedAt:{first:input.first.observedAt,labels:input.answer.observedAt,second:input.second.observedAt},sameGradingBeforeAndAfter:true as const,iconCorroboration:'not_admitted_unscoped_icon_collection' as const,iconCount:input.first.icons.length,itemCount:first.grades.length,atomicSnapshot:false as const,serverRevision:null,historicalPrintProven:false as const,scope:'one_exact_saved_NA_assessment' as const};
  } catch{return deny('ASSESSMENT_JOIN_UNVERIFIED');}
}
export const unsafeRetakeBoundary = {uiLabel:'재응시',operation:'deleteTestResult',effect:'write_reset_prior_exam_result',readRoute:false,wholeHandlerAllowed:false,executed:false,staticSourceOnly:true} as const;

export type RowScopedIconEvidence = {
  identity:{_id:string;pNo:string;priNo:number;testingNo:string};
  jsonJudgments:Array<{ordinal:number;originalOx:string;ox:string}>;
  observedAt:string;resultRowCount:number;resultRowIndex:string;
  rowItemIcons:Array<{groupIndex:string;ordinal:number;icons:string[]}>;
  globalCount:number;sourcePath:string;
};
/** Read-only DOM extraction evidence only. td[exam-no] click handlers mutate grading and are excluded. */
export function inspectRowScopedIcons(input:RowScopedIconEvidence,expected:ObservedIds,expectedJudgments:Array<{ordinal:number;ox:string}>) {
  const deny=(code:string)=>({ok:false as const,code,globalIconsAdmitted:false as const,clickAllowed:false as const});
  try {
    instant(input.observedAt);
    if(expected.assNo!=='1002'||input.sourcePath!=='/servlet/controller.tutor.na.TestPageListServlet'||input.identity.pNo!==expected.pNo||input.identity.testingNo!==expected.testingNo||String(input.identity.priNo)!==expected.priNo||input.identity._id!==`${expected.pNo}:${expected.priNo}`)return deny('ICON_ASSESSMENT_IDENTITY_UNVERIFIED');
    if(input.resultRowCount!==1||!/^\d+$/.test(input.resultRowIndex))return deny('ICON_DOM_ROW_AMBIGUOUS');
    const rows=input.rowItemIcons,judgments=input.jsonJudgments;
    if(!rows.length||rows.length!==judgments.length||rows.length!==expectedJudgments.length)return deny('ICON_ORDINAL_COVERAGE_UNVERIFIED');
    if(rows.some((x,i)=>x.ordinal!==i+1||x.groupIndex!==input.resultRowIndex||x.icons.length!==1)||judgments.some((x,i)=>x.ordinal!==i+1)||expectedJudgments.some((x,i)=>x.ordinal!==i+1))return deny('ICON_ROW_ORDINAL_JOIN_UNVERIFIED');
    if(judgments.some((x,i)=>!['X','O'].includes(x.ox)||x.originalOx!==x.ox||x.ox!==expectedJudgments[i]!.ox||rows[i]!.icons[0]!==`/image/score/${x.ox==='X'?'wrong':'right'}_bts.png`))return deny('ICON_JUDGMENT_CONFLICT');
    return {ok:true as const,observedAt:input.observedAt,itemCount:rows.length,globalIconsAdmitted:false as const,clickAllowed:false as const,
      provenance:{sourcePath:input.sourcePath,jsonIdentity:input.identity,domRowSelector:`tr.result-row[_id="${input.identity._id}"]`,reportedRowIndex:input.resultRowIndex,cellSelector:'td[exam-no]',ordinalJoin:'numeric exam-no equals judgment ordinal',groupJoin:'each reported groupIndex equals selected resultRowIndex'},
      scopedIcons:rows.map(x=>({ordinal:x.ordinal,icon:x.icons[0]!})),atomicSnapshot:false as const,serverRevision:null,historicalPrintProven:false as const};
  } catch{return deny('ICON_SCOPE_MALFORMED');}
}
