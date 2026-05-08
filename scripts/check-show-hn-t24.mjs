#!/usr/bin/env node
/**
 * check-show-hn-t24.mjs
 *   - C-D63-4 (D-Day 21시 EOD §11, 2026-05-08) — Tori spec C-D63-4 (F-D63-2 본체 read-only).
 *
 * Why: Show HN submit 시점 + 24h 캡쳐 시점(±15분 윈도우) 정형 lock.
 *   C-D62-4 check-show-hn-window.mjs 4-point 통합 도구와 별개로, T+24h 단일 시점 검증을 분리.
 *   외부 fetch 0건 / Dexie 미접근 / 본 도구는 시점 산식만 책임.
 *
 * 자율 정정 (D-58-자-2 락 정합):
 *   .mjs ↔ .ts import 불가 — DEFAULT_SUBMIT_KST = "2026-05-07T22:00:00+09:00" 기본값을
 *   release-freeze-cutoff.ts SUBMIT_DEADLINE_KST 와 1:1 미러로 보유.
 *   동기화 책임: release-freeze-cutoff.ts 변경자가 본 도구 + check-show-hn-window.mjs(C-D62-4)
 *   양쪽 동시 갱신 의무 (verify:d63 G6 회귀 보호).
 *
 * 함수 시그니처 (export):
 *   checkShowHnT24({ submitKst, now, capturedAt? })
 *     -> { targetKst, withinWindow, offsetMinutes, ok, issues }
 *
 *     - submitKst:  ISO 문자열. 미지정 시 DEFAULT_SUBMIT_KST.
 *     - now:        ISO 문자열 또는 Date.
 *     - capturedAt: 선택 — 캡쳐 시각 (미제공 시 now 사용).
 *
 *     반환:
 *       targetKst:      submitKst + 24h, ISO 출력 (UTC 산식 후 +09:00 보존).
 *       withinWindow:   |offsetMinutes| ≤ 15
 *       offsetMinutes:  ((capturedAt ?? now) - targetKst) / 60000
 *       ok:             withinWindow
 *       issues:         submitKst 비-KST 또는 invalid 입력 사유.
 *
 * 입력 가드:
 *   - submitKst Invalid Date → issues=['invalid submitKst'] / ok=false
 *   - submitKst 비-KST(+09:00 미포함) → issues=['submitKst must be KST']
 *   - now Invalid Date → issues=['invalid now'] / ok=false
 *
 * 사용 (CLI):
 *   $ node scripts/check-show-hn-t24.mjs \
 *       --submit=2026-05-07T22:00:00+09:00 \
 *       --now=2026-05-08T22:00:00+09:00
 *   $ node scripts/check-show-hn-t24.mjs   # 기본값 사용
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_MINUTE_MS = 60 * 1000;
const T_PLUS_24H_HOURS = 24;
const T_PLUS_24H_MS = T_PLUS_24H_HOURS * 60 * 60 * 1000;
const TOLERANCE_MIN = 15;

// release-freeze-cutoff.ts SUBMIT_DEADLINE_KST 1:1 미러 (D-58-자-2 락 정합).
const DEFAULT_SUBMIT_KST = "2026-05-07T22:00:00+09:00";

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    submitKst: get("submit") ?? DEFAULT_SUBMIT_KST,
    now: get("now"),
    capturedAt: get("captured"),
  };
}

/**
 * isKstSuffix — submitKst 가 KST(+09:00) suffix 로 끝나는지 검증.
 */
function isKstSuffix(s) {
  if (typeof s !== "string") return false;
  return /\+09:00$/.test(s);
}

/**
 * checkShowHnT24 — submit + 24h ±15분 윈도우 산식 read-only.
 */
export function checkShowHnT24({ submitKst, now, capturedAt } = {}) {
  const issues = [];
  const submit = submitKst ?? DEFAULT_SUBMIT_KST;

  if (!isKstSuffix(submit)) {
    issues.push("submitKst must be KST");
  }
  const submitMs = new Date(submit).getTime();
  if (!Number.isFinite(submitMs)) {
    issues.push("invalid submitKst");
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
    issues.push("invalid now");
  }

  const targetMs = Number.isFinite(submitMs) ? submitMs + T_PLUS_24H_MS : NaN;
  const targetKst = Number.isFinite(targetMs)
    ? formatKstIso(targetMs)
    : "INVALID";

  let capMs = nowMs;
  if (typeof capturedAt === "string" && capturedAt.length > 0) {
    const c = new Date(capturedAt).getTime();
    if (Number.isFinite(c)) {
      capMs = c;
    } else {
      issues.push("invalid capturedAt");
    }
  } else if (capturedAt instanceof Date) {
    const c = capturedAt.getTime();
    if (Number.isFinite(c)) {
      capMs = c;
    } else {
      issues.push("invalid capturedAt");
    }
  }

  let offsetMinutes = 0;
  let withinWindow = false;
  if (Number.isFinite(targetMs) && Number.isFinite(capMs)) {
    offsetMinutes = (capMs - targetMs) / ONE_MINUTE_MS;
    withinWindow = Math.abs(offsetMinutes) <= TOLERANCE_MIN;
  }

  const ok = withinWindow && issues.length === 0;

  return {
    targetKst,
    withinWindow,
    offsetMinutes: Math.round(offsetMinutes * 100) / 100,
    ok,
    issues,
  };
}

/**
 * formatKstIso — UTC ms → +09:00 ISO 출력.
 */
function formatKstIso(ms) {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yr}-${mo}-${da}T${hh}:${mm}:${ss}+09:00`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkShowHnT24({
    submitKst: args.submitKst,
    now: args.now,
    capturedAt: args.capturedAt,
  });
  console.log(JSON.stringify({ showHnT24: result }));
  console.log(
    `check:show-hn-t24 ok=${result.ok} target=${result.targetKst} offset=${result.offsetMinutes}min within=${result.withinWindow}`,
  );
  if (!result.ok && result.issues.length > 0) {
    console.error(`issues: ${result.issues.join(" / ")}`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
