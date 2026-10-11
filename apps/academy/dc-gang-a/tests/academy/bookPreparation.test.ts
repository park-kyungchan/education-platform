import {describe,expect,test} from 'bun:test';
import {buildBookPreparation,validateCourseInventory,type SourceCourseInventory,type TeacherBookPreparationScope,type SourcePrestudySnapshot} from '../../src/academy/bookPreparation';
const key=(namespace:string,literalKey:string)=>({namespace,literalKey});
const inventory:SourceCourseInventory={kind:'source_course_inventory',sourceStudent:key('academy_student','91001'),sourceCourse:key('academy_course','92001'),sourceUserCourse:key('academy_user_course','93001'),sourceBook:key('academy_book','94001'),bookLabelLiteral:'Invented Gauss volume',courseVersionLiteral:'ver.3',coverage:'all_returned_course_units',evidenceRefs:['invented-source-contract'],units:[{sunitKey:'95001',bunitKey:'96001',sourceOrder:0,labelLiteral:'3-1 Invented first unit',progressCells:[{fieldId:'step_3_value_0',literal:'100'}]},{sunitKey:'95002',bunitKey:'96001',sourceOrder:1,labelLiteral:'3-4 Invented zero-wrong unit',progressCells:[{fieldId:'step_3_value_1',literal:'100'}]}]};
const scope:TeacherBookPreparationScope={kind:'teacher_book_preparation_scope',sourceCourse:inventory.sourceCourse,sourceBook:inventory.sourceBook,start:'book_beginning',upperBound:{state:'known',value:'95002',evidenceRefs:['invented-teacher-directive']},series:'gauss',teacherBookAliasLiteral:'Invented alias',directiveRef:'invented-teacher-directive'};
const videos:SourcePrestudySnapshot={kind:'source_prestudy_snapshot',sourceStudent:inventory.sourceStudent,teacherKey:'97001',coverage:'all_returned_requested_rows_not_all_time_history',evidenceRefs:['invented-video-read'],videos:[{prestudyKey:'98001',studentKey:'91001',teacherKey:'97001',courseKey:'92001',sunitKey:'95002',unitLabelLiteral:'3-4 Invented zero-wrong unit',versionLiteral:'1',lane:'teacher_unconfirmed',statusLiteral:'0',scoreLiteral:'0',createdLiteral:'2090-01-02',commentLiteral:''}]};
describe('source-bound per-book preparation projection',()=>{
 test('includes zero-wrong units from the complete source table and matches videos by source IDs, not title or version label',()=>{
  validateCourseInventory(inventory);
  const result=buildBookPreparation(inventory,scope,[videos]);
  expect(result.units).toHaveLength(2);
  expect(result.units[1]!.videoState).toBe('awaiting_teacher_review');
  expect(result.units[1]!.exactVideoRefs).toEqual(['98001']);
  expect(result.units[1]!.appGradingEstablished).toBe(false);
  expect(result.units[1]!.teacherCompletionEstablished).toBe(false);
  expect(result.readyEstablished).toBe(false);
 });
});
