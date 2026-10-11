import {parseItemMetadata,type ItemMetadataEnvironment,type ItemMetadataObservation} from './itemMetadataRead';

export interface ItemAnswerObservation extends ItemMetadataObservation {
  answerLiteral:string;
  answerAvailability:'literal_payload_not_rendered'|'external_solution_reference';
  answerMeaning:'source_official_item_answer_not_student_response';
  rendering:'not_qualified';
  paperMembership:'unqualified';
}
/** Exact answer content is independent of student attempts, paper membership and renderer qualification. */
export function parseItemAnswer(input:unknown,lectureKey:string):ItemAnswerObservation {
  const metadata=parseItemMetadata(input,lectureKey);
  const row=(input as {rows:Record<string,unknown>[]}).rows[0]!;
  if(typeof row.answer!=='string'||!row.answer.trim()||row.answer.length>30000)throw Error('item_answer_missing_or_schema_drift');
  const answerAvailability=row.answer==='3|_|서술형 문제의 답안은 정답,해설파일을 참조'
    ?'external_solution_reference':'literal_payload_not_rendered';
  return {...metadata,answerLiteral:row.answer,answerAvailability,answerMeaning:'source_official_item_answer_not_student_response',rendering:'not_qualified',paperMembership:'unqualified'};
}
export async function readItemAnswer(lectureKey:string,environment:ItemMetadataEnvironment):Promise<ItemAnswerObservation> {
  if(environment.origin!=='https://dc.gang-a.kr'||environment.authenticatedTeacherVisible!==true)throw Error('authentication_required');
  if(typeof lectureKey!=='string'||!/^[1-9][0-9]{0,15}$/.test(lectureKey)||BigInt(lectureKey)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('invalid_item_request_key');
  const query=new URLSearchParams({p_process:'GetLectureList',lecture_list:lectureKey});
  const response=await environment.fetcher('/servlet/controller.common.TestPageShowExServlet?'+query,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok||response.redirected)throw Error('item_transport_failed');
  const text=await response.text();
  if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('item_source_contract_refused');
  return parseItemAnswer(JSON.parse(text),lectureKey);
}
