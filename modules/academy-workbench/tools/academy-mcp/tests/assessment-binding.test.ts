import {expect,test} from 'bun:test';
import {assessmentBindingSchema,assessmentEnvelope} from '../src/assessment-binding.ts';
import {findItemLabelsInputSchema} from '../src/item-labels.ts';
const binding={schemaVersion:'academy.assessment-binding/1',research:{owner:'math-research-module',revision:'07edb2dea2e5997aea4318f0fa2efa21dde633df',pins:[{path:'source/types.json',sha256:'a'.repeat(64)}]},sourceContext:null,study:null,intent:null};
test('research binding preserves exact provenance without replacing original user context or granting acceptance',()=>{
  const input=findItemLabelsInputSchema.parse({assessmentBinding:binding,intent:'곱셈 설명',hierarchyIds:['original'],learningState:'in_progress'});
  const out=assessmentEnvelope(input,{userContext:{purpose:'original meaning'},status:'held'}) as any;
  expect(out.userContext.purpose).toBe('original meaning');expect(out.assessmentBinding).toEqual(binding);expect(out.researchAcceptance).toBe('not_inferred');expect(out.finalItemMembershipCreated).toBe(false);expect(out.assessmentBindingSha256).toMatch(/^[a-f0-9]{64}$/);
});
test('superseded revisions, duplicate pins and caller authority fields cannot bind a research request',()=>{
  expect(()=>assessmentBindingSchema.parse({...binding,research:{...binding.research,revision:'4d66eec0cf058a87f788b28d7cda2e845674524c'}})).toThrow();
  expect(()=>assessmentBindingSchema.parse({...binding,research:{...binding.research,pins:[...binding.research.pins,...binding.research.pins]}})).toThrow();
  expect(()=>assessmentBindingSchema.parse({...binding,approved:true})).toThrow();
});
test('bound requests cannot replace study report or exact source scope with an unrelated legacy flag',async()=>{
 const {validateAssessmentOperation}=await import('../src/assessment-binding.ts');
 const sourceContext={owner:'academy',sourceRevision:'source',scopeId:'original',edition:null,unit:null};
 const study={scope:{researchTypeIds:['type'],researchRevision:binding.research.revision,edition:null,unit:null},studied:false,summary:'in progress',evidenceNotes:[],attribution:'teacher-reported',acceptance:false};
 const intent={axes:{structure:'groups',reasoning:'',representation:'',conditions:'',errors:'',transfer:''},notes:''};
 const b=assessmentBindingSchema.parse({...binding,sourceContext,study,intent});
 expect(()=>validateAssessmentOperation({assessmentBinding:b,learningState:'teacher_reported_complete',hierarchyIds:['original']},'find')).toThrow('assessment_study_report_conflict');
 expect(()=>validateAssessmentOperation({assessmentBinding:{...b,study:{...b.study!,studied:true}},learningState:'teacher_reported_complete',hierarchyIds:['foreign']},'find')).toThrow('assessment_source_scope_conflict');
 expect(()=>validateAssessmentOperation({assessmentBinding:b,purpose:'protocol_verification',hierarchyId:'original'},'review')).not.toThrow();
 const protocol={...b,study:null,intent:null};
 expect(()=>validateAssessmentOperation({assessmentBinding:protocol,purpose:'protocol_verification',hierarchyId:'original'},'review')).not.toThrow();
 expect(()=>validateAssessmentOperation({assessmentBinding:protocol,purpose:'protocol_verification',hierarchyId:'foreign'},'review')).toThrow('assessment_source_scope_conflict');
 expect(()=>validateAssessmentOperation({assessmentBinding:{...b,sourceContext:{...b.sourceContext!,edition:'known-edition'},study:{...b.study!,scope:{...b.study!.scope,edition:'foreign-edition'}}},purpose:'protocol_verification',hierarchyId:'original'},'review')).toThrow('assessment_edition_unit_conflict');
});
test('unknown edition/unit permit provisional reads without filling source metadata; only known differences conflict',async()=>{
 const {validateAssessmentOperation}=await import('../src/assessment-binding.ts');
 const b=assessmentBindingSchema.parse({...binding,sourceContext:{owner:'academy',sourceRevision:'source',scopeId:'original',edition:null,unit:null},study:{scope:{researchTypeIds:['type'],researchRevision:binding.research.revision,edition:'teacher-edition',unit:'teacher-unit'},studied:true,summary:'Explicit teacher report',evidenceNotes:[],attribution:'teacher-reported',acceptance:false},intent:{axes:{structure:'groups',reasoning:'',representation:'',conditions:'',errors:'',transfer:''},notes:''}});
 const find={assessmentBinding:b,learningState:'teacher_reported_complete',hierarchyIds:['original']};
 expect(()=>validateAssessmentOperation(find,'find')).not.toThrow();
 expect(()=>validateAssessmentOperation({assessmentBinding:b,purpose:'teacher_requested_review',hierarchyId:'original'},'review')).not.toThrow();
 const out=assessmentEnvelope(find,{status:'available'}) as any;
 expect(out.assessmentBinding.sourceContext.edition).toBeNull();expect(out.assessmentBinding.sourceContext.unit).toBeNull();
 expect(out.comparisonLimitations).toHaveLength(2);expect(out.researchAcceptance).toBe('not_inferred');
 for(const field of ['edition','unit'] as const){
  const equal={...b,sourceContext:{...b.sourceContext!,[field]:b.study!.scope[field]}};
  expect(()=>validateAssessmentOperation({...find,assessmentBinding:equal},'find')).not.toThrow();
  expect(()=>validateAssessmentOperation({...find,assessmentBinding:{...equal,sourceContext:{...equal.sourceContext,[field]:'different-source-value'}}},'find')).toThrow('assessment_edition_unit_conflict');
 }
 expect(()=>validateAssessmentOperation({...find,assessmentBinding:{...b,study:{...b.study!,scope:{...b.study!.scope,edition:null}},sourceContext:{...b.sourceContext!,edition:'known-source-edition'}}},'find')).not.toThrow();
});
