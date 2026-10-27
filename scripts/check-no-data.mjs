#!/usr/bin/env node
/*
 * 빌드 결과물(dist/)에 실제 데이터가 섞이지 않았는지 검사한다.
 *
 * 금지 문자열은 이 스크립트에 적지 않는다. 실제 값은 이 맥의 로컬 파일에서 읽는다.
 *   - local-data/ 또는 _handoff/local-data/ 의 seed-backup.json: 계좌번호, 예금주, 회사명, 회차별 고지서 총액
 *   - 같은 곳의 excel-fixtures.json: 회차 합계
 *   - .no-data-strings.json (선택): ["추가로 막을 문자열", …]
 * 로컬 파일이 없는 곳(Vercel 빌드 서버)에서는 파일 이름 같은 일반 문자열만 검사한다.
 *
 * 외부 주소(http/https)는 실패 조건이 아니라 목록으로만 출력한다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('check-no-data: dist/ 가 없습니다. 먼저 vite build 를 실행하세요.');
  process.exit(1);
}

const forbidden = new Map(); // 문자열 → 출처 설명(값은 출력하지 않음)
const add = (s, why) => {
  const v = String(s ?? '').trim();
  if (v.length >= 4) forbidden.set(v, why);
};

add('seed-backup', '로컬 데이터 파일 이름');
add('excel-fixtures', '로컬 데이터 파일 이름');

const findLocal = (name) =>
  [join(root, 'local-data', name), join(root, '_handoff', 'local-data', name)].find(existsSync);

let localSources = 0;
const seedPath = findLocal('seed-backup.json');
if (seedPath) {
  localSources++;
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const bank = seed.settings?.bank ?? {};
  add(bank.no, '계좌번호');
  add(String(bank.no ?? '').split('-').slice(0, 2).join('-'), '계좌번호 앞부분');
  add(String(bank.no ?? '').replace(/\D/g, ''), '계좌번호(숫자만)');
  add(bank.holder, '예금주');
  add(seed.settings?.companyName, '회사명');
  for (const p of seed.periods ?? []) add(Math.round(p.bill), `${p.id} 고지서 총액`);
}

const fxPath = findLocal('excel-fixtures.json');
if (fxPath) {
  localSources++;
  const fx = JSON.parse(readFileSync(fxPath, 'utf8'));
  for (const [k, v] of Object.entries(fx)) add(v.I30, `엑셀 ${k} 회차 합계`);
}

const extraPath = join(root, '.no-data-strings.json');
if (existsSync(extraPath)) {
  localSources++;
  for (const s of JSON.parse(readFileSync(extraPath, 'utf8'))) add(s, '.no-data-strings.json');
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const textExt = /\.(html|js|mjs|css|json|webmanifest|txt|svg|map)$/i;
const files = walk(dist).filter((f) => textExt.test(f));
const hits = [];
const urls = new Map();

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const [s, why] of forbidden) if (text.includes(s)) hits.push(`${relative(root, f)}: ${why}`);
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    const host = m[0].replace(/^(https?:\/\/[^/]+).*/, '$1');
    urls.set(host, (urls.get(host) ?? 0) + 1);
  }
}

console.log(`check-no-data: ${files.length}개 파일, 금지 문자열 ${forbidden.size}개 검사 (로컬 데이터 출처 ${localSources}개)`);
if (localSources === 0) console.log('  로컬 데이터 파일이 없어 실제 값 검사는 건너뛰었습니다. 맥에서 빌드하면 함께 검사합니다.');

if (urls.size) {
  console.log('  번들 안의 외부 주소 (참고용, 실패 조건 아님):');
  for (const [u, n] of [...urls].sort()) console.log(`    ${u}  ×${n}`);
}

if (hits.length) {
  console.error('\n✗ 빌드 결과물에 실제 데이터가 들어 있습니다:');
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log('✓ 실제 데이터 없음');
