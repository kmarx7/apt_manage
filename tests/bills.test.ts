import { describe, expect, it } from 'vitest';
import { billFilename, billInfo, companyStamp, fileTag, pairUp } from '../src/lib/bills';
import { defaultSettings } from '../src/lib/defaults';
import { fakeData } from './fake';

describe('고지서 배치', () => {
  it('두 세대씩 한 장, 26세대면 13장', () => {
    const rows = Array.from({ length: 26 }, (_, i) => i);
    const pages = pairUp(rows);
    expect(pages).toHaveLength(13);
    expect(pages[0]).toEqual([0, 1]);
    expect(pages.at(-1)).toEqual([24, 25]);
  });
  it('홀수면 마지막 장 아래칸은 비운다', () => {
    expect(pairUp([1, 2, 3])).toEqual([[1, 2], [3, null]]);
    expect(pairUp([])).toEqual([]);
  });
});

describe('파일 이름', () => {
  it('수도요금_고지서_YYYY_MM-MM.pdf', () => {
    expect(fileTag({ year: 2030, m1: 7 })).toBe('2030_07-08');
    expect(billFilename({ year: 2030, m1: 11 })).toBe('수도요금_고지서_2030_11-12.pdf');
  });
});

describe('설정에서 읽는 고지서 정보', () => {
  it('회사명 앞의 (주)를 ㈜로 바꾼다', () => {
    expect(companyStamp('(주)테스트관리')).toBe('㈜ 테스트관리');
    expect(companyStamp('( 주 ) 테스트')).toBe('㈜ 테스트');
    expect(companyStamp('테스트관리')).toBe('테스트관리');
  });
  it('은행 줄과 예금주를 만든다', () => {
    const i = billInfo(fakeData().settings);
    expect(i).toEqual({ holder: '테스트', bankLine: '테스트은행: 000-000', company: '테스트관리', missing: [] });
  });
  it('빈 설정이면 빠진 항목을 알려 준다', () => {
    expect(billInfo(defaultSettings()).missing).toEqual(['은행명', '계좌번호', '예금주', '회사명']);
  });
});
