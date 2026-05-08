#!/usr/bin/env node
/**
 * check-show-hn-window.mjs
 *   - C-D62-4 (D-Day 19시 슬롯 §10, 2026-05-08) — Tori spec C-D62-4 (F-D62-2 / B-D62-2 본체).
 *
 * Why: Show HN submit 시점 기준 T+0 / T+12h / T+19h / T+24h 4-point 캡쳐 시점 정형 lock.
 *   외부 fetch 0건 / 본 도구는 시점 산식만 책임 (캡쳐 데이터 SoT 는 Confluence Task §11.5 표).
 *   ±15분 허용 윈도우 (HN response feed 변동성 흡수).
 *
 * 자율 정정 (D-58-자-2 락 정합):
 *   .mjs ↔ .ts import 불가 — 본 도구는 SUBMIT_DEADLINE_KST = "2026-05-07T22:00:00+09:00"
 *   기본값을 release-freeze-cutoff.ts 와 1:1 미러로 보유.
 *   동기화 책임: release-freeze-cutoff.ts 변경자가 본 도구 + sim-show-hn-submit.mjs 양쪽
 *   동시 갱신 의무 (verify:d62 G6 회귀 보호).
 *
 * 함수 시그니처 (export):
 *   checkShowHnWindow({ submitKst, now, capturedAt? })
 *     -> { ok, submit, now, tPlusH, window, next, captured, missing }
 *
 *     - submitKst: ISO 문자열. 미지정 시 DEFAULT_SUBMIT_KST.
 *     - now:       ISO 문자열 또는 Date. 미지정 시 new Date().
 *     - capturedAt: 선택 — 이미 캡쳐된 4-point 라벨 배열 ["T+0","T+12h","T+19h","T+24h"].
 *
 *     반환:
 *       tPlusH: now - submit (소수점 1자리)
 *       window: 현재 시점이 ±15분 허용 윈도우 안인 4-point 라벨 (없으면 'OUTSIDE').
 *       next:   다음 4-point 라벨 (모두 통과 시 'COMPLETE').
 *       captured: capturedAt 입력 그대로.
 *       missing: 4-point 중 capturedAt 미포함 + 현재 시점 already-passed 인 항목.
 *       ok=true ↔ missing 빈 배열.
 *
 * 입력 가드:
 *   - submitKst Invalid Date → throw RangeError
 *   - now Invalid Date → throw RangeError
 *
 * 사용 (CLI):
 *   $ node scripts/check-show-hn-window.mjs --submit-kst=2026-05-07T22:00:00+09:00 \
 *     --now=2026-05-08T19:00:00+09:00
 *   $ node scripts/check-show-hn-window.mjs   # 기본값 사용
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const TOLERANCE_MIN = 15;
const TOLERANCE_MS = TOLERANCE_MIN * 60 * 1000;

// release-freeze-cutoff.ts SUBMIT_DEADLINE_KST 1:1 미러 (D-58-자-2 락 정합).
const DEFAULT_SUBMIT_KST = "2026-05-07T22:00:00+09:00";

// 4-point T+ 시점 (시간 단위).
const POINTS = [
  { label: "T+0", h: 0 },
  { label: "T+12h", h: 12 },
  { label: "T+19h", h: 19 },
  { label: "T+24h", h: 24 },
];

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    submitKst: get("submit-kst") ?? DEFAULT_SUBMIT_KST,
    now: get("now"),
    capturedAt: get("captured-at"),
  };
}

/**
 * checkShowHnWindow — 4-point 시점 산식 read-only.
 */
export function checkShowHnWindow({ submitKst, now, capturedAt } = {}) {
  const submit = submitKst ?? DEFAULT_SUBMIT_KST;
  const submitMs = new Date(submit).getTime();
  if (!Number.isFinite(submitMs)) {
    throw new RangeError("invalid --submit-kst");
  }

  let nowDate;
  if (now instanceof Date) {
    nowDate = now;
  } else if (typeof now === "string" && now.length > 0) {
    nowDate = new Date(now);
  } else {
    nowDate = new Date();
  }
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("invalid --now");
  }

  const tPlusMs = nowMs - submitMs;
  const tPlusH = Math.round((tPlusMs / ONE_HOUR_MS) * 10) / 10;

  // 현재 윈도우 (±15분 허용).
  let windowLabel = "OUTSIDE";
  for (const p of POINTS) {
    const target = submitMs + p.h * ONE_HOUR_MS;
    if (Math.abs(nowMs - target) <= TOLERANCE_MS) {
      windowLabel = p.label;
      break;
    }
  }

  // 다음 4-point 라벨 (now 보다 이후, ±15분 허용 외).
  let nextLabel = "COMPLETE";
  for (const p of POINTS) {
    const target = submitMs + p.h * ONE_HOUR_MS;
    if (target > nowMs + TOLERANCE_MS) {
      nextLabel = p.label;
      break;
    }
  }

  // 이미 통과한 시점 중 capturedAt 에 없는 항목 = missing.
  let captured = [];
  if (Array.isArray(capturedAt)) {
    captured = capturedAt;
  } else if (typeof capturedAt === "string" && capturedAt.length > 0) {
    captured = capturedAt
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const missing = [];
  for (const p of POINTS) {
    const target = submitMs + p.h * ONE_HOUR_MS;
    const passed = nowMs - target > TOLERANCE_MS;
    if (passed && !captured.includes(p.label)) {
      missing.push(p.label);
    }
  }

  const ok = missing.length === 0;

  return {
    ok,
    submit,
    now: nowDate.toISOString(),
    tPlusH,
    window: windowLabel,
    next: nextLabel,
    captured,
    missing,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  try {
    result = checkShowHnWindow({
      submitKst: args.submitKst,
      now: args.now,
      capturedAt: args.capturedAt,
    });
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }

  console.log(JSON.stringify({ showHnWindow: result }));
  console.log(
    `check:show-hn-window ok=${result.ok} window=${result.window} next=${result.next} tPlusH=${result.tPlusH}`,
  );
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
