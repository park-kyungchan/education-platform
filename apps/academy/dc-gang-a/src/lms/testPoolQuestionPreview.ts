/** Exact independently inspected original selector/helper revisions. Pins qualify code, not runtime authority. */
export const testPoolPreviewSourcePins=Object.freeze({
  selector:'dbe508a27dc8ea46dbdf5de697733e4c4c56afc5c766bacfa202997070e84992',
  helpers:'a42379a32fa0183f4a9f97f00d088cd09f4eb38e89f8d43a7432f3fb74483c50',
});
export function testPoolQuestionPreviewReferences(lectureKey:string,fields:Readonly<Record<string,unknown>>,selectorSha256:string,helpersSha256:string){
  if(selectorSha256!==testPoolPreviewSourcePins.selector||helpersSha256!==testPoolPreviewSourcePins.helpers)throw Error('test_pool_preview_source_unqualified');
  if(!/^[1-9][0-9]{0,8}$/.test(lectureKey))throw Error('test_pool_preview_key_unqualified');
  const key=Number(lectureKey),d6=('000'+Math.floor(key/1000000)).slice(-3),d4=('00'+Math.floor(key%1000000/10000)).slice(-2),d2=('00'+Math.floor(key%10000/100)).slice(-2);
  return (['obj','sbj','des'] as const).flatMap(type=>fields[type+'_option']==='D'||fields[type+'_option']==='Y'?[{
    type,url:`https://storage.studyq.net/data/contents/exam/d6-${d6}/d4-${d4}/d2-${d2}/ek-${lectureKey}/${lectureKey}-examcard-${type}.png`,
    source:'original_previewDBExam_and_common_function_js' as const,contentFetched:false as const,
  }]:[]);
}
