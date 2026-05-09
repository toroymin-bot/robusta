#!/usr/bin/env node
/**
 * check-live-plus-48h.mjs
 *   - C-D66-1 (D+1 11시 §6 슬롯, 2026-05-09) — Tori spec C-D66-1.
 *
 * Why: LIVE +48h ±15분 윈도우 정형 lock.
 *   submit + 48h 시점 ±15분 정합 검증 read-only 게이트.
 *   외부 fetch 0건 / Dexie 미접근 / 본 도구는 시점 산식만 책임.
 *
 * 자율 정정 (D-66-자-1):
 *   환경 변수 LIVE_PLUS_48H_WINDOW_MIN 으로 windowMin override 가능 (디폴트 15 보존, backward-compatible).
 *
 * 함수 시그니처 (default export):
 *   checkLivePlus48h({ submitKst, nowKst, windowMin?, freeze? })
 *     -> { ok, deltaMin, reason? }
 *
 *     - submitKst:  ISO 문자열 with +09:00.
 *     - nowKst:     ISO 문자열 with +09:00.
 *     - windowMin:  정수, 디폴트 15 (env LIVE_PLUS_48H_WINDOW_MIN override 가능).
 *     - freeze:     boolean, 디폴트 false. true면 항상 ok=false, reason='freeze'.
 *
 * 엣지:
 *   1) submitKst 누락 → throw Error('submitKst required')
 *   2) windowMin <= 0 → throw Error('windowMin must be positive')
 *   3) +09:00 offset 아님 → throw Error('KST offset required')
 *   4) nowKst < submitKst+48h → deltaMin 음수, ok 가능
 *   5) freeze=true → 항상 ok=false, reason='freeze'
 *
 * 사용 (CLI):
 *   $ node scripts/check-live-plus-48h.mjs --submit=2026-05-07T22:00:00+09:00 \
 *       --now=2026-05-09T22:00:00+09:00
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_MINUTE_MS = 60 * 1000;
const T_PLUS_48H_HOURS = 48;
const T_PLUS_48H_MS = T_PLUS_48H_HOURS * 60 * 60 * 1000;
const DEFAULT_WINDOW_MIN = 15;

// 디폴트 LIVE +48h 시점 (5/7 22:00 KST submit + 48h, D-58-자-2 SUBMIT_DEADLINE_KST 정합).
// 본 값은 추정 — submitKst 인자 우선.
export const LIVE_PLUS_48H_KST = "2026-05-09T22:00:00+09:00";

function isKstSuffix(s) {
  if (typeof s !== "string") return false;
  return /\+09:00$/.test(s);
}

function envWindowMin() {
  const v = process.env.LIVE_PLUS_48H_WINDOW_MIN;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_WINDOW_MIN;
}

export default function checkLivePlus48h({
  submitKst,
  nowKst,
  windowMin,
  freeze = false,
} = {}) {
  if (typeof submitKst !== "string" || submitKst.length === 0) {
    throw new Error("submitKst required");
  }
  if (typeof nowKst !== "string" || nowKst.length === 0) {
    throw new Error("nowKst required");
  }
  const win = windowMin === undefined || windowMin === null ? envWindowMin() : windowMin;
  if (typeof win !== "number" || !Number.isFinite(win) || win <= 0) {
    throw new Error("windowMin must be positive");
  }
  if (!isKstSuffix(submitKst) || !isKstSuffix(nowKst)) {
    throw new Error("KST offset required");
  }
  const submitMs = new Date(submitKst).getTime();
  const nowMs = new Date(nowKst).getTime();
  if (!Number.isFinite(submitMs) || !Number.isFinite(nowMs)) {
    throw new Error("invalid date");
  }
  const targetMs = submitMs + T_PLUS_48H_MS;
  const deltaMin = Math.round((nowMs - targetMs) / ONE_MINUTE_MS);
  if (freeze) {
    return { ok: false, deltaMin, reason: "freeze" };
  }
  const ok = Math.abs(deltaMin) <= win;
  return { ok, deltaMin };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    submitKst: get("submit"),
    nowKst: get("now"),
    windowMin: get("window-min"),
    freeze: argv.includes("--freeze"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const result = checkLivePlus48h({
      submitKst: args.submitKst,
      nowKst: args.nowKst,
      windowMin: args.windowMin === null ? undefined : parseInt(args.windowMin, 10),
      freeze: args.freeze,
    });
    console.log(JSON.stringify({ livePlus48h: result }));
    console.log(
      `check:live-plus-48h ok=${result.ok} deltaMin=${result.deltaMin}${result.reason ? ` reason=${result.reason}` : ""}`,
    );
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    console.error(`check:live-plus-48h ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
