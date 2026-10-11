import {describe,expect,test} from 'bun:test';
import {connectionView} from '../../src/academy/web/connectionView';
import {academyConnectionStatus} from '../../src/academy/nativeConnector';
import {readFileSync} from 'node:fs';

describe('teacher source connection presentation',()=>{
  test('the selected client consumes the shared connection and returns it through both semantic queries',()=>{
    const source=readFileSync(new URL('../../src/academy/web/client.ts',import.meta.url),'utf8');
    expect(source.includes('renderConnection(cohort.connection)')).toBe(true);
    expect(source.includes('renderConnection(scene.connection)')).toBe(true);
    expect(source.includes("name:'query_date_class'")).toBe(true);
    expect(source.includes('connection:scene.connection')).toBe(true);
  });
  test('retained query stays available beside the direct-authentication and official-save blockers',()=>{
    const view=connectionView(academyConnectionStatus);
    expect(view.retainedLabel).toContain('보존 자료 조회 가능');
    expect(view.acquisitionLabel).toContain('직접 HTTP 인증 연결 필요');
    expect(view.journalLabel).toContain('학원 일지 저장 미지원');
    expect(view.sendLabel).toContain('전송은 선생님');
    expect(view.refreshDisabled).toBe(true);
  });
  test('missing or unknown capability data cannot enable a source refresh',()=>{
    for(const value of [undefined,null,{}, {...academyConnectionStatus,acquisition:{state:'ready'}}]){
      const view=connectionView(value);
      expect(view.refreshDisabled).toBe(true);
      expect(view.acquisitionLabel).toContain('연결 상태 미확인');
    }
  });
});
