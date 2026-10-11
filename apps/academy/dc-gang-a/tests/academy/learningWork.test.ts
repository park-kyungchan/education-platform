import {describe,expect,test} from 'bun:test';
import {validateAcademyRecord,type AcademyRecord} from '../../src/academy/records';
import {exactWorkFixture,exactAttemptFixture,learningFixture} from './learningWorkFixtures';
test('exact assigned sections/items and printed ordering are retained as a validated record',()=>{
  const assignment=exactWorkFixture();
  expect(()=>validateAcademyRecord(assignment as unknown as AcademyRecord)).not.toThrow();
  const duplicate=structuredClone(assignment);duplicate.items.push(duplicate.items[0]!);
  expect(()=>validateAcademyRecord(duplicate as unknown as AcademyRecord)).toThrow('duplicate_work_item');
  const wrongPaper=structuredClone(assignment);if(wrongPaper.paper.state==='known')wrongPaper.paper.value.orderedItems[0]!.assignedItemId='foreign';
  expect(()=>validateAcademyRecord(wrongPaper as unknown as AcademyRecord)).toThrow('paper_item_membership_conflict');
});
test('repeated source items retain distinct assigned occurrences and printed positions',()=>{
  const assignment=exactWorkFixture();assignment.items[1]!.itemKey=assignment.items[0]!.itemKey;
  expect(()=>validateAcademyRecord(assignment as unknown as AcademyRecord)).not.toThrow();
});
describe.skipIf(!process.env.DC_ACADEMY_TEST_SOCKET)('persisted exact work bindings',()=>{
  test('R1: source-item identity must match its pinned problem while repeated assigned occurrences may share that exact source',async()=>{
    const f=await learningFixture();try{
      const wrong=structuredClone(f.assignment);wrong.items[0]!.itemKey={namespace:'unqualified-alias',literalKey:'foreign'};
      await expect(f.append('wrong-item',wrong)).rejects.toThrow('work_source_item_binding_conflict');
      const repeated=structuredClone(f.assignment);repeated.items[1]!.itemKey=repeated.items[0]!.itemKey;repeated.items[1]!.contentNodeId=repeated.items[0]!.contentNodeId;
      const saved=await f.append('repeated',repeated);expect(saved.status).toBe('saved');
      expect((await f.store.history(f.owner,f.studentId,'repeated'))[0]!.payload).toEqual(repeated);
    }finally{await f.db.close();}
  });
  test('attempts bind an exact assigned revision and issuance; repeats and source-grade revisions remain distinct',async()=>{
    const f=await learningFixture();try{
      const work=await f.append('work',f.assignment),attempt={...exactAttemptFixture(),assignmentRevisionId:work.revisionId};
      const first=await f.append('attempt',attempt as unknown as AcademyRecord);
      await expect(f.append('foreign',{...attempt,assignmentRevisionId:'foreign'} as unknown as AcademyRecord)).rejects.toThrow('work_assignment_basis_conflict');
      await expect(f.append('duplicate',attempt as unknown as AcademyRecord)).rejects.toThrow('duplicate_work_identity');
      await expect(f.append('bad-paper',{...attempt,attemptKey:{...attempt.attemptKey,literalKey:'different'},paperIssuanceKey:{namespace:'fixture_issuance',literalKey:'wrong'}} as unknown as AcademyRecord)).rejects.toThrow('work_paper_binding_conflict');
      const repeated={...attempt,attemptKey:{...attempt.attemptKey,literalKey:'attempt-2'},previousAttemptRevisionId:first.revisionId};
      const second=await f.append('repeat',repeated as unknown as AcademyRecord);
      expect(second.revisionId).not.toBe(first.revisionId);
      await expect(f.append('attempt',{...attempt,assignmentRevisionId:second.revisionId} as unknown as AcademyRecord,first.revisionId)).rejects.toThrow('work_assignment_basis_conflict');
      const changed=structuredClone(attempt);changed.itemResults[0]!.assignedItemId='foreign';
      await expect(f.append('attempt',changed as unknown as AcademyRecord,first.revisionId)).rejects.toThrow('work_item_binding_conflict');
    }finally{await f.db.close();}
  });
  test('registration pins, assignment identity and paper reissuance cannot be silently rebound',async()=>{
    const f=await learningFixture();try{
      await expect(f.append('bad-registration',{...f.assignment,registrationRevisionId:'foreign'})).rejects.toThrow('work_registration_binding_conflict');
      const first=await f.append('work',f.assignment);
      await expect(f.append('duplicate',f.assignment)).rejects.toThrow('duplicate_work_identity');
      await expect(f.append('work',{...f.assignment,assignmentKey:{...f.assignment.assignmentKey,literalKey:'different'}},first.revisionId)).rejects.toThrow('work_identity_changed');
      const reissue=structuredClone(f.assignment);reissue.assignmentKey.literalKey='assignment-2';
      if(reissue.paper.state!=='known')throw Error('fixture');
      reissue.paper.value.issuanceKey.literalKey='issuance-2';reissue.paper.value.reissueOf={namespace:'fixture_issuance',literalKey:'missing'};
      await expect(f.append('reissue',reissue)).rejects.toThrow('paper_reissue_predecessor_missing');
      reissue.paper.value.reissueOf.literalKey='issuance-1';
      const saved=await f.append('reissue',reissue);expect(saved.revisionId).not.toBe(first.revisionId);
      const mutated=structuredClone(reissue);if(mutated.paper.state!=='known')throw Error('fixture');mutated.paper.value.versionLiteral='changed';
      await expect(f.append('reissue',mutated,saved.revisionId)).rejects.toThrow('paper_issuance_rebound');
      expect(await f.store.history(f.owner,f.studentId,'work')).toHaveLength(1);
    }finally{await f.db.close();}
  });
  test('assignment refuses unknown catalog versions and unregistered course before storing anything',async()=>{
    const f=await learningFixture();try{
      const wrong=structuredClone(f.assignment);wrong.catalogRefs[0]!.revisionId='foreign';
      await expect(f.append('work',wrong)).rejects.toThrow('work_catalog_binding_conflict');
      await expect(f.append('work',{...f.assignment,sourceCourse:{namespace:'academy_course',literalKey:'foreign'}})).rejects.toThrow('preparation_book_binding_conflict');
      const first=await f.append('work',f.assignment);
      expect((await f.store.history(f.owner,f.studentId,'work'))[0]!.payload).toEqual(f.assignment);
      expect(first.officialSaved).toBe(false);
    }finally{await f.db.close();}
  });
});
