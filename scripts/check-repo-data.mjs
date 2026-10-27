#!/usr/bin/env node
/*
 * git에 실제 데이터가 들어가지 않게 막는다. 공개 저장소용 안전장치.
 *   node scripts/check-repo-data.mjs --staged   커밋하려는 내용 (pre-commit)
 *   node scripts/check-repo-data.mjs --all      추적 중인 모든 파일 (pre-push, 수동 점검)
 * 걸리면 종료 코드 1. 어떤 값이 걸렸는지는 출력하지 않고 파일과 이유만 보여 준다.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { BLOCKED_PATH, findHits, loadForbidden } from './lib/forbidden.mjs';

const root = resolve(import.meta.dirname, '..');
const mode = process.argv.includes('--all') ? 'all' : 'staged';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const files =
  mode === 'all'
    ? // 푸시되는 것은 커밋된 내용이므로 HEAD 기준으로 목록과 내용을 함께 읽는다
      git('ls-tree', '-r', '-z', '--name-only', 'HEAD').split('\0').filter(Boolean)
    : git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);

const forbidden = loadForbidden(root);
const problems = [];
const binary = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i;

for (const f of files) {
  if (BLOCKED_PATH.test(f)) {
    problems.push(`${f}: 저장소에 넣으면 안 되는 파일`);
    continue;
  }
  if (binary.test(f) || f === 'package-lock.json') continue;
  // 작업 폴더가 아니라 git에 들어갈 내용 그대로 검사한다
  const text = mode === 'all' ? git('show', `HEAD:${f}`) : git('show', `:${f}`);
  for (const why of findHits(text, forbidden)) problems.push(`${f}: ${why}`);
}

const label = mode === 'all' ? '커밋된 파일' : '커밋할 파일';
if (forbidden.sources === 0) {
  console.warn(`check-repo-data: 로컬 데이터 파일이 없어 실제 값은 검사하지 못했습니다 (${label} ${files.length}개, 경로만 검사).`);
}
if (problems.length) {
  console.error(`\n✗ ${label}에 실제 데이터가 있습니다. 커밋/푸시를 멈췄습니다.`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('\n  해당 파일을 고치거나 git restore --staged <파일> 로 빼세요.');
  process.exit(1);
}
console.log(`✓ check-repo-data: ${label} ${files.length}개에 실제 데이터 없음`);
