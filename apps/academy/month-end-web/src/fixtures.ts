import {createExamCandidate} from '../../dc-gang-a/src/academy/examSelection';
import {known, unknown} from '../../dc-gang-a/src/learning/model';
import type {DisplayItem} from './model';

/** Authored fictional UI fixtures. Never acquired, anonymized or inferred from the Academy pool. */
export function makeExamples(): readonly DisplayItem[] {
  const rows = [
    ['예시 001', '곱셈', '23 × 4를 두 가지 방법으로 계산하고, 두 방법의 공통점을 설명하세요.', '92. 예: 분배법칙과 세로셈.', ['계산 원리', '설명하기'], '기본'],
    ['예시 002', '곱셈', '한 상자에 연필이 12자루씩 있습니다. 6상자에 있는 연필 수를 식과 말로 설명하세요.', '72자루. 12 × 6 = 72.', ['상황 해석', '식 세우기'], '기본'],
    ['예시 003', '나눗셈', '구슬 47개를 5개씩 묶을 때 묶음 수와 남은 구슬 수를 설명하세요.', '9묶음, 2개. 47 = 5 × 9 + 2.', ['나머지', '상황 해석'], '기본'],
    ['예시 004', '나눗셈', '29 ÷ 4의 나머지가 5라고 한 풀이가 왜 잘못되었는지 설명하세요.', '나머지는 나누는 수 4보다 작아야 한다. 몫 7, 나머지 1.', ['오류 설명', '추론'], '심화'],
    ['예시 005', '분수', '똑같은 크기의 종이를 각각 3등분, 6등분했습니다. 한 조각의 크기를 비교하고 이유를 쓰세요.', '3등분한 한 조각이 더 크다. 같은 전체를 더 적게 나누었기 때문이다.', ['비교', '설명하기'], '기본'],
    ['예시 006', '분수', '전체를 똑같이 나눈 그림에서 분수를 읽고 그 뜻을 설명하세요.', '', ['표현', '자료 미확인'], ''],
    ['예시 007', '들이와 무게', '1 L 200 mL와 950 mL의 차이를 구하고 단위를 바꾼 과정을 설명하세요.', '250 mL. 1 L 200 mL = 1,200 mL.', ['단위 변환', '계산 원리'], '기본'],
    ['예시 008', '들이와 무게', '어떤 물건의 무게를 비교한 자료입니다. 판단에 필요한 자료를 확인하세요.', '', ['자료 해석', '근거 미확인'], ''],
  ] as const;
  return rows.map(([label, unitLabel, content, answer, tags, difficulty], index) => {
    const refs = ['synthetic-ui-fixture:not-academy-source'];
    return {
      label, unitLabel, tags, provenance:'synthetic_fixture' as const,
      candidate:createExamCandidate({
        sourceItem:{namespace:'synthetic_month_end_preview', literalKey:`demo-${String(index + 1).padStart(3,'0')}`},
        edition:known({namespace:'synthetic_book_edition',literalKey:'ui-example-edition'}, refs),
        observedAt:'2026-10-16T00:00:00.000Z', sourceRef:'synthetic-ui-fixture', evidenceRefs:refs,
        content:known(content,refs), answer:answer ? known(answer,refs) : unknown('화면 검증용 미확인 정답'),
        responseMode:known('constructed_response',refs),
        difficulty:difficulty ? known({level:difficulty,basis:'source_claim',sourceRef:'synthetic-ui-fixture'},refs) : unknown('화면 검증용 미확인 난이도'),
      }),
    };
  });
}
