import type {LabelSnapshot} from '../src/item-labels.ts';
export const labelFixture=():LabelSnapshot=>({
  schemaVersion:'academy.item-label-snapshot/1',source:{kind:'synthetic_fixture',origin:'https://dc.gang-a.kr',
    entryPath:'/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main',tabPath:'/common/etest_pool.jsp',revision:'synthetic-rev-1',
    observedAt:'2026-10-16T00:00:00Z',evidenceRefs:['synthetic-only'],coverage:'partial',scopeHierarchyIds:['root']},
  hierarchy:[{id:'root',parentId:null,labelExact:'검증용 위계',evidenceRefs:['synthetic-only']},
    {id:'division',parentId:'root',labelExact:'나눗셈',evidenceRefs:['synthetic-only']},
    {id:'fraction',parentId:'root',labelExact:'분수',evidenceRefs:['synthetic-only']}],
  labels:[{id:'label-001',hierarchyId:'division',labelExact:'나머지가 있는 나눗셈',description:'나머지의 의미 설명',aliases:[],evidenceRefs:['synthetic-only']},
    {id:'label-002',hierarchyId:'division',labelExact:'나머지 오류 설명',description:'나머지가 나누는 수보다 큰 오류 설명',aliases:[],evidenceRefs:['synthetic-only']},
    {id:'label-003',hierarchyId:'fraction',labelExact:'단위분수 크기 비교',aliases:[],evidenceRefs:['synthetic-only']}],
});
export const labelQuery={intent:'나머지 오류 설명',hierarchyIds:['division'],learningState:'teacher_reported_complete' as const};
