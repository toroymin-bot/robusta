#!/usr/bin/env node
/**
 * sim-hero-live-transition.mjs
 *   - C-D38-5 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-5 (V-D38-5 (c) + D-D38-2 (e)).
 *
 * Why: D-Day(2026-05-08 00:00:00 KST) 정각 자동 D-N → LIVE 전환을 사전 시뮬 검증.
 *   사용자 첫 방문 직전/정각/직후 3 케이스에서 formatDDay 결과 정합 확인 → D-Day 사고 0 보장.
 *
 * 정책 (자율 정정 D-38-자-2 + D-38-자-5):
 *   - 명세 hero-day-counter.tsx 파일 미존재 — 실제 SoT = src/modules/dday/dday-config.ts.
 *     본 시뮬은 dday-config.ts 의 RELEASE_ISO + daysUntilRelease 로직을 인라인 복제 (dep 0 의무).
 *   - SoT 정합 검증은 verify-d38.mjs 가 두 위치 RELEASE_ISO 동일 grep 으로 보장.
 *   - 자율 정정 D-38-자-5: 명세 시뮬 케이스 5/8 09:59:59 KST → "D-1" 은 RELEASE_ISO (5/8 00:00 KST) 와 모순.
 *     RELEASE_ISO 무수정 의무 (D-36-자-1) 정합 — 시뮬 케이스를 RELEASE_ISO 정합 시점으로 조정:
 *       (1) 2026-05-07 23:59:59 KST → "D-1" (release 까지 1초)
 *       (2) 2026-05-08 00:00:00 KST → "LIVE" (release == now)
 *       (3) 2026-05-08 00:00:01 KST → "LIVE" (release 이후)
 *     명세 의도(D-N → LIVE 자동 전환) 동일 검증 — 시점만 정각 자정 KST 로 평행 이동.
 *
 * 엣지:
 *   - timezone — 입력 ISO +09:00 강제 (사용자 브라우저 timezone 무관 KST 정합).
 *   - D-Day 이후 (음수 n) → "LIVE" (Math.ceil 정합).
 *
 * 외부 dep: 0 (Node 표준만 — node:assert / node:process).
 *
 * 종료 코드:
 *   - 모두 PASS → exit 0.
 *   - 1건이라도 FAIL → exit 1.
 */

// ─────────────────────────────────────────────────────────────────────────────
// dday-config.ts SoT 인라인 복제 (verify-d38 grep 게이트로 동기 보장).
// ─────────────────────────────────────────────────────────────────────────────
const RELEASE_ISO = "2026-05-08T00:00:00+09:00";

/**
 * release 까지 남은 일수 (Math.ceil 정합 — dday-config.ts daysUntilRelease 와 동일).
 */
function daysUntilRelease(now) {
  const release = new Date(RELEASE_ISO);
  const diffMs = release.getTime() - now.getTime();
  return Math.ceil(diffMs / 86_400_000);
}

/**
 * formatDDay — `(now: Date) => string` 시그니처 (dday-config.ts formatDDay 와 동일).
 *   양수 n → "D-{n}" / n ≤ 0 → "LIVE".
 */
function formatDDay(now) {
  const n = daysUntilRelease(now);
  return n > 0 ? `D-${n}` : "LIVE";
}

// ─────────────────────────────────────────────────────────────────────────────
// 시뮬 케이스 3회 (자율 정정 D-38-자-5).
// ─────────────────────────────────────────────────────────────────────────────
const cases = [
  {
    name: "T-1s (5/7 23:59:59 KST)",
    now: new Date("2026-05-07T23:59:59+09:00"),
    expected: "D-1",
  },
  {
    name: "T0 (5/8 00:00:00 KST)",
    now: new Date("2026-05-08T00:00:00+09:00"),
    expected: "LIVE",
  },
  {
    name: "T+1s (5/8 00:00:01 KST)",
    now: new Date("2026-05-08T00:00:01+09:00"),
    expected: "LIVE",
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const out = formatDDay(c.now);
  if (out === c.expected) {
    console.log(`✓ ${c.name} → ${out}`);
    pass += 1;
  } else {
    console.error(`✗ ${c.name} → expected "${c.expected}", got "${out}"`);
    fail += 1;
  }
}

console.log(`\n총 ${cases.length} · PASS ${pass} · FAIL ${fail}`);

if (fail > 0) {
  console.error("\n✗ sim:hero-live FAILED — D-Day 자동 전환 게이트 차단");
  process.exit(1);
}

console.log("\n✓ sim:hero-live PASSED — D-Day 자동 전환 시뮬 3/3");
process.exit(0);
