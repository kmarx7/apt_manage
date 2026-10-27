/*
 * 실제 데이터 검사에 쓰는 금지 목록. 값은 이 파일에 적지 않고, 이 맥의 로컬 파일에서 읽는다.
 *   - local-data/ 또는 _handoff/local-data/ 의 seed-backup.json: 계좌번호, 예금주, 회사명, 회차별 고지서 총액, 세대별 검침값
 *   - 같은 곳의 excel-fixtures.json: 회차 합계
 *   - .no-data-strings.json (선택): ["추가로 막을 문자열", …]
 * 로컬 파일이 없는 곳(Vercel 빌드 서버, 다른 기기)에서는 파일 이름 같은 일반 문자열만 남는다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const findLocal = (root, name) =>
  [join(root, 'local-data', name), join(root, '_handoff', 'local-data', name)].find(existsSync);

/** 숫자는 콤마 없는 형태와 콤마 형태를 모두 막는다 */
const numberForms = (n) => {
  const r = Math.round(Number(n));
  return Number.isFinite(r) ? [String(r), r.toLocaleString('en-US')] : [];
};

/**
 * @param {{ fileNames?: boolean }} [opts] fileNames: 로컬 데이터 파일 이름도 금지 (빌드 결과물 검사용)
 * @returns {{ strings: Map<string, string>, readings: { id: string, prev: string, curr: string }[], sources: number }}
 *   strings: 금지 문자열 → 출처 설명 (값은 출력하지 않는다)
 *   readings: 같은 파일에 함께 나오면 실제 검침값으로 보는 전월·당월 쌍
 */
export function loadForbidden(root, { fileNames = false } = {}) {
  const strings = new Map();
  const add = (s, why) => {
    const v = String(s ?? '').trim();
    if (v.length >= 4) strings.set(v, why);
  };
  const readings = [];
  let sources = 0;

  // 빌드 결과물에 파일 이름이 있으면 데이터가 번들에 들어간 것. 저장소 코드(테스트·스크립트)에는 정상적으로 있다.
  if (fileNames) {
    add('seed-backup', '로컬 데이터 파일 이름');
    add('excel-fixtures', '로컬 데이터 파일 이름');
  }

  const seedPath = findLocal(root, 'seed-backup.json');
  if (seedPath) {
    sources++;
    const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
    const bank = seed.settings?.bank ?? {};
    const no = String(bank.no ?? '');
    add(no, '계좌번호');
    add(no.split('-').slice(0, 2).join('-'), '계좌번호 앞부분');
    add(no.replace(/\D/g, ''), '계좌번호(숫자만)');
    add(bank.holder, '예금주');
    add(seed.settings?.companyName, '회사명');
    for (const p of seed.periods ?? []) {
      for (const f of numberForms(p.bill)) add(f, `${p.id} 고지서 총액`);
      for (const [id, r] of Object.entries(p.readings ?? {})) {
        // 짧은 값은 흔한 숫자와 겹치므로 네 자리 이상만 쌍으로 본다
        if (Number(r.prev) >= 1000 && r.curr !== '') readings.push({ id: `${p.id} ${id}`, prev: String(Math.round(r.prev)), curr: String(Math.round(r.curr)) });
      }
    }
  }

  const fxPath = findLocal(root, 'excel-fixtures.json');
  if (fxPath) {
    sources++;
    const fx = JSON.parse(readFileSync(fxPath, 'utf8'));
    for (const [k, v] of Object.entries(fx)) for (const f of numberForms(v.I30)) add(f, `엑셀 ${k} 회차 합계`);
  }

  const extraPath = join(root, '.no-data-strings.json');
  if (existsSync(extraPath)) {
    sources++;
    for (const s of JSON.parse(readFileSync(extraPath, 'utf8'))) add(s, '.no-data-strings.json');
  }

  return { strings, readings, sources };
}

/** 검침값 쌍은 두 값이 가까이(이 글자 수 안에) 함께 있을 때만 데이터로 본다 */
const PAIR_WINDOW = 100;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * 더 긴 숫자의 일부가 아닌, 따로 선 숫자의 위치들.
 * 앞뒤에 숫자나 "숫자 사이의 콤마·점"(1,2074 / 2074,5 / 3.2074)이 붙으면 다른 숫자로 본다.
 * JSON 구분자 콤마("prev":2074,"curr")와 끝의 .0(2074.0)은 같은 숫자로 본다.
 */
const numberPositions = (text, v) => {
  const forms = [v, Number(v).toLocaleString('en-US')].map(escapeRe).join('|');
  const re = new RegExp(`(?<!\\d|\\d[,.])(?:${forms})(?:\\.0+)?(?!\\d|[,.]\\d)`, 'g');
  return [...text.matchAll(re)].map((m) => m.index);
};

/** 문자열 하나를 검사해 걸린 이유 목록을 돌려준다 (값 자체는 넣지 않는다) */
export function findHits(text, { strings, readings }) {
  const hits = [];
  for (const [s, why] of strings) if (text.includes(s)) hits.push(why);
  for (const r of readings) {
    const a = numberPositions(text, r.prev);
    if (!a.length) continue;
    const b = numberPositions(text, r.curr);
    if (a.some((i) => b.some((j) => Math.abs(i - j) <= PAIR_WINDOW))) hits.push(`${r.id} 검침값`);
  }
  return hits;
}

/** 저장소에 들어가면 안 되는 경로 */
export const BLOCKED_PATH = /(^|\/)(_handoff|local-data)\/|\.(xlsx|xls|pdf|zip)$|(^|\/)backup-[^/]*\.json$|^PROMPT\.md$|(^|\/)\.no-data-strings\.json$/i;
