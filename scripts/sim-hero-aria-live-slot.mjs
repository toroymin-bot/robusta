#!/usr/bin/env node
/**
 * sim-hero-aria-live-slot.mjs
 *   - A-D54-자-1 (D-1 11시 슬롯, 2026-05-07) — Komi 자율 (§5 명세 미수신).
 *
 * Why: HeroAriaLiveSlot 의 computeHeroAriaLivePhase 순수 함수 헬퍼 4 phase × 분기 검증.
 *   .tsx 파일 직접 import 불가 → 산식 미러 (buildHeroDimmingOpacity 1:1 산술).
 *   D-53-자-1 (CLI .mjs ↔ .ts 산식 미러 SoT) 패턴 정합.
 *
 * 게이트 (5/5 PASS 의무):
 *   1) releaseIso null → 'no-release-iso'
 *   2) now < release (D-1 12h 전) → 'pre-live'
 *   3) release ≤ now < release+1h (LIVE +30min) → 'live-1h'
 *   4) now ≥ release+1h (LIVE +2h) → 'dimmed'
 *   5) boundary inclusive — now === release+1h 정확히 → 'dimmed' (b D51-1 정합)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const HERO_DIMMING_OPACITY_FULL = 1.0;
const HERO_DIMMING_OPACITY_DIMMED = 0.7;
const ONE_HOUR_MS = 60 * 60 * 1000;

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

// buildHeroDimmingOpacity 미러 (dim-hero.ts SoT 1:1 산술).
function buildHeroDimmingOpacity(releaseIso, now) {
  if (releaseIso === null) {
    return { opacity: HERO_DIMMING_OPACITY_FULL, phase: "no-release-iso" };
  }
  const releaseMs = new Date(releaseIso).getTime();
  const nowMs = now.getTime();
  if (nowMs < releaseMs) {
    return { opacity: HERO_DIMMING_OPACITY_FULL, phase: "pre-live" };
  }
  if (nowMs < releaseMs + ONE_HOUR_MS) {
    return { opacity: HERO_DIMMING_OPACITY_FULL, phase: "live-1h" };
  }
  return { opacity: HERO_DIMMING_OPACITY_DIMMED, phase: "dimmed" };
}

// computeHeroAriaLivePhase 미러 (hero-aria-live-slot.tsx SoT 1:1).
function computeHeroAriaLivePhase(releaseIso, now) {
  return buildHeroDimmingOpacity(releaseIso, now).phase;
}

function main() {
  console.log("sim:hero-aria-live-slot — 5 phase 분기 + boundary 검증");

  const RELEASE_ISO = "2026-05-08T00:00:00+09:00";
  const releaseMs = new Date(RELEASE_ISO).getTime();

  // 1) releaseIso null → 'no-release-iso'.
  const p1 = computeHeroAriaLivePhase(null, new Date(releaseMs));
  if (p1 === "no-release-iso") {
    pass("1. releaseIso=null → 'no-release-iso'");
  } else {
    fail("1. null", `expected 'no-release-iso', got '${p1}'`);
  }

  // 2) now < release (D-1 12h 전) → 'pre-live'.
  const p2 = computeHeroAriaLivePhase(
    RELEASE_ISO,
    new Date(releaseMs - 12 * ONE_HOUR_MS),
  );
  if (p2 === "pre-live") {
    pass("2. now=release-12h → 'pre-live'");
  } else {
    fail("2. pre-live", `expected 'pre-live', got '${p2}'`);
  }

  // 3) release ≤ now < release+1h (LIVE +30min) → 'live-1h'.
  const p3 = computeHeroAriaLivePhase(
    RELEASE_ISO,
    new Date(releaseMs + 30 * 60 * 1000),
  );
  if (p3 === "live-1h") {
    pass("3. now=release+30min → 'live-1h'");
  } else {
    fail("3. live-1h", `expected 'live-1h', got '${p3}'`);
  }

  // 4) now ≥ release+1h (LIVE +2h) → 'dimmed'.
  const p4 = computeHeroAriaLivePhase(
    RELEASE_ISO,
    new Date(releaseMs + 2 * ONE_HOUR_MS),
  );
  if (p4 === "dimmed") {
    pass("4. now=release+2h → 'dimmed'");
  } else {
    fail("4. dimmed", `expected 'dimmed', got '${p4}'`);
  }

  // 5) boundary — now === release+1h 정확히 → 'dimmed' (D-51-1 boundary 정합).
  const p5 = computeHeroAriaLivePhase(
    RELEASE_ISO,
    new Date(releaseMs + ONE_HOUR_MS),
  );
  if (p5 === "dimmed") {
    pass("5. boundary now=release+1h → 'dimmed' (inclusive)");
  } else {
    fail("5. boundary", `expected 'dimmed', got '${p5}'`);
  }

  if (process.exitCode === 1) {
    console.error("sim:hero-aria-live-slot — FAIL");
  } else {
    console.log("sim:hero-aria-live-slot — 5/5 PASS");
  }
}

main();
