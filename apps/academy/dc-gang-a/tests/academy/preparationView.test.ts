import {expect,test} from 'bun:test';
import {buildStudentPreparation} from '../../src/academy/preparationHistory';
import {preparationView} from '../../src/academy/web/preparationView';
test('teacher presentation preserves unknown coverage and rejects another selected date',()=>{
 const source=buildStudentPreparation({namespace:'academy_student',literalKey:'91001'},[],'2090-01-02');
 const result=preparationView(source,'2090-01-02');
 expect(result.books).toEqual([]);
 expect(result.coverageLabel).toBe('전체 숙제 범위·문항 연결 미확정');
 expect(()=>preparationView(source,'2090-01-03')).toThrow('preparation_scene_date_conflict');
});
