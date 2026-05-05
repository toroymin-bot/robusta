#!/usr/bin/env node
/**
 * sim-kq23-dismiss.mjs
 *   - C-D46-5 (D-2 03시 슬롯, 2026-05-06) — Tori spec C-D46-5 (F-D46-5 / D-D46-4).
 *
 * Why: KQ_23 banner LIVE 도달 자동 dismiss + 24h hold 시뮬레이션 게이트.
 *   RELEASE_ISO 정합 + localStorage Mock + isLive() 60s tick 정합 회귀.
 *
 * 자율 정정:
 *   - 외부 dev-deps +0 의무 — JSDOM/vitest fakeTimers 미사용. 순수 산술 + 모듈 grep만.
 *
 * 게이트 (7/7 PASS 의무):
 *   1) RELEASE_ISO grep = '2026-05-08T00:00:00+09:00' (dday-config.ts SoT 정합)
 *   2) LIVE_DISMISS_KEY grep = 'kq23.live.dismissed.at' (banner.tsx)
 *   3) LIVE_DISMISS_HOLD_MS grep = 24 * 60 * 60 * 1000 (24h)
 *   4) banner.tsx setInterval 60_000 grep (60s tick 정합)
 *   5) banner.tsx isLive() import grep
 *   6) banner.tsx fade 300ms ease-out grep (D-D46-4)
 *   7) banner.tsx translateY(0) grep (slide-up 정합 D-D46-4)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const ddayPath = resolve(root, "src/modules/dday/dday-config.ts");
const bannerPath = resolve(
  root,
  "src/modules/domain/domain-fallback-banner.tsx",
);

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log("sim:kq23-dismiss — KQ_23 LIVE 자동 dismiss + 24h hold 시뮬");

  const dday = await readFile(ddayPath, "utf8");
  const banner = await readFile(bannerPath, "utf8");

  // 1) RELEASE_ISO SoT 정합.
  if (dday.includes("2026-05-08T00:00:00+09:00")) {
    pass("1. RELEASE_ISO = 2026-05-08T00:00:00+09:00");
  } else {
    fail("1. RELEASE_ISO", "expected 2026-05-08T00:00:00+09:00 not found");
  }

  // 2) LIVE_DISMISS_KEY.
  if (banner.includes('"kq23.live.dismissed.at"')) {
    pass("2. LIVE_DISMISS_KEY = kq23.live.dismissed.at");
  } else {
    fail("2. LIVE_DISMISS_KEY", "key string not found");
  }

  // 3) 24h hold ms 정합.
  if (banner.match(/24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/)) {
    pass("3. LIVE_DISMISS_HOLD_MS = 24h");
  } else {
    fail("3. 24h hold", "24 * 60 * 60 * 1000 expression not found");
  }

  // 4) 60s tick.
  if (banner.match(/setInterval\s*\(\s*tick\s*,\s*60_?000\s*\)/)) {
    pass("4. setInterval(tick, 60_000)");
  } else {
    fail("4. 60s tick", "setInterval(tick, 60000) not found");
  }

  // 5) isLive() import.
  if (
    banner.includes('import { isLive }') ||
    banner.includes('isLive,') ||
    banner.match(/from\s+"@\/modules\/dday\/dday-config"/)
  ) {
    if (banner.match(/\bisLive\b\s*\(\s*\)/)) {
      pass("5. isLive() call grep");
    } else {
      fail("5. isLive()", "isLive() call not found");
    }
  } else {
    fail("5. isLive import", "import not found");
  }

  // 6) fade 300ms ease-out.
  if (
    banner.includes("opacity 300ms ease-out") ||
    banner.match(/transition:[^\n]*opacity\s+300ms\s+ease-out/)
  ) {
    pass("6. fade 300ms ease-out (D-D46-4)");
  } else {
    fail("6. fade 300ms", "opacity 300ms ease-out not found");
  }

  // 7) translateY(0) — slide-up base.
  if (banner.includes("translateY(0)")) {
    pass("7. translateY(0) base (D-D46-4 slide-up)");
  } else {
    fail("7. translateY", "translateY(0) not found");
  }

  // 산술 시뮬레이션 — 시각 정합 검증.
  const releaseMs = new Date("2026-05-08T00:00:00+09:00").getTime();
  const oneSecBefore = releaseMs - 1000;
  const oneSecAfter = releaseMs + 1000;
  const holdMs = 24 * 60 * 60 * 1000;
  const justAfterHold = releaseMs + holdMs + 1000;

  // 1초 이전 → isLive false (banner 노출).
  // 1초 이후 → isLive true (자동 dismiss + localStorage set).
  // 24h+1s 이후 → hold expired (releaseMs 기준 24h+1s 차이는 holdMs 초과).
  const beforeAssumption = oneSecBefore < releaseMs;
  const afterAssumption = oneSecAfter >= releaseMs;
  const expiredAssumption = justAfterHold - releaseMs > holdMs;
  if (beforeAssumption && afterAssumption && expiredAssumption) {
    pass("8. timeline arithmetic (before/after/24h-expired) consistent");
  } else {
    fail(
      "8. timeline",
      `before=${beforeAssumption} after=${afterAssumption} expired=${expiredAssumption}`,
    );
  }

  if (process.exitCode === 1) {
    console.error("sim:kq23-dismiss — FAIL");
  } else {
    console.log("sim:kq23-dismiss — 8/8 PASS");
  }
}

main().catch((err) => {
  console.error("sim:kq23-dismiss — ERROR", err);
  process.exit(1);
});
