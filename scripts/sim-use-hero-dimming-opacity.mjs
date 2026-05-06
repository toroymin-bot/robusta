#!/usr/bin/env node
/**
 * sim-use-hero-dimming-opacity.mjs
 *   - C-D52-1 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-1 sim 6 케이스.
 *
 * Why: jest/vitest 미설치 (외부 dev-deps +0 의무) → 순수 함수 헬퍼 computeHeroDimmingOpacity 만 sim.
 *   hook 자체는 React 환경 의존이라 sim 불가. 명세 § 9 6 케이스 1:1 매핑.
 *
 * 6 cases:
 *   1) SSR-equivalent (prefersReducedMotion=true, fast-skip) → 1.0
 *   2) prefersReducedMotion=true (다른 시각) → 1.0
 *   3) now < release (pre-launch) → 1.0
 *   4) release ≤ now < release+1h (강조) → 1.0
 *   5) release+1h ≤ now < release+2h (dimming) → 0.7
 *   6) now ≥ release+2h (정상 복귀) → 1.0
 *
 * mirror 함수 use-hero-dimming-opacity.ts computeHeroDimmingOpacity 1:1 동기.
 *   외부 dev-deps +0 (node 표준만, esbuild/ts 컴파일 회피).
 */

const HERO_DIMMING_OPACITY_FULL = 1.0;
const HERO_DIMMING_OPACITY_DIMMED = 0.7;
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * ONE_HOUR_MS;

function computeHeroDimmingOpacity(now, releaseIso, prefersReducedMotion) {
  if (prefersReducedMotion) return HERO_DIMMING_OPACITY_FULL;
  const releaseMs = new Date(releaseIso).getTime();
  const nowMs = now.getTime();
  if (nowMs < releaseMs) return HERO_DIMMING_OPACITY_FULL;
  if (nowMs < releaseMs + ONE_HOUR_MS) return HERO_DIMMING_OPACITY_FULL;
  if (nowMs < releaseMs + TWO_HOURS_MS) return HERO_DIMMING_OPACITY_DIMMED;
  return HERO_DIMMING_OPACITY_FULL;
}

const RELEASE_ISO = "2026-05-08T00:00:00+09:00";
const releaseMs = new Date(RELEASE_ISO).getTime();

const cases = [
  {
    label: "1. SSR-equivalent (prefersReducedMotion=true, any time) → 1.0",
    now: new Date(releaseMs + 90 * 60 * 1000),
    prm: true,
    expected: HERO_DIMMING_OPACITY_FULL,
  },
  {
    label: "2. prefersReducedMotion=true (다른 시각) → 1.0",
    now: new Date(releaseMs + 30 * 60 * 1000),
    prm: true,
    expected: HERO_DIMMING_OPACITY_FULL,
  },
  {
    label: "3. now < release (pre-launch, 5/7 23:00 KST) → 1.0",
    now: new Date("2026-05-07T23:00:00+09:00"),
    prm: false,
    expected: HERO_DIMMING_OPACITY_FULL,
  },
  {
    label: "4. release ≤ now < release+1h (강조, +30min) → 1.0",
    now: new Date(releaseMs + 30 * 60 * 1000),
    prm: false,
    expected: HERO_DIMMING_OPACITY_FULL,
  },
  {
    label: "5. release+1h ≤ now < release+2h (dimming, +90min) → 0.7",
    now: new Date(releaseMs + 90 * 60 * 1000),
    prm: false,
    expected: HERO_DIMMING_OPACITY_DIMMED,
  },
  {
    label: "6. now ≥ release+2h (정상 복귀, +3h) → 1.0",
    now: new Date(releaseMs + 3 * ONE_HOUR_MS),
    prm: false,
    expected: HERO_DIMMING_OPACITY_FULL,
  },
];

console.log("sim:use-hero-dimming-opacity — 6 케이스 (C-D52-1)");
let pass = 0;
let fail = 0;
for (const c of cases) {
  const actual = computeHeroDimmingOpacity(c.now, RELEASE_ISO, c.prm);
  if (Math.abs(actual - c.expected) < 1e-9) {
    console.log(`  ✓ ${c.label} (actual=${actual})`);
    pass++;
  } else {
    console.error(`  ✗ ${c.label} — expected ${c.expected}, got ${actual}`);
    fail++;
  }
}

if (fail > 0) {
  console.error(`sim:use-hero-dimming-opacity — FAIL ${fail}/${cases.length}`);
  process.exit(1);
}
console.log(`sim:use-hero-dimming-opacity — ${pass}/${cases.length} PASS`);
