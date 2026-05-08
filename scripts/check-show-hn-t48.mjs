#!/usr/bin/env node
/**
 * check-show-hn-t48.mjs
 *   - C-D64-2 (D+1 03시 §2 슬롯, 2026-05-09) — Tori spec C-D64-2 (B-D64-2 본체 read-only).
 *
 * Why: Show HN submit + 48h ±15분 윈도우 정형 lock.
 *   C-D63-4 check-show-hn-t24.mjs 의 +24h offset 미러 — 산식 직접 복사 (offset만 24→48h).
 *   외부 fetch 0건 / Dexie 미접근 / 본 도구는 시점 산식 + 데이터 4-row 정합만 책임.
 *
 * 자율 정정 (D-58-자-2 락 정합):
 *   .mjs ↔ .ts import 불가 — DEFAULT_SUBMIT_KST = "2026-05-07T22:00:00+09:00" 기본값을
 *   release-freeze-cutoff.ts SUBMIT_DEADLINE_KST 와 1:1 미러로 보유.
 *   동기화 책임: release-freeze-cutoff.ts 변경자가 본 도구 + check-show-hn-t24/window 동시 갱신 의무.
 *
 * 함수 시그니처 (export):
 *   checkShowHnT48({ submitKst, now, capturedAt?, dataPath? })
 *     -> { targetKst, withinWindow, offsetMinutes, dataRows, dataOk, ok, issues }
 *
 *     - submitKst:  ISO 문자열. 미지정 시 DEFAULT_SUBMIT_KST.
 *     - now:        ISO 문자열 또는 Date.
 *     - capturedAt: 선택 — 캡쳐 시각 (미제공 시 now 사용).
 *     - dataPath:   선택 — Show HN T+48h 4-row docs path. 미제공 시 dataOk=false.
 *
 * 사용 (CLI):
 *   $ node scripts/check-show-hn-t48.mjs --submit=2026-05-07T22:00:00+09:00 \
 *       --data-path=docs/SHOW-HN-T48-2026-05-09.md
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ONE_MINUTE_MS = 60 * 1000;
const T_PLUS_48H_HOURS = 48;
const T_PLUS_48H_MS = T_PLUS_48H_HOURS * 60 * 60 * 1000;
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
    capturedAt: get("captured-at") ?? get("captured"),
    dataPath: get("data-path") ?? "",
  };
}

function isKstSuffix(s) {
  if (typeof s !== "string") return false;
  return /\+09:00$/.test(s);
}

function readOrNull(p) {
  try {
    return readFileSync(resolve(process.cwd(), p), "utf8");
  } catch {
    return null;
  }
}

/**
 * checkShowHnRows — 헤더 + 정확히 1 데이터 행 (4 컬럼).
 *   헤더 정형: `| score | comments | position | capture_ts |`
 */
function checkShowHnRows(text) {
  if (!text) return { rows: 0, ok: false };
  const lines = text.split("\n");
  const HEADER = "| score | comments | position | capture_ts |";
  const headerIdx = lines.findIndex((l) => l.trim() === HEADER);
  if (headerIdx < 0) return { rows: 0, ok: false };
  const dataRows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.length === 0) break;
    if (!l.startsWith("|")) break;
    if (/^\|\s*-+\s*(\|\s*-+\s*)+\|\s*$/.test(l)) continue;
    const cols = l.split("|").slice(1, -1).map((c) => c.trim());
    if (cols.length === 4) {
      dataRows.push(cols);
    }
  }
  return { rows: dataRows.length, ok: dataRows.length === 1 };
}

/**
 * checkShowHnT48 — submit + 48h ±15분 윈도우 + 데이터 4-row 정합 read-only.
 */
export function checkShowHnT48({
  submitKst,
  now,
  capturedAt,
  dataPath,
} = {}) {
  const issues = [];
  const submit = submitKst ?? DEFAULT_SUBMIT_KST;

  if (!isKstSuffix(submit)) issues.push("submitKst must be KST");
  const submitMs = new Date(submit).getTime();
  if (!Number.isFinite(submitMs)) issues.push("invalid submitKst");

  let nowDate;
  if (now instanceof Date) {
    nowDate = now;
  } else if (typeof now === "string" && now.length > 0) {
    nowDate = new Date(now);
  } else {
    nowDate = new Date();
  }
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) issues.push("invalid now");

  const targetMs = Number.isFinite(submitMs) ? submitMs + T_PLUS_48H_MS : NaN;
  const targetKst = Number.isFinite(targetMs) ? formatKstIso(targetMs) : "INVALID";

  let capMs = nowMs;
  if (typeof capturedAt === "string" && capturedAt.length > 0) {
    const c = new Date(capturedAt).getTime();
    if (Number.isFinite(c)) capMs = c;
    else issues.push("invalid capturedAt");
  } else if (capturedAt instanceof Date) {
    const c = capturedAt.getTime();
    if (Number.isFinite(c)) capMs = c;
    else issues.push("invalid capturedAt");
  }

  let offsetMinutes = 0;
  let withinWindow = false;
  if (Number.isFinite(targetMs) && Number.isFinite(capMs)) {
    offsetMinutes = (capMs - targetMs) / ONE_MINUTE_MS;
    withinWindow = Math.abs(offsetMinutes) <= TOLERANCE_MIN;
  }

  // Data 4-row 정합 (dataPath 미제공 시 dataOk=false / skip 불가 — 명세 엣지 ②).
  let dataRows = 0;
  let dataOk = false;
  if (dataPath) {
    const txt = readOrNull(dataPath);
    if (txt !== null) {
      const r = checkShowHnRows(txt);
      dataRows = r.rows;
      dataOk = r.ok;
    }
  }

  const ok = withinWindow && dataOk && issues.length === 0;

  return {
    submitKst: submit,
    targetKst,
    withinWindow,
    offsetMinutes: Math.round(offsetMinutes * 100) / 100,
    dataRows,
    dataOk,
    ok,
    issues,
  };
}

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
  const result = checkShowHnT48({
    submitKst: args.submitKst,
    now: args.now,
    capturedAt: args.capturedAt,
    dataPath: args.dataPath,
  });
  console.log(JSON.stringify({ showHnT48: result }));
  console.log(
    `check:show-hn-t48 ok=${result.ok} target=${result.targetKst} offset=${result.offsetMinutes}min within=${result.withinWindow} data=${result.dataOk}(${result.dataRows})`,
  );
  if (!result.ok && result.issues.length > 0) {
    console.error(`issues: ${result.issues.join(" / ")}`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
