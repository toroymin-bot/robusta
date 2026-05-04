#!/usr/bin/env node
/**
 * verify-d40-auto.mjs
 *   - 자율 D-41-자-1 (D-3 07시 슬롯, 2026-05-05) — DarkModeToggle a11y 보강 회귀 게이트.
 *
 * 배경: §3 (똘이 05시 D-D41 명세) 미등록 상태에서 §4 (꼬미 07시) 자율 슬롯 전환.
 *   D-D40 사이클 본체 (commit 02524f9 = verify-d40.mjs 34 게이트 / dark-mode-toggle.tsx)
 *   는 무수정 — D-2/D-1 권장 #5 (a11y/icon 보강) 사전 진행을 본 자율 후속 파일로 분리.
 *
 * 검증 범위 (4 게이트):
 *   1) ariaLabelOf 함수 + 4 case (system/light/dark) 한국어 라벨.
 *   2) aria-label 동적 합성 (현재 + 다음 액션) — hydrated 분기 보존.
 *   3) focus-visible:ring-2 + ring-stone-500 + ring-offset-2 토큰 (WCAG 2.4.7).
 *   4) sr-only role=status aria-live=polite + data-test=dark-mode-toggle-status (스크린리더 변경 안내).
 *
 * 회귀 의무: verify-d40 34/34 게이트는 본 파일과 무관하게 유지 (보존 13 v3 무손상 동등 의무).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
let pass = 0;
let fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass += 1;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail += 1;
  }
}

async function readSrc(p) {
  return readFile(resolve(root, p), "utf8");
}

const toggle = await readSrc("src/modules/ui/dark-mode-toggle.tsx");

// 1) ariaLabelOf 함수 — system/light/dark 4 case 한국어 라벨 (스크린리더 정합).
assert(
  "자율 D-41-자-1 (1/4): ariaLabelOf 함수 + 4 case (system→자동 / light→라이트 / dark→다크)",
  /function\s+ariaLabelOf\s*\(\s*choice:\s*ThemeChoice\s*\)\s*:\s*string/.test(toggle) &&
    /case\s+"system":\s*\n\s*return\s+"자동"/.test(toggle) &&
    /case\s+"light":\s*\n\s*return\s+"라이트"/.test(toggle) &&
    /case\s+"dark":\s*\n\s*return\s+"다크"/.test(toggle),
);

// 2) aria-label 동적 합성 — hydrated 분기 + 현재 + 다음 액션.
assert(
  "자율 D-41-자-1 (2/4): aria-label 동적 합성 (hydrated 분기 + 현재 + 다음 액션)",
  /const\s+ariaLabel\s*=\s*hydrated/.test(toggle) &&
    /다크모드 토글: 현재 \$\{ariaLabelOf\(choice\)\}, 클릭하면 \$\{nextLabel\}로/.test(toggle) &&
    /다크모드 토글 \(로딩 중\)/.test(toggle) &&
    /aria-label=\{ariaLabel\}/.test(toggle),
);

// 3) focus-visible:ring 토큰 (WCAG 2.4.7 키보드 포커스 가시화 / header-cluster #192 패턴 일관).
assert(
  "자율 D-41-자-1 (3/4): focus-visible:ring-2 + ring-stone-500/400 + ring-offset-2 토큰",
  /focus-visible:outline-none/.test(toggle) &&
    /focus-visible:ring-2/.test(toggle) &&
    /focus-visible:ring-stone-500/.test(toggle) &&
    /dark:focus-visible:ring-stone-400/.test(toggle) &&
    /focus-visible:ring-offset-2/.test(toggle) &&
    /focus-visible:ring-offset-white/.test(toggle) &&
    /dark:focus-visible:ring-offset-stone-900/.test(toggle),
);

// 4) sr-only live region — 토글 시 스크린리더에 현재 상태 안내.
assert(
  "자율 D-41-자-1 (4/4): sr-only role=status aria-live=polite + data-test=dark-mode-toggle-status",
  /<span\s+className="sr-only"\s+role="status"\s+aria-live="polite"\s+data-test="dark-mode-toggle-status">/.test(
    toggle,
  ) && /테마: \$\{ariaLabelOf\(choice\)\}/.test(toggle),
);

console.log("");
console.log(`verify-d40-auto: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
