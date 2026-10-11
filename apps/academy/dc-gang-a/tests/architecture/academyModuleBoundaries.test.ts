import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..');
test('business contracts and consumers do not depend on the concrete PostgreSQL adapter',()=>{
  const files=['src/academy/application.ts','src/academy/refresh.ts','src/academy/teacherWorkContext.ts','src/academy/learningWorkProjection.ts','src/academy/sourceSynchronization.ts','src/academy/sourceBridge.ts','src/academy/sourceEvidence.ts'];
  const violations=files.filter(path=>/from\s+['"][^'"]*postgresStore['"]/.test(readFileSync(resolve(root,path),'utf8')));
  expect(violations).toEqual([]);
});

test('teacher UI consumes explicit operation contracts rather than application implementation types',()=>{
  const files=['client.ts','dateClassView.ts','clinicWorkView.ts','teacherObservationEditor.ts'];
  expect(files.filter(file=>/from\s+['"][^'"]*application['"]/.test(readFileSync(resolve(root,'src/academy/web',file),'utf8')))).toEqual([]);
});
