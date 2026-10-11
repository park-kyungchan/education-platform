import {expect,test} from 'bun:test';
import {tracePaperLineage} from '../../src/lms/paperLineage';
const acquisition={schemaVersion:1,family:'textbook',status:'observed',records:[{studentKey:'7001',studentName:'Invented student',courseKey:'7101',bookNo:'1',paperKey:'7201',attemptKey:'7301',sourceTitle:'Invented unit/type practice',score:50,items:[{originalOrdinal:'4',lectureKey:'8101',outerLectureKey:'8201',scoring:'X'}],sourceDate:{literal:'10-05',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}}],dailyResults:[],dayRecords:[],observedAt:'2026-10-05T01:00:00Z',coverage:'exact_selected_existing_records_not_whole_book',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false};
test('student-scoped original paper matches never certify the distributed clinic',()=>{
  const result=tracePaperLineage({studentKey:'7001',studentName:'Invented student',orderedLabels:['8101','8201','8301']},[{evidenceRef:'invented-source.json',acquisition}]);
  expect(result.items[0]!.sourceMatches[0]).toMatchObject({matchNamespace:'lectureKey',originalOrdinal:'4',originalPaperKey:'7201',originalAttemptKey:'7301',evidenceRefs:['invented-source.json']});
  expect(result.items[1]!.sourceMatches[0]!.matchNamespace).toBe('outerLectureKey');
  expect(result.unmatchedLabels).toEqual(['8301']);expect(result.generatedPaperIdentity.state).toBe('unknown');
  expect(result.items[0]!.physicalPrintedOrdinal.state).toBe('unknown');
});
test('same-name foreign subjects and identity conflicts cannot become own-paper evidence',()=>{
  const scope={studentKey:'7001',studentName:'Invented student',orderedLabels:['8101']};
  const foreign=structuredClone(acquisition);foreign.records[0]!.studentKey='7002';
  expect(()=>tracePaperLineage(scope,[{evidenceRef:'invented-foreign.json',acquisition:foreign}])).toThrow('ambiguous_paper_trace_subject');
  const conflict=structuredClone(acquisition);conflict.records[0]!.studentName='Invented other student';
  expect(()=>tracePaperLineage(scope,[{evidenceRef:'invented-conflict.json',acquisition:conflict}])).toThrow('paper_trace_subject_conflict');
});
test('duplicate captures retain refs without duplicating the original item relation',()=>{
  const result=tracePaperLineage({studentKey:'7001',studentName:'Invented student',orderedLabels:['8101','8101']},[{evidenceRef:'first.json',acquisition},{evidenceRef:'second.json',acquisition}]);
  expect(result.items).toHaveLength(2);expect(result.items[0]!.sourceMatches).toHaveLength(1);
  expect(result.items[0]!.sourceMatches[0]!.evidenceRefs).toEqual(['first.json','second.json']);
});
