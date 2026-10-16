import type { SourceContext, StudyScope } from './contracts.ts';
export interface ScopeCompatibility {
 state:'compatible'|'unknown'|'conflict';
 fields:Record<'edition'|'unit','equal-literals'|'unknown'|'conflict'>;
 warnings:string[];
}
/** Teacher declaration and observed native metadata are distinct claims.
 * Equal known literals permit comparison; they never prove edition identity or mathematical equivalence. */
export function compareScopeMetadata(teacher:Pick<StudyScope,'edition'|'unit'>,source:Pick<SourceContext,'edition'|'unit'>):ScopeCompatibility {
 const field=(key:'edition'|'unit')=>teacher[key]===null||source[key]===null?'unknown' as const:teacher[key]===source[key]?'equal-literals' as const:'conflict' as const;
 const fields={edition:field('edition'),unit:field('unit')};
 if(Object.values(fields).includes('conflict'))return {state:'conflict',fields,warnings:['입력한 학습 범위와 학원 원천에서 확인된 판본·단원 정보가 서로 달라 비교를 보류합니다.']};
 if(Object.values(fields).includes('unknown'))return {state:'unknown',fields,warnings:[(['edition','unit'] as const).some(k=>teacher[k]!==null&&source[k]===null)?'학습 범위는 입력했지만 학원 원천의 판본·단원은 아직 확인되지 않아 적합성은 미확인입니다.':'학습 범위 또는 학원 원천의 판본·단원 정보가 확인되지 않아 적합성은 미확인입니다.']};
 return {state:'compatible',fields,warnings:['판본·단원 문자열이 일치한다는 사실만으로 동일 판본 또는 수학적 적합성이 입증되지는 않습니다.']};
}
