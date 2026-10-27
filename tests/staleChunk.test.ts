import { describe, expect, it } from 'vitest';
import { isStaleChunkError, shortReason } from '../src/lib/staleChunk';

describe('예전 조각 파일 오류 알아보기', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/pdf-abc.js', // 크롬
    'Importing a module script failed.', // 사파리
    'error loading dynamically imported module', // 파이어폭스
  ])('%s → 새 버전 받기', (msg) => {
    expect(isStaleChunkError(new TypeError(msg))).toBe(true);
  });
  it('다른 오류는 그대로 보여 준다', () => {
    expect(isStaleChunkError(new Error('canvas too large'))).toBe(false);
  });
  it('이유는 짧게 자른다', () => {
    expect(shortReason(new RangeError('x'.repeat(200)))).toHaveLength(78);
    expect(shortReason(new Error('canvas too large'))).toBe('Error: canvas too large');
  });
});
