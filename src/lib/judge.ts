/* 검침값 판정: 음수 사용량은 오류(저장 거부), 이상한 값은 경고(저장 허용) */

export type Judge = {
  u: number | null;
  /** 지난 회차 사용량 */
  pu: number | null;
  level: 'empty' | 'ok' | 'warn' | 'bad';
  msg?: string;
};

export function judgeReading(prev: number, curr: number | '' | null, pu: number | null): Judge {
  if (curr === '' || curr == null) return { u: null, pu, level: 'empty' };
  const u = curr - prev;
  if (u < 0) return { u, pu, level: 'bad', msg: '당월값이 전월값보다 작습니다. 숫자를 다시 확인하세요.' };
  if (pu != null && pu >= 5 && u >= pu * 2) return { u, pu, level: 'warn', msg: `지난 회차(${pu}㎥)의 2배 이상입니다. 계량기를 한 번 더 확인하세요.` };
  if (pu != null && pu >= 5 && u === 0) return { u, pu, level: 'warn', msg: `지난 회차 ${pu}㎥에서 0㎥가 되었습니다. 빈집인지 확인하세요.` };
  if (u >= 100) return { u, pu, level: 'warn', msg: '사용량이 100㎥ 이상입니다. 자릿수를 확인하세요.' };
  return { u, pu, level: 'ok' };
}
