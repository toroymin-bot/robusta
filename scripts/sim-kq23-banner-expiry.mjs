#!/usr/bin/env node
/**
 * sim-kq23-banner-expiry.mjs
 *   - C-D53-4 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-4 (F-D53-2 본체).
 *
 * Why: shouldDismissKq23Banner 5 케이스 sim 검증.
 *   .ts 파일 직접 import 불가 → 산식 미러 (24h 만료 + invalid + clock skew + null).
 *
 * 게이트 (5/5 PASS 의무):
 *   1) dismissedAtIso=null → false (banner 표시)
 *   2) 23.99h 경과 → false (미만료)
 *   3) 24.00h 경과 → true (만료 boundary inclusive)
 *   4) 24.01h 경과 → true (만료)
 *   5) clock skew (now < dismissedAt) → false (음수 차이 = 미만료)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const KQ23_BANNER_HOLD_MS = 24 * 60 * 60 * 1000;

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

// shouldDismissKq23Banner 미러 (.ts 직접 import 불가).
function shouldDismiss(opts = {}) {
  const now = opts.now ?? new Date();
  let dismissedAtIso;
  if (opts.dismissedAtIso !== undefined) {
    dismissedAtIso = opts.dismissedAtIso;
  } else {
    return false; // sim은 항상 inject (SSR throw 시뮬 안 함)
  }
  if (dismissedAtIso === null) return false;
  const dismissedMs = new Date(dismissedAtIso).getTime();
  if (Number.isNaN(dismissedMs)) return false;
  const diffMs = now.getTime() - dismissedMs;
  if (diffMs < 0) return false;
  return diffMs >= KQ23_BANNER_HOLD_MS;
}

function main() {
  console.log("sim:kq23-banner-expiry — 5 케이스 검증");

  // 1) null → false.
  {
    const r = shouldDismiss({ dismissedAtIso: null });
    if (r === false) {
      pass("1. dismissedAtIso=null → false (banner 표시)");
    } else {
      fail("1. null", `expected false, got ${r}`);
    }
  }

  // 2) 23.99h → false.
  {
    const dismissedAt = new Date("2026-05-07T00:00:00Z");
    const now = new Date(dismissedAt.getTime() + 23.99 * 60 * 60 * 1000);
    const r = shouldDismiss({
      now,
      dismissedAtIso: dismissedAt.toISOString(),
    });
    if (r === false) {
      pass("2. 23.99h 경과 → false (미만료)");
    } else {
      fail("2. 23.99h", `expected false, got ${r}`);
    }
  }

  // 3) 24.00h → true (boundary inclusive).
  {
    const dismissedAt = new Date("2026-05-07T00:00:00Z");
    const now = new Date(dismissedAt.getTime() + 24 * 60 * 60 * 1000);
    const r = shouldDismiss({
      now,
      dismissedAtIso: dismissedAt.toISOString(),
    });
    if (r === true) {
      pass("3. 24.00h 경과 → true (boundary inclusive 만료)");
    } else {
      fail("3. 24.00h", `expected true, got ${r}`);
    }
  }

  // 4) 24.01h → true.
  {
    const dismissedAt = new Date("2026-05-07T00:00:00Z");
    const now = new Date(dismissedAt.getTime() + 24.01 * 60 * 60 * 1000);
    const r = shouldDismiss({
      now,
      dismissedAtIso: dismissedAt.toISOString(),
    });
    if (r === true) {
      pass("4. 24.01h 경과 → true (만료)");
    } else {
      fail("4. 24.01h", `expected true, got ${r}`);
    }
  }

  // 5) clock skew (now < dismissedAt) → false.
  {
    const dismissedAt = new Date("2026-05-07T00:00:00Z");
    const now = new Date(dismissedAt.getTime() - 1 * 60 * 60 * 1000); // 1h 이전
    const r = shouldDismiss({
      now,
      dismissedAtIso: dismissedAt.toISOString(),
    });
    if (r === false) {
      pass("5. clock skew (now < dismissedAt) → false (음수 차이)");
    } else {
      fail("5. clock skew", `expected false, got ${r}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("sim:kq23-banner-expiry — FAIL");
  } else {
    console.log("sim:kq23-banner-expiry — 5/5 PASS");
  }
}

main();
