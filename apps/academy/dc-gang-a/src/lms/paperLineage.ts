import {canonicalJson,requireText,type Knowledge} from '../learning/model';
import {createAcademySourceAudit} from './academySourceAudit';
import {readLiteralKey,readLiteralName,type StoredSourceRecord} from './academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';

export interface PaperTraceRequest {studentKey:string;studentName:string;orderedLabels:readonly string[]}
export interface PaperTraceSnapshot {evidenceRef:string;acquisition:unknown}
export interface OriginalItemMatch {
  matchNamespace:'lectureKey'|'outerLectureKey';sourceStudentKey:string;courseKey:string;bookNo:string;
  originalPaperKey:string;originalAttemptKey:string;sourceTitle:string;originalOrdinal:string;
  storedOriginalScoring:'O'|'X';sourceDate:StoredSourceRecord['sourceDate'];evidenceRefs:string[];
}
/** Index qualified retained source records once. This is original-attempt lineage, not clinic reconstruction. */
export function tracePaperLineage(request:PaperTraceRequest,snapshots:readonly PaperTraceSnapshot[]) {
  const studentKey=readLiteralKey(request.studentKey),studentName=readLiteralName(request.studentName);
  if(!Array.isArray(request.orderedLabels)||request.orderedLabels.length<1||request.orderedLabels.length>128)throw Error('invalid_paper_trace_scope');
  const orderedLabels=request.orderedLabels.map(readLiteralKey),index=new Map<string,Map<string,OriginalItemMatch>>();
  if(!Array.isArray(snapshots)||snapshots.length>64)throw Error('invalid_paper_trace_sources');
  for(const snapshot of snapshots){
    requireText(snapshot.evidenceRef,'source evidence');
    const audit=createAcademySourceAudit(snapshot.acquisition),source=readInputRecord(snapshot.acquisition);
    if(audit.content.sourceNamespace!=='academy_textbook')throw Error('textbook_lineage_source_required');
    for(const record of source.records as StoredSourceRecord[]){
      if(record.studentKey!==studentKey){if(record.studentName===studentName)throw Error('ambiguous_paper_trace_subject');continue;}
      if(record.studentName!==studentName)throw Error('paper_trace_subject_conflict');
      for(const item of record.items)for(const matchNamespace of ['lectureKey','outerLectureKey'] as const){
        const label=item[matchNamespace];if(label===null)continue;
        const match:OriginalItemMatch={matchNamespace,sourceStudentKey:studentKey,courseKey:record.courseKey,bookNo:record.bookNo,originalPaperKey:record.paperKey,originalAttemptKey:record.attemptKey,sourceTitle:record.sourceTitle,originalOrdinal:item.originalOrdinal,storedOriginalScoring:item.scoring,sourceDate:record.sourceDate,evidenceRefs:[]};
        const signature=canonicalJson(match),matches=index.get(label)??new Map<string,OriginalItemMatch>(),prior=matches.get(signature);
        if(prior){if(!prior.evidenceRefs.includes(snapshot.evidenceRef))prior.evidenceRefs.push(snapshot.evidenceRef);}
        else matches.set(signature,{...match,evidenceRefs:[snapshot.evidenceRef]});
        index.set(label,matches);
      }
    }
  }
  const unknown=(reason:string):Knowledge<string>=>({state:'unknown',reason});
  const items=orderedLabels.map((label,listIndex)=>({reportedLabel:label,reportedListPosition:listIndex+1,physicalPrintedOrdinal:unknown('List position is not verified printed numbering'),sourceMatches:[...(index.get(label)?.values()??[])],generatedPaperMembership:unknown('Original/shared item matches do not qualify generated clinic membership')}));
  return {schemaVersion:1,kind:'student_scoped_retained_original_paper_lineage',studentKey,studentName,orderedLabels,sourceEvidenceRefs:snapshots.map(x=>x.evidenceRef),items,
    matchedLabelOccurrences:items.filter(x=>x.sourceMatches.length).length,unmatchedLabels:items.filter(x=>!x.sourceMatches.length).map(x=>x.reportedLabel),
    generatedPaperIdentity:unknown('Exact generated paper/version/ordered membership and distribution require a separately qualified source contract'),
    answerVersion:unknown('Shared current answer content does not identify a printed answer version'),
    coverage:'selected_retained_original_attempts_not_complete_student_history',freshSourceReadPerformed:false,clinicGradeInferredFromOriginal:false,teacherInspectionInferred:false,academyWritePerformed:false};
}
