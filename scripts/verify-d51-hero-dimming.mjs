#!/usr/bin/env node
/**
 * verify-d51-hero-dimming.mjs
 *   - C-D51-2 분리 게이트 (D-2 23시 슬롯, 2026-05-06) — Tori spec C-D51-2.
 *
 * Why: src/modules/launch/dim-hero.ts buildHeroDimmingOpacity 구조 검증 (5 게이트).
 *   verify-d51 통합에 흡수.
 *
 * 자율 정정 D-51-자-3:
 *   hero.tsx 부재 → hero.tsx wiring D+1 자율 슬롯 큐 이월. 본 게이트는 헬퍼만 검증.
 *   release freeze 직전 보존 13 v3 무손상 의무 정합 — hero* 4 컴포넌트 동시 변경 위험 회피.
 *
 * 5 gates:
 *   1) buildHeroDimmingOpacity export grep
 *   2) HeroDimmingPhase 4 enum (pre-live|live-1h|dimmed|no-release-iso)
 *   3) HERO_DIMMING_OPACITY_DIMMED = 0.7 상수 grep
 *   4) ONE_HOUR_MS = 60 * 60 * 1000 상수 grep
 *   5) releaseIso === null → 'no-release-iso' 분기 grep
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log("verify:d51-hero-dimming — C-D51-2 buildHeroDimmingOpacity (5 gates)");

  const filePath = resolve(root, "src/modules/launch/dim-hero.ts");
  const src = await readFile(filePath, "utf8");

  // 1) buildHeroDimmingOpacity export.
  if (/export\s+function\s+buildHeroDimmingOpacity\s*\(/.test(src)) {
    pass("1. buildHeroDimmingOpacity export 정의");
  } else {
    fail("1. export", "함수 미발견");
  }

  // 2) HeroDimmingPhase 4 enum.
  const phaseEnum =
    /export\s+type\s+HeroDimmingPhase\s*=\s*"pre-live"\s*\|\s*"live-1h"\s*\|\s*"dimmed"\s*\|\s*"no-release-iso"/;
  if (phaseEnum.test(src)) {
    pass("2. HeroDimmingPhase 4 enum (pre-live|live-1h|dimmed|no-release-iso)");
  } else {
    fail("2. phase enum", "4 enum 정의 미발견");
  }

  // 3) HERO_DIMMING_OPACITY_DIMMED = 0.7.
  if (/HERO_DIMMING_OPACITY_DIMMED\s*=\s*0\.7/.test(src)) {
    pass("3. HERO_DIMMING_OPACITY_DIMMED = 0.7 상수");
  } else {
    fail("3. opacity 0.7", "상수 미발견");
  }

  // 4) ONE_HOUR_MS = 60 * 60 * 1000.
  if (/ONE_HOUR_MS\s*=\s*60\s*\*\s*60\s*\*\s*1000/.test(src)) {
    pass("4. ONE_HOUR_MS = 60 * 60 * 1000 상수");
  } else {
    fail("4. ONE_HOUR_MS", "상수 미발견");
  }

  // 5) releaseIso === null → 'no-release-iso' 분기.
  if (/releaseIso\s*===\s*null/.test(src) && /no-release-iso/.test(src)) {
    pass("5. releaseIso === null → 'no-release-iso' 분기");
  } else {
    fail("5. null 분기", "미발견");
  }

  if (process.exitCode === 1) {
    console.error("verify:d51-hero-dimming — FAIL");
  } else {
    console.log("verify:d51-hero-dimming — 5/5 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d51-hero-dimming — ERROR", err);
  process.exit(1);
});
