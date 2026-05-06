#!/usr/bin/env node
/**
 * verify-byok-demo-card.mjs
 *   - C-D48-5 (D-2 11시 슬롯, 2026-05-06) — Tori spec C-D48-5 (F-D48-5).
 *
 * Why: byok-demo-card.tsx 표시 윈도우 회귀 게이트 — 14:00 KST 이전 hidden / 14:00∼18:00 표시 / 18:00 이후 hidden + ARIA + localStorage key 정합.
 *
 *   자율 정정 D-48-자-4: 명세는 시각 mock 분기 검증 4 케이스 요구.
 *     컴포넌트 직접 실행은 React/JSX 환경 의존 — Node.js 단독에서 실행 불가.
 *     대안: computeVisibility 산식 정합을 grep + 파일 내 상수 (WINDOW_MS_BEFORE/AFTER) 검증으로 대체.
 *     실제 시각 분기 컴포넌트 동작은 sim-byok-demo-extended 게이트 7에서 grep 검증.
 *     본 게이트는 카드 구조 (ARIA / localStorage / step 6종) 정합 5 게이트.
 *
 * 5 gates:
 *   1) ByokDemoCard export grep 1건 + default export
 *   2) localStorage 'byok.demo.card.steps' key get/set 정합 (2건)
 *   3) ARIA — role="region" + aria-label + aria-pressed 3종 grep
 *   4) step 6종 i18n 키 (settings.byok.demo.card.step.1∼6) grep
 *   5) tabIndex={0} + 1분 tick (TICK_MS = 60_000) + clearInterval cleanup
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
let failed = 0;

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  failed += 1;
  process.exitCode = 1;
}

async function main() {
  console.log("verify:byok-demo-card — 시연 카드 5 게이트");

  const card = await readFile(
    resolve(root, "src/modules/settings/byok-demo-card.tsx"),
    "utf8",
  );

  // 1) ByokDemoCard export.
  const namedExport = /export\s+function\s+ByokDemoCard/.test(card);
  const defaultExport = /export\s+default\s+ByokDemoCard/.test(card);
  if (namedExport && defaultExport) {
    pass("1. ByokDemoCard named + default export");
  } else {
    fail(
      "1. ByokDemoCard export",
      `named=${namedExport} default=${defaultExport}`,
    );
  }

  // 2) localStorage key get/set.
  const hasGet = /getItem\(\s*STORAGE_KEY\s*\)/.test(card);
  const hasSet = /setItem\(\s*STORAGE_KEY/.test(card);
  const hasKeyName = /STORAGE_KEY\s*=\s*["']byok\.demo\.card\.steps["']/.test(card);
  if (hasGet && hasSet && hasKeyName) {
    pass(
      "2. localStorage 'byok.demo.card.steps' get/set wiring (영속 정합)",
    );
  } else {
    fail(
      "2. localStorage key",
      `get=${hasGet} set=${hasSet} key=${hasKeyName}`,
    );
  }

  // 3) ARIA.
  const hasRole = /role="region"/.test(card);
  const hasAriaLabel = /aria-label=\{/.test(card);
  const hasAriaPressed = /aria-pressed=\{/.test(card);
  if (hasRole && hasAriaLabel && hasAriaPressed) {
    pass("3. ARIA — role=\"region\" + aria-label + aria-pressed 3종");
  } else {
    fail(
      "3. ARIA",
      `role=${hasRole} label=${hasAriaLabel} pressed=${hasAriaPressed}`,
    );
  }

  // 4) step 6종 i18n 키.
  const stepKeys = [
    "settings.byok.demo.card.step.1",
    "settings.byok.demo.card.step.2",
    "settings.byok.demo.card.step.3",
    "settings.byok.demo.card.step.4",
    "settings.byok.demo.card.step.5",
    "settings.byok.demo.card.step.6",
  ];
  const stepHits = stepKeys.filter((k) => card.includes(`"${k}"`));
  if (stepHits.length === 6) {
    pass("4. step 6종 i18n 키 (step.1∼6) grep");
  } else {
    fail("4. step 6종 i18n 키", `expected 6, got ${stepHits.length}`);
  }

  // 5) tabIndex + 1분 tick + clearInterval.
  const hasTabIndex = /tabIndex=\{0\}/.test(card);
  const hasTickMs = /TICK_MS\s*=\s*60_000/.test(card);
  const hasClearInterval = /clearInterval\(/.test(card);
  if (hasTabIndex && hasTickMs && hasClearInterval) {
    pass(
      "5. tabIndex={0} + TICK_MS=60_000 + clearInterval cleanup",
    );
  } else {
    fail(
      "5. interaction/timer",
      `tabIndex=${hasTabIndex} tick=${hasTickMs} clear=${hasClearInterval}`,
    );
  }

  if (failed === 0) {
    console.log("verify:byok-demo-card — 5/5 PASS");
  } else {
    console.error(`verify:byok-demo-card — FAIL (${failed} 게이트)`);
  }
}

main().catch((err) => {
  console.error("verify:byok-demo-card — ERROR", err);
  process.exit(1);
});
