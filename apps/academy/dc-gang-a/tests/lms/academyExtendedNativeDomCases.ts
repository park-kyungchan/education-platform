import { createAcademyReadPlan, executeAcademyRead } from '../../src/lms/academyReadProtocol';


/** Invented source documents evaluated by a real native DOM. All fetches are injected. */
export async function runExtendedNativeDomRegression() {
  const results = [];
  const request = { family: 'student_course', teacherLabel: 'Invented Teacher', studentKey: '9101', studentName: 'Invented Student' };
  for (const id of ['exact_course', 'empty_course', 'foreign_course', 'wrong_principal', 'result_principal_drift'] as const) {
    let calls = 0;
    let error: string | null = null;
    let rows: number | null = null;

    const form = (principal: string) => `<form name="form1"><input name="g_clg_no" value="5101"><input name="g_mem_type" value="t"><input name="g_pri_no" value="${principal}"></form>`;
    const html = `${form(id === 'result_principal_drift' ? '1102' : '1101')}<table><tr>${['Invented Student', 'Invented course', '2099-01-01', '2099-12-31', 'Source status', 'Control', 'Control'].map((text, i) => `<td>${text}${i === 4 ? `<button onclick="onChangeStatus(1,5101,${id === 'foreign_course' ? '9102' : '9101'},6101,7101)"></button>` : i === 5 ? `<button onclick="onResetCourse(6101,9101,5101)"></button>` : i === 6 ? `<button onclick="onDeleteCourse(5101,9101,6101,7101)"></button>` : ''}</td>`).join('')}</tr></table>`;
    try {
      const result = await executeAcademyRead(createAcademyReadPlan(request), {
        origin: 'https://dc.gang-a.kr', authenticatedTeacherVisible: true, principalKey: '1101',
        fetcher: async (url, init) => {
          calls++;
          if (calls === 1) {
            if (init.method !== 'GET' || !url.endsWith('?reqCmd=StudyCourse')) throw Error('synthetic_transport_contract');
            return new Response(form(id === 'wrong_principal' ? '1102' : '1101'));
          }
          if (calls !== 2 || init.method !== 'POST' || new URLSearchParams(String(init.body)).get('student_name') !== request.studentName) throw Error('synthetic_transport_contract');
          return new Response(id === 'empty_course' ? form('1101') : html);
        },
      });
      rows = result.studentCourses?.length ?? null;

    } catch (e) { error = e instanceof Error ? e.message : 'untyped_error'; }
    const expected = id === 'foreign_course' ? 'course_source_identity_conflict' : ['wrong_principal', 'result_principal_drift'].includes(id) ? 'course_principal_conflict' : null;
    results.push({ id, pass: expected ? error === expected && calls === (id === 'wrong_principal' ? 1 : 2) : error === null && calls === 2 && rows === (id === 'empty_course' ? 0 : 1), error, expectedError: expected, transportCalls: calls, rows });
  }
  return { schemaVersion: 1, kind: 'synthetic_extended_native_dom_regression', nativeDomPresent: typeof DOMParser !== 'undefined', actualAcademyNetworkRequests: 0, completeEnrollmentEstablished: false, results };
}
