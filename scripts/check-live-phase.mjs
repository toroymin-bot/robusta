#!/usr/bin/env node
/**
 * check-live-phase.mjs
 *   - C-D58-2 (D-Day 03시 슬롯, 2026-05-08) — Tori spec C-D58-2 (자체 선정 winner ⭐).
 *
 * Why: D-Day live phase 진입 사후 검증. release-freeze-cutoff.ts SoT 4 phase 분기를
 *   1:1 산식으로 미러하여 현재 시각의 phase 를 stdout JSON 출력. CLI 인자 --expect=<phase>
 *   지정 시 phase 불일치하면 exit 1 (verify:d58 게이트 d58-1 활용).
 *
 * 자율 정정 (D-58-자):
 *   - D-58-자-1: import 경로 — 명세 §C-D58-2 'src/modules/release/release-freeze-cutoff.ts' 추정 →
 *                실 'src/modules/launch/release-freeze-cutoff.ts' 사실 확정. (자율 정정 권한 §4 §C-D58-2
 *                엣지 케이스 ② 명시 정합).
 *   - D-58-자-2: .mjs ↔ .ts import 불가 — D-53-자-1 'CLI .mjs ↔ .ts 산식 미러 SoT' 락 정합.
 *                tsx dev-deps 추가 금지 (L-D58-2 단조 증가 + dev-deps +0 락 의무). 따라서 본 파일은
 *                release-freeze-cutoff.ts 산식을 직접 1:1 복사 (sim-release-freeze.mjs 동일 패턴).
 *                동기화 책임: release-freeze-cutoff.ts 변경자 본 파일 동시 갱신 의무.
 *
 * 함수 시그니처:
 *   computeLivePhase({ nowIso }) -> { phase, minutesToNext, cutoff, monitorStart, monitorDurationMin }
 *
 * 4 phase (release-freeze-cutoff.ts 1:1):
 *   - now <  RELEASE_FREEZE_CUTOFF_KST            → 'pre-freeze'
 *   - now >= cutoff && now <  monitorStart        → 'freeze'
 *   - now >= monitorStart && now < monitorEnd     → 'monitor'  (30 min)
 *   - now >= monitorEnd                           → 'live'
 *
 * 사용:
 *   $ node scripts/check-live-phase.mjs                  # 현재 phase JSON 1줄 출력 + exit 0
 *   $ node scripts/check-live-phase.mjs --expect=live    # phase 불일치 시 exit 1
 *
 * 외부 dev-deps +0 (node 표준만).
 */

// === SoT 미러 (release-freeze-cutoff.ts 1:1 — D-53-자-1 / D-58-자-2 락) ===
const RELEASE_FREEZE_CUTOFF_KST = "2026-05-07T23:00:00+09:00";
const LIVE_MONITOR_START_KST = "2026-05-08T00:00:00+09:00";
const LIVE_MONITOR_DURATION_MIN = 30;
const ONE_MINUTE_MS = 60_000;

/**
 * computeLivePhase — phase 산출 (release-freeze-cutoff.ts getReleaseFreezeStatus 1:1 미러).
 */
export function computeLivePhase({ nowIso } = {}) {
  const nowMs = nowIso ? new Date(nowIso).getTime() : Date.now();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("invalid nowIso");
  }
  const cutoffMs = new Date(RELEASE_FREEZE_CUTOFF_KST).getTime();
  const monitorStartMs = new Date(LIVE_MONITOR_START_KST).getTime();
  const monitorEndMs =
    monitorStartMs + LIVE_MONITOR_DURATION_MIN * ONE_MINUTE_MS;

  let phase;
  let minutesToNext;
  if (nowMs < cutoffMs) {
    phase = "pre-freeze";
    minutesToNext = Math.floor((cutoffMs - nowMs) / ONE_MINUTE_MS);
  } else if (nowMs < monitorStartMs) {
    phase = "freeze";
    minutesToNext = Math.floor((monitorStartMs - nowMs) / ONE_MINUTE_MS);
  } else if (nowMs < monitorEndMs) {
    phase = "monitor";
    minutesToNext = Math.floor((monitorEndMs - nowMs) / ONE_MINUTE_MS);
  } else {
    phase = "live";
    minutesToNext = 0;
  }

  return {
    phase,
    minutesToNext,
    cutoff: RELEASE_FREEZE_CUTOFF_KST,
    monitorStart: LIVE_MONITOR_START_KST,
    monitorDurationMin: LIVE_MONITOR_DURATION_MIN,
  };
}

function parseExpect(argv) {
  const arg = argv.find((a) => a.startsWith("--expect="));
  if (!arg) return null;
  const v = arg.slice("--expect=".length);
  const valid = ["pre-freeze", "freeze", "monitor", "live"];
  if (!valid.includes(v)) {
    throw new RangeError(
      `invalid --expect value: ${v} (must be one of ${valid.join("|")})`,
    );
  }
  return v;
}

function main() {
  let expected;
  try {
    expected = parseExpect(process.argv.slice(2));
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }

  let result;
  try {
    result = computeLivePhase({});
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }

  console.log(JSON.stringify(result));

  if (expected && result.phase !== expected) {
    console.error(
      `check:live-phase — FAIL: expected '${expected}', got '${result.phase}' (minutesToNext=${result.minutesToNext})`,
    );
    process.exit(1);
  }

  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
