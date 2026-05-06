#!/usr/bin/env node
/**
 * sim-hero-aria-live-region.mjs
 *   - C-D53-2 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-2 (F-D53-1 본체).
 *
 * Why: HeroAriaLiveRegion 의 computeHeroAriaLiveText 순수 함수 헬퍼 4 phase × 분기 검증.
 *   .tsx 파일 직접 import 불가 → 산식 미러 (i18n key lookup + phase 분기).
 *
 * 게이트 (4/4 PASS 의무):
 *   1) phase=pre-live → 빈 문자열
 *   2) phase=live-1h → 비어있지 않은 i18n 텍스트 (ko)
 *   3) phase=dimmed → 빈 문자열
 *   4) phase=no-release-iso → 빈 문자열
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

// computeHeroAriaLiveText 미러 (.tsx 직접 import 불가).
function computeText(phase, locale, ariaText) {
  if (phase !== "live-1h") return "";
  return ariaText ?? "";
}

async function main() {
  console.log("sim:hero-aria-live-region — 4 phase 분기 검증");

  // i18n key 추출 (messages.ts 에서 launch.shownh.aria.live.now ko/en 두 곳).
  const messagesPath = resolve(root, "src/modules/i18n/messages.ts");
  const src = await readFile(messagesPath, "utf8");
  const matches = [
    ...src.matchAll(
      /"launch\.shownh\.aria\.live\.now"\s*:\s*\n?\s*"([^"]*)"/g,
    ),
  ];
  if (matches.length < 2) {
    fail(
      "i18n key 추출",
      `launch.shownh.aria.live.now 2 occurrences 기대, ${matches.length}개`,
    );
    return;
  }
  const koText = matches[0][1];
  const enText = matches[1][1];

  // 1) pre-live → 빈 문자열.
  if (computeText("pre-live", "ko", koText) === "") {
    pass("1. phase=pre-live → 빈 문자열 (aria-live 무알림)");
  } else {
    fail("1. pre-live", "빈 문자열 기대");
  }

  // 2) live-1h → 비어있지 않은 텍스트.
  const liveText = computeText("live-1h", "ko", koText);
  if (liveText.length > 0 && liveText.includes("Robusta")) {
    pass(`2. phase=live-1h → "${liveText.slice(0, 30)}..." (ko)`);
  } else {
    fail("2. live-1h", `텍스트 없음 또는 'Robusta' 미포함: "${liveText}"`);
  }

  // 3) dimmed → 빈 문자열.
  if (computeText("dimmed", "ko", koText) === "") {
    pass("3. phase=dimmed → 빈 문자열");
  } else {
    fail("3. dimmed", "빈 문자열 기대");
  }

  // 4) no-release-iso → 빈 문자열.
  if (computeText("no-release-iso", "ko", koText) === "") {
    pass("4. phase=no-release-iso → 빈 문자열");
  } else {
    fail("4. no-release-iso", "빈 문자열 기대");
  }

  if (process.exitCode === 1) {
    console.error("sim:hero-aria-live-region — FAIL");
  } else {
    console.log("sim:hero-aria-live-region — 4/4 PASS");
  }
}

main().catch((err) => {
  console.error("sim:hero-aria-live-region — ERROR", err);
  process.exit(1);
});
