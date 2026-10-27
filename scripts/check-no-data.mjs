#!/usr/bin/env node
/*
 * 빌드 결과물(dist/)에 실제 데이터가 섞이지 않았는지 검사한다.
 * 금지 값은 scripts/lib/forbidden.mjs가 이 맥의 로컬 파일에서 읽는다 (이 스크립트에 값을 적지 않는다).
 * 외부 주소(http/https)는 실패 조건이 아니라 목록으로만 출력한다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { findHits, loadForbidden } from './lib/forbidden.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('check-no-data: dist/ 가 없습니다. 먼저 vite build 를 실행하세요.');
  process.exit(1);
}

const forbidden = loadForbidden(root, { fileNames: true });

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
  for (const why of findHits(text, forbidden)) hits.push(`${relative(root, f)}: ${why}`);
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    const host = m[0].replace(/^(https?:\/\/[^/]+).*/, '$1');
    urls.set(host, (urls.get(host) ?? 0) + 1);
  }
}

console.log(`check-no-data: ${files.length}개 파일, 금지 문자열 ${forbidden.strings.size}개 · 검침값 ${forbidden.readings.length}쌍 검사 (로컬 데이터 출처 ${forbidden.sources}개)`);
if (forbidden.sources === 0) console.log('  로컬 데이터 파일이 없어 실제 값 검사는 건너뛰었습니다. 맥에서 빌드하면 함께 검사합니다.');

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
