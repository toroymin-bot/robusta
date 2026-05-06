#!/usr/bin/env node
/**
 * verify-d53-motion-reduce.mjs
 *   - C-D53-5 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-5 (D-D53-1 본체).
 *
 * Why: 4 hero* 컴포넌트 prefers-reduced-motion 가드 일관성 read-only static analysis.
 *   변경 0 — grep 분석만. 누락 발견 시 보고 (가드 추가는 §6/§8 hero* wiring 본체 슬롯 통합).
 *
 * 게이트 (4/4 PASS 의무 — 1 컴포넌트당 1 게이트):
 *   1) 파일 존재
 *   2) 다음 중 하나 매칭:
 *        - 'prefers-reduced-motion'
 *        - 'motion-reduce:'
 *        - 'motion-safe:'
 *        - 'useReducedMotion'
 *        - 'data-motion-reduce'
 *      또는 motion 정의 0 (transition / animation / transform / animate-* 미사용) → 가드 면제.
 *   3) (애니메이션 정의 1+) ↔ (가드 정의 1+) 일관 — 정의 0 + 가드 0 OK / 정의 1+ + 가드 0 FAIL.
 *   4) 4 컴포넌트 일관성 — 가드 사용 컴포넌트 비율 보고.
 *
 * 자율 정정 (꼬미 §4 grep 사실 확정):
 *   - D-53-자-1: 4 hero* 현 상태 grep 결과 — hero-live-transition.tsx (matchMedia + transition),
 *                hero-live-pulse.tsx (motion-safe:animate-pulse + transition-colors), hero-title-slot.tsx
 *                (motion 0), hero-live-banner.tsx (motion 0). 정적 컴포넌트 2개는 가드 면제 사실 확정 — §3
 *                추정 3 권한 발동.
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(process.cwd());

const HERO_COMPONENTS = [
  "src/modules/ui/hero-live-transition.tsx",
  "src/modules/ui/hero-live-pulse.tsx",
  "src/modules/ui/hero-title-slot.tsx",
  "src/modules/header/hero-live-banner.tsx",
];

const MOTION_GUARDS = [
  /prefers-reduced-motion/,
  /motion-reduce:/,
  /motion-safe:/,
  /useReducedMotion/,
  /data-motion-reduce/,
];

// 애니메이션 정의 패턴.
const MOTION_DEFS = [
  /\btransition\b/,
  /\banimation\b/,
  /\banimate-\w+/, // tailwind animate-pulse, animate-bounce 등
  /transform\s*:/, // CSS transform (style={{transform: ...}})
];

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}
function info(label) {
  console.log(`  ℹ ${label}`);
}

async function main() {
  console.log(
    "verify:d53-motion-reduce — 4 hero* prefers-reduced-motion 가드 일관성 read-only static analysis",
  );

  let guardedCount = 0;
  let exemptCount = 0;

  for (let i = 0; i < HERO_COMPONENTS.length; i++) {
    const relPath = HERO_COMPONENTS[i];
    const absPath = resolve(root, relPath);
    const num = i + 1;

    // 1) 파일 존재.
    if (!existsSync(absPath)) {
      fail(`${num}. 파일 존재 (${relPath})`, "미발견");
      continue;
    }

    const src = await readFile(absPath, "utf8");

    const hasMotionDef = MOTION_DEFS.some((re) => re.test(src));
    const hasGuard = MOTION_GUARDS.some((re) => re.test(src));

    if (!hasMotionDef && !hasGuard) {
      // 정적 컴포넌트 — 가드 면제.
      pass(`${num}. ${relPath} — motion 정의 0 / 가드 면제 (정적)`);
      exemptCount++;
    } else if (hasMotionDef && hasGuard) {
      // 정의 1+ / 가드 1+ — 정합.
      const matchedGuard = MOTION_GUARDS.find((re) => re.test(src));
      pass(
        `${num}. ${relPath} — motion + 가드 정합 (matched: ${matchedGuard.source})`,
      );
      guardedCount++;
    } else if (hasMotionDef && !hasGuard) {
      // 정의 1+ / 가드 0 — FAIL.
      fail(
        `${num}. ${relPath} — motion 정의 1+ / 가드 0 (a11y 누락)`,
        "prefers-reduced-motion 가드 필수",
      );
    } else {
      // 정의 0 / 가드 1+ — 무해 (가드만 있고 motion은 없음).
      info(`${num}. ${relPath} — 가드 only / motion 정의 0 (무해, 미래 대비)`);
      exemptCount++;
    }
  }

  // 일관성 보고.
  const total = HERO_COMPONENTS.length;
  const ratio = total > 0 ? guardedCount / total : 0;
  console.log(
    `  · 일관성 — 가드 적용 ${guardedCount}/${total} (${(ratio * 100).toFixed(0)}%) / 면제 ${exemptCount}`,
  );

  if (process.exitCode === 1) {
    console.error("verify:d53-motion-reduce — FAIL");
  } else {
    console.log("verify:d53-motion-reduce — 4/4 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d53-motion-reduce — ERROR", err);
  process.exit(1);
});
