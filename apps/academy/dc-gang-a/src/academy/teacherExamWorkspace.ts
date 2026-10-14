import {assertExactKeys,assertInstant,canonicalJson} from '../learning/model';
import {inspectExamSelection,type ExamCandidate,type ExamSelectionWorkspace} from './examSelection';
/** Persistent local selection and source claims; adapter qualification and teacher approval remain separate. */
export interface TeacherExamSelectionDraft {
 kind:'teacher_exam_selection_draft';draftId:string;reportedAt:string;studentBinding:null;evidenceRevisionIds:[];
 workspace:ExamSelectionWorkspace;candidates:ExamCandidate[];sourceQualification:'not_verified_by_workspace';
 teacherAccepted:false;printed:false;published:false;officialSaved:false;
}
export function validateTeacherExamDraft(payload:TeacherExamSelectionDraft){
 canonicalJson(payload);assertExactKeys(payload,['kind','draftId','reportedAt','studentBinding','evidenceRevisionIds','workspace','candidates','sourceQualification','teacherAccepted','printed','published','officialSaved']);
 if(payload.kind!=='teacher_exam_selection_draft'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/).test(payload.draftId)||payload.studentBinding!==null||!Array.isArray(payload.evidenceRevisionIds)||payload.evidenceRevisionIds.length||payload.sourceQualification!=='not_verified_by_workspace'||payload.teacherAccepted!==false||payload.printed!==false||payload.published!==false||payload.officialSaved!==false)throw Error('invalid_teacher_exam_draft');
 assertInstant(payload.reportedAt);inspectExamSelection(payload.workspace,payload.candidates);
}
