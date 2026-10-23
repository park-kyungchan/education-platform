import test from 'node:test';
import assert from 'node:assert/strict';
import {bookIdentity,compareUnit,orderedSections,unitsFor} from '../presentation.ts';
import type {Student} from '../model.ts';
test('DaVinci series is not applicable, not missing; edition identity is not rewritten',()=>{
 assert.deepEqual(bookIdentity('다빈치 1-1-?'),{display:'다빈치 1-1',series:{state:'not_applicable',value:null},raw:'다빈치 1-1-?'});
 assert.equal(bookIdentity('다빈치 5-1-1').display,'다빈치 5-1');
 assert.equal(bookIdentity('가우스 5-1-2').series.state,'known');
 assert.equal(bookIdentity('정체 미확인').series.state,'unknown');
});
test('numeric unit order is stable and does not mutate input',()=>{
 const input=[{unitLabel:'1-10'},{unitLabel:'1-2'},{unitLabel:'unknown'},{unitLabel:'1-1'},{unitLabel:'1'}];
 assert.deepEqual(orderedSections(input).map(x=>x.unitLabel),['1','1-1','1-2','1-10','unknown']);
 assert.equal(input[0].unitLabel,'1-10');assert.equal(compareUnit('5-2','5-2'),0);
});
test('student book grouping does not merge old and new editions',()=>{
 const s={studentId:'fictional',name:'가상',books:[],sections:[{bookEditionId:'old',unitLabel:'4-1'},{bookEditionId:'new',unitLabel:'4-1'},{bookEditionId:'new',unitLabel:'4-2'}]} as Student;
 assert.equal(unitsFor(s,'old').length,1);assert.equal(unitsFor(s,'new').length,2);
});
