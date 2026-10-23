import {expect,test} from 'bun:test';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ItemLabelIndex} from '../src/item-labels.ts';
import {loadItemLabelIndex} from '../src/item-label-store.ts';
import {labelFixture,labelQuery} from './item-label-fixture.ts';
const index=()=>new ItemLabelIndex(labelFixture(),'a'.repeat(64));
test('context accompanies exact-scope lexical labels, without final item choice',()=>{
  const result=index().find(labelQuery);expect(result.status).toBe('available');
  if(result.status!=='available')throw Error('expected_available');
  expect(result.matches[0].id).toBe('label-002');
  expect(result.matches.every(row=>row.hierarchyId==='division')).toBe(true);
  expect(result.matches[0].labelExact).toBe('나머지 오류 설명');
  expect(result.matches[0].overlapTerms).toContain('word:오류');
  expect(result.userContext.requirements.questions).toBe(24);
  expect(result.source.liveCurrentness).toBe('not_verified');
  expect(result.finalItemMembershipCreated).toBe(false);
  expect(result.questionSelectionPerformed).toBe(false);
});
test('incomplete study is held, missing scope is rejected and zero matches preserve uncertainty',()=>{
  expect(index().find({...labelQuery,learningState:'in_progress'}).status).toBe('held');
  expect(()=>index().find({...labelQuery,hierarchyIds:['invented']})).toThrow('query_hierarchy_not_found');
  expect(()=>index().find({...labelQuery,hierarchyIds:['division','division']})).toThrow('duplicate_query_hierarchy');
  expect(()=>index().find({...labelQuery,studentId:'foreign'})).toThrow();
  const result=index().find({...labelQuery,intent:'xyz'});
  if(result.status!=='available')throw Error('expected_available');
  expect(result.matches).toEqual([]);expect(result.interpretation.zeroMatchesProveSourceAbsence).toBe(false);
});
test('source graphs fail closed on cycles, missing parent, duplicate IDs and foreign scope',()=>{
  let fixture=labelFixture();fixture.hierarchy[0].parentId='division';expect(()=>new ItemLabelIndex(fixture,'a'.repeat(64))).toThrow('cyclic_label_hierarchy');
  fixture=labelFixture();fixture.hierarchy[1].parentId='absent';expect(()=>new ItemLabelIndex(fixture,'a'.repeat(64))).toThrow('missing_hierarchy_parent');
  fixture=labelFixture();fixture.labels.push({...fixture.labels[0]});expect(()=>new ItemLabelIndex(fixture,'a'.repeat(64))).toThrow('duplicate_label_id');
  fixture=labelFixture();fixture.source.scopeHierarchyIds=['division'];expect(()=>new ItemLabelIndex(fixture,'a'.repeat(64))).toThrow('label_outside_declared_scope');
});
test('snapshot mutation cannot alter a frozen process index',()=>{
  const fixture=labelFixture(),snapshot=new ItemLabelIndex(fixture,'a'.repeat(64));fixture.labels[0].labelExact='changed';
  expect(snapshot.snapshot.labels[0].labelExact).toBe('나머지가 있는 나눗셈');
  expect(snapshot.scope({parentId:'root',limit:1}).nextOffset).toBe(1);
});
test('only explicit pinned regular snapshots load; no default discovery or symlink follows',async()=>{
  expect(await loadItemLabelIndex([])).toBe(null);
  const directory=await mkdtemp(resolve(tmpdir(),'academy-label-test-'));
  try{const path=resolve(directory,'snapshot.json'),bytes=JSON.stringify(labelFixture());await writeFile(path,bytes);
    const sha=createHash('sha256').update(bytes).digest('hex');
    expect((await loadItemLabelIndex(['--label-snapshot',path,'--label-sha256',sha]))!.snapshot.source.kind).toBe('synthetic_fixture');
    await expect(loadItemLabelIndex(['--label-snapshot',path,'--label-sha256','b'.repeat(64)])).rejects.toThrow('label_snapshot_hash_mismatch');
    const link=resolve(directory,'link.json');await symlink(path,link);
    await expect(loadItemLabelIndex(['--label-snapshot',link,'--label-sha256',sha])).rejects.toThrow('label_snapshot_symlink');
    await expect(loadItemLabelIndex(['--label-snapshot',directory,'--label-sha256',sha])).rejects.toThrow('label_snapshot_file_invalid');
  }finally{await rm(directory,{recursive:true,force:true});}
});
