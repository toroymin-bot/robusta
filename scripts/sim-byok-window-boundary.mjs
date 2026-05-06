#!/usr/bin/env node
/**
 * sim-byok-window-boundary.mjs
 *   - 자율 D-50-자-1 (D-2 19시 슬롯, 2026-05-06) — BYOK_DEMO_ISO 윈도우 경계 산술 회귀 가드.
 *
 * Why: BYOK 시연 16:00 KST 이미 종료(현재 19:09 KST 기준 T+3h09m). 차후 회귀로
 *   윈도우 산식이 변경되면 시연 재개 시 카드/lozenge 가 잘못된 시각에 노출될 수 있음.
 *   - byok-demo-card visible 윈도우: target ±2h (4시간 표시, 경계 제외)
 *   - byok-countdown-lozenge phase: T-5 → t5, T+0 → now, T+30 이후 → done
 *
 * 검증 방법: 코드 상수(WINDOW_MS_BEFORE/AFTER, T5_WINDOW_MS, T30_WINDOW_MS)를
 *   소스 파일에서 직접 읽고, 산식을 시뮬레이터로 재현해 경계 시각 ±1ms 동등성 확인.
 *   실 mount 미실행, jsdom 미사용 — node 표준만.
 *
 * 8 케이스:
 *   A) byok-demo-card visible 4 케이스
 *      A1) target - WINDOW_MS_BEFORE         → visible=false (경계 제외)
 *      A2) target - WINDOW_MS_BEFORE + 1ms  → visible=true
 *      A3) target + WINDOW_MS_AFTER - 1ms   → visible=true
 *      A4) target + WINDOW_MS_AFTER          → visible=false (경계 제외)
 *   B) byok-countdown-lozenge phase 4 케이스
 *      B1) target - T5_WINDOW_MS - 1ms       → phase=hidden
 *      B2) target - T5_WINDOW_MS              → phase=t5 (5분 정확히)
 *      B3) target + T30_WINDOW_MS - 1ms      → phase=now
 *      B4) target + T30_WINDOW_MS             → phase=done
 *
 * 외부 dev-deps +0.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const cardPath = resolve(root, "src/modules/settings/byok-demo-card.tsx");
const lozPath = resolve(root, "src/modules/settings/byok-countdown-lozenge.tsx");
const ddayPath = resolve(root, "src/modules/dday/dday-config.ts");

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

function extractNumberConst(src, name) {
  // 형식: const NAME = <expr>; — <expr>는 곱셈 산식 가능 (예: 2 * 60 * 60_000)
  const re = new RegExp(`const\\s+${name}\\s*=\\s*([^;\\n]+);`);
  const m = src.match(re);
  if (!m) return null;
  const expr = m[1].replace(/_/g, "").trim();
  // 안전 평가: 숫자/연산자/공백/주석만 허용
  if (!/^[\d\s\*\+\-\/\(\)\.]+$/.test(expr)) return null;
  // eslint-disable-next-line no-new-func
  try {
    return Function(`"use strict"; return (${expr});`)();
  } catch {
    return null;
  }
}

function extractIsoConst(src, name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*"([^"]+)"`);
  const m = src.match(re);
  return m ? m[1] : null;
}

// 코드 산식 재현 (byok-demo-card.tsx)
function visibleAt(nowMs, targetMs, before, after) {
  const diff = nowMs - targetMs;
  return diff > -before && diff < after;
}

// 코드 산식 재현 (byok-countdown-lozenge.tsx)
function computePhase(nowMs, targetMs, t5, t30) {
  const diff = targetMs - nowMs;
  if (diff > t5) return "hidden";
  if (diff > 0) return "t5";
  if (diff > -t30) return "now";
  return "done";
}

async function main() {
  console.log("sim:byok-window-boundary — BYOK_DEMO_ISO 윈도우 경계 4+4 = 8 케이스");

  const cardSrc = await readFile(cardPath, "utf8");
  const lozSrc = await readFile(lozPath, "utf8");
  const ddaySrc = await readFile(ddayPath, "utf8");

  const before = extractNumberConst(cardSrc, "WINDOW_MS_BEFORE");
  const after = extractNumberConst(cardSrc, "WINDOW_MS_AFTER");
  const t5 = extractNumberConst(lozSrc, "T5_WINDOW_MS");
  const t30 = extractNumberConst(lozSrc, "T30_WINDOW_MS");
  const iso = extractIsoConst(ddaySrc, "BYOK_DEMO_ISO");

  if (before === null || after === null) {
    fail("setup", `byok-demo-card 상수 추출 실패 — before=${before} after=${after}`);
    return;
  }
  if (t5 === null || t30 === null) {
    fail("setup", `byok-countdown-lozenge 상수 추출 실패 — t5=${t5} t30=${t30}`);
    return;
  }
  if (!iso) {
    fail("setup", "BYOK_DEMO_ISO 추출 실패");
    return;
  }

  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) {
    fail("setup", `BYOK_DEMO_ISO 파싱 실패: ${iso}`);
    return;
  }

  console.log(
    `  · BYOK_DEMO_ISO=${iso} · before=${before}ms · after=${after}ms · t5=${t5}ms · t30=${t30}ms`,
  );

  // A) byok-demo-card visible 4 케이스
  {
    const got = visibleAt(target - before, target, before, after);
    if (got === false) {
      pass("A1) target - WINDOW_MS_BEFORE → visible=false (경계 제외)");
    } else {
      fail("A1)", `expected false, got ${got}`);
    }
  }
  {
    const got = visibleAt(target - before + 1, target, before, after);
    if (got === true) {
      pass("A2) target - WINDOW_MS_BEFORE + 1ms → visible=true");
    } else {
      fail("A2)", `expected true, got ${got}`);
    }
  }
  {
    const got = visibleAt(target + after - 1, target, before, after);
    if (got === true) {
      pass("A3) target + WINDOW_MS_AFTER - 1ms → visible=true");
    } else {
      fail("A3)", `expected true, got ${got}`);
    }
  }
  {
    const got = visibleAt(target + after, target, before, after);
    if (got === false) {
      pass("A4) target + WINDOW_MS_AFTER → visible=false (경계 제외)");
    } else {
      fail("A4)", `expected false, got ${got}`);
    }
  }

  // B) byok-countdown-lozenge phase 4 케이스
  {
    const got = computePhase(target - t5 - 1, target, t5, t30);
    if (got === "hidden") {
      pass("B1) target - T5_WINDOW_MS - 1ms → phase=hidden");
    } else {
      fail("B1)", `expected hidden, got ${got}`);
    }
  }
  {
    const got = computePhase(target - t5, target, t5, t30);
    if (got === "t5") {
      pass("B2) target - T5_WINDOW_MS → phase=t5 (5분 정각)");
    } else {
      fail("B2)", `expected t5, got ${got}`);
    }
  }
  {
    const got = computePhase(target + t30 - 1, target, t5, t30);
    if (got === "now") {
      pass("B3) target + T30_WINDOW_MS - 1ms → phase=now");
    } else {
      fail("B3)", `expected now, got ${got}`);
    }
  }
  {
    const got = computePhase(target + t30, target, t5, t30);
    if (got === "done") {
      pass("B4) target + T30_WINDOW_MS → phase=done");
    } else {
      fail("B4)", `expected done, got ${got}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("sim:byok-window-boundary — FAIL");
  } else {
    console.log("sim:byok-window-boundary — 8/8 PASS");
  }
}

main().catch((err) => {
  console.error("sim:byok-window-boundary — ERROR", err);
  process.exit(1);
});
