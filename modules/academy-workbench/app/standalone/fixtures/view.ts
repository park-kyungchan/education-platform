/** Pure fiction for UI layout only. No imported, copied, masked or anonymized student record. */
export const SYNTHETIC_NOTICE = '완전 합성 QA · 실제 학생 0명 · 로그인·학원 서버·native WebMCP 검증 아님';
const hash=(n:number)=>n.toString(16).padStart(64,'0');
const stamp='2030-01-08T00:00:00.000Z';
export const students=Array.from({length:5},(_,n)=>({id:`fiction-student-${n+1}`,displayName:['가상학생 가람','가상학생 나래','가상학생 다온','가상학생 라온','가상학생 마루'][n],managementState:'active'}));
const sections=['개념 정리','기본 문제','응용 문제','단원 마무리'];
export function makeView(id:string){
 const number=students.findIndex(s=>s.id===id),records:Record<string,any>={},books:any[]=[],includedContents:any[]=[],candidates:any[]=[];
 for(let b=1;b<=3;b++){
  const rows:any[]=[],bookCode=`FICTION-${b}`,bookTitle=['가상 수학 탐구 A','가상 수학 탐구 B: 긴 교재명 반응형 검수','가상 개념 연습 C'][b-1];
  for(let m=1;m<=2;m++){
   const major=`${id}-book${b}-major${m}`;rows.push({id:major,label:`${m}`,title:`가상 대단원 ${m}`,level:'major',parentId:null,recordIds:[],raw:{printedStartPage:10*m,tocEvidencePdfPage:null}});
   for(let u=1;u<=2;u++){
    const rowId=`${major}-unit${u}`,unitLabel=`${m}.${u}`,unitTitle=u===1?'가상 수의 관계':'길이가 긴 가상 단원 제목과 수학적 표현을 탐구하는 연습',recordIds:string[]=[];
    for(let s=0;s<4;s++){
     const rid=`${rowId}-section${s}`,withAttempt=(s+u+b+number)%2===0,catalogCode=`F${b}M${m}U${u}S${s}`,score=[65,80,95,100][(s+m+u+number)%4];
     const attempt={sourceAttemptId:`${rid}-attempt1`,sourceAttemptKey:`${rid}-attempt1`,score,dateRaw:'1월 7일 (합성)',yearState:'unknown',timezoneState:'unknown',occurredAt:null,effectiveAt:null,observedAt:null,recordedAt:stamp,nativeAttemptId:null,sourceResultLabel:'합성 점수 관찰',clinicText:'합성 클리닉 메모',sourceUrl:null};
     records[rid]={recordId:rid,tocNodeRef:rowId,bookCode,bookDisplayName:bookTitle,edition:2030,unitLabel,unitTitle,sectionDisplayLabel:sections[s],sectionSourceLabel:sections[s],publicSectionLabel:sections[s],publicSectionTemplateRef:`section-${s}`,catalogCode,lessonIndex:s+1,performanceState:withAttempt?'observed':s===2?'observed_absent':'not_checked',evidenceState:withAttempt?'observed':'not_checked',mappingState:s===3?'mapping_unknown':'provisional_catalog_join',sectionApplicabilityState:'observed_in_native_catalog',catalogPresence:'observed_in_native_catalog',attemptEvidence:withAttempt?[attempt]:[],teacherVerdict:{state:'not_determined',value:'unknown',note:'합성 테스트에서 완료를 추정하지 않습니다.'},paperEvidence:{state:'not_checked'},progressDecision:'not_determined',diaryAssertions:[],sourceUrls:[]};recordIds.push(rid);
     if(withAttempt&&candidates.length<12)candidates.push({number:candidates.length+1,sourceRecordKey:rid,sourceAttemptKey:attempt.sourceAttemptKey,score,attemptRawDate:attempt.dateRaw,appCatalogCode:catalogCode,originalWrongReview:candidates.length%3===0?'teacher_confirmed_complete':'unknown',similarClinicReview:candidates.length%4===0?'teacher_confirmed_complete':'unknown',printHeaderVerified:false,printExistence:'unknown',verifiedPrintTestCode:null,reviewEvidence:{originalWrong:{evidenceClass:'fictional_teacher_report',recordedAt:stamp},similarClinic:null},deliveryPlan:candidates.length%2===0?{state:'planned',pickupAtLocal:'2030-01-09T16:00:00',precision:'approximate',generatedAt:null,printedAt:null,deliveredAt:null}:null});
    }
    rows.push({id:rowId,label:unitLabel,title:unitTitle,level:'subunit',parentId:major,recordIds,raw:{printedStartPage:10*m+u,tocEvidencePdfPage:null}});
    includedContents.push({sourceRecordKey:`${rowId}-included`,printedSourceLabel:'서술형 합성 포함 내용',tocNodeRef:rowId,parentSourceRecordId:recordIds[3],parentCatalogCode:records[recordIds[3]].catalogCode,parentLessonIndex:4,nativeBindingState:'fictional_inclusion_only'});
   }
  }
  books.push({key:`${id}-book${b}`,label:bookTitle,edition:2030,rows,raw:{bookCode,originalBookTitle:bookTitle,sourceEditionBinding:{publicRevisionLabel:'합성 판본'},sectionFlow:sections.map((sourceLabel,order)=>({sourceLabel,order,cacheRef:`section-${order}`}))},tocCoverage:{state:'native_catalog_only'},performanceCoverage:{attemptObservationCount:rows.flatMap(r=>r.recordIds).filter(r=>records[r].attemptEvidence.length).length}});
 }
 const view={studentLabel:students[number].displayName,books,records,unmappedRecordIds:[],sourceContractVersion:'synthetic-qa-only/1',sourceAsOf:{studentPerformance:null,editionCacheVerifiedAt:null},unmappedAssertions:[{dateRaw:'합성 날짜',statement:'합성 일지 연결 미확정 원문',reason:'화면 검수를 위한 허구',sourceUrl:null}],raw:{currentHomeworkSource:'가상 문제집 p.12~15 · 가상 배정'},inputSha256:hash(1),notebookEvidence:[],questionCoverage:{state:'not_captured',observedItemCount:0,totalItems:null},terminologyPolicy:{synthetic:true}};
 for(const candidate of candidates)if(candidate.number%3===0){candidate.printExistence='user_confirmed_present';candidate.printConfirmation={state:'user_confirmed_complete',recordedAt:stamp,printedTimeRaw:'합성 인쇄 보고 날짜',printedAt:null,printedAtState:'relative_time_only_no_authoritative_timestamp',sourceMessageId:`fiction-print-message-${candidate.number}`,eventId:`fiction-print-event-${candidate.number}`,remediationPaths:['original_wrong','similar_clinic'],printedPageCount:null,actualPrintedSheetCount:null,materialIds:null,printHeaderVerified:false};}
 return {view,includedContents,candidates};
}
