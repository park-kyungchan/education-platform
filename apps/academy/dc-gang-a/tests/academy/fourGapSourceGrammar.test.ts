import {expect,test} from 'bun:test';
import {digest} from '../../src/learning/model';
import {validateLearningAttempt,validateRawDailyRating,type RawDailyRatingV1} from '../../src/academy/learningWork';
import {activityScopeState,fixedConsumerProfile,scopeActionDefinitions,validateOwnerPayload,validateScopeMutation,type ActivityScopeLink} from '../../src/academy/contracts/prerequisiteRecords';
import {exactAttemptFixture} from './learningWorkFixtures';
import {objectRef} from './nativePrerequisiteContracts.test';

test('G1 closed fictional rating preserves genuine attempt identity and has no numeric interpretation',()=>{
  for(const lexeme of ['-1','10'] as const){
    const rawDailyRating:RawDailyRatingV1={schemaVersion:'1.0.0',family:'daily_rating_code',lexeme};
    const attempt={...exactAttemptFixture(),rawDailyRating};
    expect(()=>validateLearningAttempt(attempt)).not.toThrow();
    expect(attempt.attemptKey).toEqual(exactAttemptFixture().attemptKey);
    expect(Object.keys(rawDailyRating).sort()).toEqual(['family','lexeme','schemaVersion']);
    expect('score' in attempt).toBe(false);
  }
  expect(()=>validateLearningAttempt(exactAttemptFixture())).not.toThrow();
});
for(const lexeme of [-1,10,0,'0','-01','010','+10','10.0','1e1',' 10','10 ','−1','１０','',null,undefined]){
  test('G1 refuses lexical conversion '+JSON.stringify(lexeme),()=>{
    expect(()=>validateRawDailyRating({schemaVersion:'1.0.0',family:'daily_rating_code',lexeme} as RawDailyRatingV1)).toThrow();
  });
}
test('G1 rejects extra/mixed fields and rating cannot bypass the base attempt validator',()=>{
  const rawDailyRating={schemaVersion:'1.0.0',family:'daily_rating_code',lexeme:'10'} as const;
  for(const value of [{...rawDailyRating,score:10},{...rawDailyRating,schemaVersion:'2.0.0'},{...rawDailyRating,family:'numeric_score'}])expect(()=>validateRawDailyRating(value as RawDailyRatingV1)).toThrow();
  for(const value of [{rawDailyRating},{...exactAttemptFixture(),assignmentRevisionId:'',rawDailyRating},{...exactAttemptFixture(),rawDailyRating:undefined}])expect(()=>validateLearningAttempt(value as never)).toThrow();
});
const legacy=():ActivityScopeLink=>({kind:'activity_scope',activityKind:'HOMEWORK_ASSIGNMENT',activityRef:objectRef('HomeworkAssignment','invented-work','invented-revision'),recordScope:{studentRef:objectRef('Student','student-a'),classGroupRef:objectRef('ClassGroup','class-a'),businessDate:'2026-10-24',lessonRef:objectRef('LessonSession','lesson-a')},sourceLiteral:'invented explicit attachment',synthetic:true});
test('G4 validates exact legacy rows without mutating bytes and separates new mutation protocol',()=>{
  const old=legacy(),before=JSON.stringify(old);
  expect(activityScopeState(old)).toBe('ACTIVE');expect(JSON.stringify(old)).toBe(before);
  const definition=scopeActionDefinitions.AttachActivityScope;
  const action={name:definition.name,version:definition.version,definitionSha256:digest(definition)};
  expect(()=>validateScopeMutation(old,action,false)).toThrow('activity_scope_action_version');
  const current={...old,schemaVersion:'2.0.0',state:'ACTIVE'} as const;
  expect(()=>validateScopeMutation(current,action,false)).not.toThrow();
  expect(()=>validateScopeMutation({...current,state:'DETACHED'},action,false)).toThrow('activity_scope_terminal');
  for(const value of [{...old,state:'ACTIVE'},{...old,schemaVersion:'2.0.0'},{...current,state:'REATTACHED'},{...current,schemaVersion:'1.0.0'},{...current,recordScope:null},{...current,detachReason:'invented'}])expect(()=>validateOwnerPayload(value as never)).toThrow();
  for(const changed of [{...action,version:'2.0.0'},{...action,definitionSha256:'0'.repeat(64)},{...action,name:'CorrectActivityScope'}])expect(()=>validateScopeMutation(current,changed,false)).toThrow('activity_scope_action_version');
});
test('G3 exact profile definitions independently match their selected digests and preserved versions',()=>{
  const current=fixedConsumerProfile('CURRENT_1_1'),old=fixedConsumerProfile('OLD_SECTION_1_0');
  expect(digest(current.definition)).toBe('223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e');
  expect(digest(old.definition)).toBe(old.pins.consumerProfileDigest);
  for(const profile of [current,old]){expect(profile.pins.objects).toHaveLength(12);expect(profile.pins.links).toHaveLength(23);expect(Object.isFrozen(profile.definition)).toBe(true);}
  expect(current.definition.registry.version).toBe('1.1.0');expect(old.definition.registry.version).toBe('1.0.0');
  expect(current.definition.function.sha256).not.toBe(old.definition.function.sha256);
  expect(current.definition.query.sha256).not.toBe(old.definition.query.sha256);
});
