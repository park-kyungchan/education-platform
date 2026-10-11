import { describe, it, expect, beforeEach } from 'bun:test';
import { LmsLiveQueryService } from '../../src/lms/lmsLiveQueryService';
import type { LmsTestSummaryItem } from '../../src/lms/lmsLiveQueryService';

// Invented names, identifiers, titles, scores and dates only; no academy records.

describe('LmsLiveQueryService & Deterministic Parser', () => {
  let service: LmsLiveQueryService;

  beforeEach(() => {
    service = new LmsLiveQueryService();
  });

  it('fails closed before any legacy live assessment or clinic request', async () => {
    const originalFetch = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = (async () => { networkCalls++; throw new Error('network_called'); }) as unknown as typeof fetch;
    try {
      await expect(service.queryStudentTestResults({
        sessionCookie: 'synthetic', studentName: 'synthetic', startDate: '2099-01-01', endDate: '2099-01-02',
      })).rejects.toThrow(/unverified_live_route_contract/);
      await expect(service.queryPupilGradingDetails({
        sessionCookie: 'synthetic', item: {} as LmsTestSummaryItem,
      })).rejects.toThrow(/unverified_live_route_contract/);
      await expect(service.queryClinicPaper({
        sessionCookie: 'synthetic', studentName: 'synthetic', priNo: '0', testingNo: '0',
      })).rejects.toThrow(/unverified_live_route_contract/);
      expect(networkCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe('EXTERN_DIALOG testResultList Parsing', () => {
    it('deterministically parses testResultList from mock LMS HTML', () => {
      const mockHtml = `
        <script>
        EXTERN_DIALOG = {
          testResultList: JSON.parse('[{"pNo":7101,"testingNo":8101,"score":63,"oQuestions":2,"userName":"Invented Student","testingName":"Invented assessment - Invented Student","hangDate":"01.01","applyDate":"01-01 10:15"}]')
        };
        </script>
      `;

      const list = service.parseTestSummaryList(mockHtml);
      expect(list.length).toBe(1);
      expect(list[0].pNo).toBe('7101');
      expect(list[0].testingNo).toBe('8101');
      expect(list[0].score).toBe(63);
      expect(list[0].oQuestions).toBe(2);
      expect(list[0].userName).toBe('Invented Student');
      expect(list[0].applyDate).toBe('01-01 10:15');
    });

    it('throws clear error when session expired or login redirect happens', () => {
      const loginHtml = `<html><body><script>alert("로그인이 필요합니다."); location.href="/login.jsp";</script></body></html>`;
      expect(() => service.parseTestSummaryList(loginHtml)).toThrow(/Session expired/);
    });

    it('returns empty array when no EXTERN_DIALOG exists and not login page', () => {
      const emptyHtml = `<html><body><div>No data</div></body></html>`;
      const list = service.parseTestSummaryList(emptyHtml);
      expect(list).toEqual([]);
    });
  });

  describe('PupilSearch Question-Level Parsing', () => {
    it('extracts question-level scoring and answers for specified student', () => {
      const mockPupilHtml = `
        <script>
        var cache = JSON.parse('[{"studentName":"Invented Student","score":63.0,"allCorrect":false,"priNo":9101,"pNo":"7101","testingNo":8101,"applyDate":"01.01","applyEndDate":"10:15","examResultList":[{"_examNo":1,"examScore":0.0,"examScoreMax":4.0,"answer1":"3"},{"_examNo":2,"examScore":4.0,"examScoreMax":4.0,"answer1":"2"}]}]');
        </script>
      `;

      const detail = service.parsePupilGradingDetails(mockPupilHtml, 'Invented Student');
      expect(detail).not.toBeNull();
      expect(detail!.studentName).toBe('Invented Student');
      expect(detail!.score).toBe(63);
      expect(detail!.examResultList.length).toBe(2);
      expect(detail!.examResultList[0]._examNo).toBe(1);
      expect(detail!.examResultList[0].examScore).toBe(0);
      expect(detail!.examResultList[0].answer1).toBe('3');
      expect(detail!.examResultList[1]._examNo).toBe(2);
      expect(detail!.examResultList[1].examScore).toBe(4);
    });

    it('refuses fabricated answer keys, lecture identities and submission timing', () => {
      const detail = {
        studentName: 'Invented Student',
        priNo: 9101,
        pNo: '7101',
        testingNo: 8101,
        score: 63,
        allCorrect: false,
        applyDate: '01.01',
        applyEndDate: '10:15',
        examResultList: [
          { _examNo: 1, examScore: 0, examScoreMax: 4, answer1: '3' },
          { _examNo: 2, examScore: 4, examScoreMax: 4, answer1: '1' }
        ]
      };

      const summary: LmsTestSummaryItem = {
        pNo: '7101',
        testingNo: '8101',
        testNo: 1180,
        priNo: '9101',
        userName: 'Invented Student',
        testingName: 'Invented assessment - Invented Student',
        printTestingName: 'Invented assessment',
        gradeName: 'Invented grade',
        paperType: 1,
        assNo: 1001,
        score: 63,
        oQuestions: 2,
        sQuestions: 0,
        dQuestions: 0,
        hangDate: '01.01',
        applyDate: '01-01 10:15',
        useTerm: -1
      };

      expect(() => service.toRawAppSubmission({
        detail,
        summary,
        studentId: '9101',
        enrolledGroup: '3',
        bookTitle: 'Invented book',
        unitName: 'Invented unit',
        scope: 'Invented assessment',
        sessionDate: '2099-01-01'
      })).toThrow('unverified_raw_learning_projection');
    });
  });
});
