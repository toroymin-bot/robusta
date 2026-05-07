#!/usr/bin/env node
/**
 * sim-release-freeze.mjs
 *   - C-D56-4 (D-1 19시 슬롯, 2026-05-07) — Tori spec C-D56-3/4 (CLI 미러 SoT).
 *
 * Why: release-freeze-cutoff.ts 산식 1:1 .mjs 미러 (D-53-자-1 CLI .mjs ↔ .ts 산식 미러 SoT 락).
 *   .mjs 에서 .ts import 불가 (tsx dev-deps 추가 금지) — 산식 직접 복사.
 *   동기화 책임: release-freeze-cutoff.ts 변경자 본 파일 동시 갱신 의무.
 *
 * 함수 시그니처:
 *   simReleaseFreeze({ nowIso }) -> { phase, minutesToNext }
 *
 * 4 케이스 (4/4 PASS 의무):
 *   1) pre-freeze — now=17:00 KST → phase=pre-freeze, minutesToNext=360
 *   2) freeze     — now=23:00 KST → phase=freeze,     minutesToNext=60
 *   3) monitor    — now=5/8 00:00 KST → phase=monitor, minutesToNext=30
 *   4) live       — now=5/8 00:30 KST → phase=live,    minutesToNext=0
 *
 * 외부 dev-deps +0 (node 표준만).
 */

// === SoT 미러 (release-freeze-cutoff.ts 1:1) ===
const RELEASE_FREEZE_CUTOFF_KST = "2026-05-07T23:00:00+09:00";
const LIVE_MONITOR_START_KST = "2026-05-08T00:00:00+09:00";
const LIVE_MONITOR_DURATION_MIN = 30;
const ONE_MINUTE_MS = 60_000;

/**
 * simReleaseFreeze — phase 산출 (release-freeze-cutoff.ts getReleaseFreezeStatus 1:1 미러).
 */
export function simReleaseFreeze({ nowIso }) {
  const nowMs = new Date(nowIso).getTime();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("invalid nowIso");
  }
  const cutoffMs = new Date(RELEASE_FREEZE_CUTOFF_KST).getTime();
  const monitorStartMs = new Date(LIVE_MONITOR_START_KST).getTime();
  const monitorEndMs =
    monitorStartMs + LIVE_MONITOR_DURATION_MIN * ONE_MINUTE_MS;

  if (nowMs < cutoffMs) {
    return {
      phase: "pre-freeze",
      minutesToNext: Math.floor((cutoffMs - nowMs) / ONE_MINUTE_MS),
    };
  }
  if (nowMs < monitorStartMs) {
    return {
      phase: "freeze",
      minutesToNext: Math.floor((monitorStartMs - nowMs) / ONE_MINUTE_MS),
    };
  }
  if (nowMs < monitorEndMs) {
    return {
      phase: "monitor",
      minutesToNext: Math.floor((monitorEndMs - nowMs) / ONE_MINUTE_MS),
    };
  }
  return { phase: "live", minutesToNext: 0 };
}

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

function main() {
  console.log(
    "sim:release-freeze — D-1/D-Day phase 산출 4 케이스 (release-freeze-cutoff.ts 미러)",
  );

  const cases = [
    {
      name: "1. pre-freeze (5/7 17:00 KST → 360 min to cutoff)",
      nowIso: "2026-05-07T17:00:00+09:00",
      expected: { phase: "pre-freeze", minutesToNext: 360 },
    },
    {
      name: "2. freeze (5/7 23:00 KST → 60 min to monitor)",
      nowIso: "2026-05-07T23:00:00+09:00",
      expected: { phase: "freeze", minutesToNext: 60 },
    },
    {
      name: "3. monitor (5/8 00:00 KST → 30 min to live)",
      nowIso: "2026-05-08T00:00:00+09:00",
      expected: { phase: "monitor", minutesToNext: 30 },
    },
    {
      name: "4. live (5/8 00:30 KST → 0)",
      nowIso: "2026-05-08T00:30:00+09:00",
      expected: { phase: "live", minutesToNext: 0 },
    },
  ];

  for (const c of cases) {
    const r = simReleaseFreeze({ nowIso: c.nowIso });
    if (
      r.phase === c.expected.phase &&
      r.minutesToNext === c.expected.minutesToNext
    ) {
      pass(`${c.name} → phase=${r.phase} minutesToNext=${r.minutesToNext}`);
    } else {
      fail(
        c.name,
        `expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(r)}`,
      );
    }
  }

  if (process.exitCode === 1) {
    console.error("sim:release-freeze — FAIL");
  } else {
    console.log("sim:release-freeze — 4/4 PASS");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
