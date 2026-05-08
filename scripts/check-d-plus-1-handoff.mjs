#!/usr/bin/env node
/**
 * check-d-plus-1-handoff.mjs
 *   - C-D64-1 (D+1 03시 §2 슬롯, 2026-05-09) — Tori spec C-D64-1 (B-D64-5 본체 read-only).
 *
 * Why: D+1 09:00 KST handoff 슬롯 4건 의무를 정형 검증.
 *   1) 3줄 보고 (report-path 의 non-blank 라인 정확히 3)
 *   2) Roy shownhScore 입력 — KQ_NN 응답 docs 매칭
 *   3) KQ_24 / KQ_25 응답 docs 매칭
 *   4) Show HN T+35h 데이터 4-row 정합 (header + 1 row × 4 col)
 *
 * 함수 시그니처 (export):
 *   checkDPlus1Handoff({ slotKst, reportPath, kqList, showHnDataPath, now? })
 *     -> { slotKst, withinWindow, offsetMinutes, reportLines, reportOk,
 *          kqResolved, kqAllResolved, showHnRows, showHnOk, ok, issues }
 *
 * 입력 가드:
 *   - slotKst Invalid Date → issues=['invalid slotKst'] / ok=false
 *   - slotKst 비-KST(+09:00 미포함) → issues=['slotKst must be KST']
 *   - reportPath 파일 부재 → issues=['report-path missing'] / reportOk=false
 *   - kq-list 빈 → kqAllResolved=true (skip)
 *   - showHnDataPath 헤더/행 부정합 → showHnOk=false
 *   - now가 09:00±15분 외 → withinWindow=false / ok=false
 *
 * 사용 (CLI):
 *   $ node scripts/check-d-plus-1-handoff.mjs \
 *       --slot-kst=2026-05-09T09:00:00+09:00 \
 *       --report-path=docs/D-PLUS-1-HANDOFF-2026-05-09.md \
 *       --kq-list=24,25 \
 *       --show-hn-data-path=docs/SHOW-HN-T35-2026-05-09.md
 *
 * 외부 dev-deps +0 (node 표준만). Dexie 미접근. fetch 0건.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ONE_MINUTE_MS = 60 * 1000;
const TOLERANCE_MIN = 15;

// D+1 09:00 KST handoff slot 정형 (verify-d64 G5 1:1 매칭).
export const D_PLUS_1_HANDOFF_KST = "2026-05-09T09:00:00+09:00";

// release-freeze-cutoff.ts SUBMIT_DEADLINE_KST 미러 인용 (자율 정정 권한 D-58-자-2 락 정합).
//   본 모듈은 슬롯 시점만 검증 — submit 시점 산식은 check-show-hn-t24/t48 에서 별도.

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    slotKst: get("slot-kst") ?? D_PLUS_1_HANDOFF_KST,
    reportPath: get("report-path") ?? "",
    kqList: get("kq-list") ?? "",
    showHnDataPath: get("show-hn-data-path") ?? "",
    kqResolveDir: get("kq-resolve-dir") ?? "docs",
    now: get("now"),
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
 * countNonBlankLines — non-blank 라인 수.
 *   blank = 공백/탭만 있거나 길이 0. 매칭: ^.+$ (trim 후 length>0).
 */
function countNonBlankLines(text) {
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0).length;
}

/**
 * resolveKqResolved — KQ 번호별 응답 매칭.
 *   reportPath 또는 docs/KQ_${n}-RESPONSE-${YYYYMMDD}.md 파일에
 *   `## KQ_${n}` 헤딩 1건 + 응답 본문 ≥1 라인 매칭.
 */
function resolveKqResolved(kqNumbers, reportPath, slotKst, kqResolveDir) {
  const reportText = reportPath ? readOrNull(reportPath) : null;
  // YYYYMMDD from slotKst (KST). slotKst 는 KST 표현이므로 prefix 사용.
  const yyyymmdd = (slotKst || "").slice(0, 10).replace(/-/g, "");
  const baseDir = kqResolveDir || "docs";
  return kqNumbers.map((n) => {
    const heading = `## KQ_${n}`;
    const tryMatch = (text) => {
      if (!text) return false;
      const idx = text.indexOf(heading);
      if (idx < 0) return false;
      // 헤딩 이후 1라인이라도 non-blank 본문 존재 의무.
      const tail = text.slice(idx + heading.length);
      const lines = tail.split("\n").slice(1); // skip heading line tail
      return lines.some((l) => l.trim().length > 0);
    };
    if (tryMatch(reportText)) return { kq: n, resolved: true };
    const altPath = `${baseDir}/KQ_${n}-RESPONSE-${yyyymmdd}.md`;
    const altText = readOrNull(altPath);
    if (tryMatch(altText)) return { kq: n, resolved: true };
    return { kq: n, resolved: false };
  });
}

/**
 * checkShowHnRows — Show HN 데이터 헤더 1줄 + 정확히 1 데이터 행 (4 컬럼).
 *   헤더 정형: `| score | comments | position | capture_ts |`
 *   데이터 행 정형: `| ... | ... | ... | ... |` (4 컬럼).
 */
function checkShowHnRows(text) {
  if (!text) return { rows: 0, ok: false };
  const lines = text.split("\n");
  const HEADER = "| score | comments | position | capture_ts |";
  const headerIdx = lines.findIndex((l) => l.trim() === HEADER);
  if (headerIdx < 0) return { rows: 0, ok: false };
  // 헤더 다음 라인부터 표 끝(빈 줄 또는 비-pipe 라인)까지 스캔.
  //   table separator (e.g. `| --- | --- | --- | --- |`) 1건은 허용 (rows 카운트 제외).
  const dataRows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.length === 0) break;
    if (!l.startsWith("|")) break;
    if (/^\|\s*-+\s*(\|\s*-+\s*)+\|\s*$/.test(l)) continue; // separator skip
    const cols = l.split("|").slice(1, -1).map((c) => c.trim());
    if (cols.length === 4) {
      dataRows.push(cols);
    }
  }
  return { rows: dataRows.length, ok: dataRows.length === 1 };
}

/**
 * checkDPlus1Handoff — main check function.
 */
export function checkDPlus1Handoff({
  slotKst,
  reportPath,
  kqList,
  showHnDataPath,
  kqResolveDir,
  now,
} = {}) {
  const issues = [];
  const slot = slotKst ?? D_PLUS_1_HANDOFF_KST;

  if (!isKstSuffix(slot)) issues.push("slotKst must be KST");
  const slotMs = new Date(slot).getTime();
  if (!Number.isFinite(slotMs)) issues.push("invalid slotKst");

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

  let offsetMinutes = 0;
  let withinWindow = false;
  if (Number.isFinite(slotMs) && Number.isFinite(nowMs)) {
    offsetMinutes = (nowMs - slotMs) / ONE_MINUTE_MS;
    withinWindow = Math.abs(offsetMinutes) <= TOLERANCE_MIN;
  }

  // Report 3줄 검증.
  let reportLines = 0;
  let reportOk = false;
  if (!reportPath) {
    issues.push("report-path missing");
  } else {
    const txt = readOrNull(reportPath);
    if (txt === null) {
      issues.push("report-path missing");
    } else {
      reportLines = countNonBlankLines(txt);
      reportOk = reportLines === 3;
    }
  }

  // KQ list 파싱.
  const kqNumbers = (kqList || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));
  const kqResolved = kqNumbers.length === 0
    ? []
    : resolveKqResolved(kqNumbers, reportPath, slot, kqResolveDir);
  const kqAllResolved = kqResolved.every((x) => x.resolved);

  // Show HN T+35h 데이터.
  let showHnRows = 0;
  let showHnOk = false;
  if (!showHnDataPath) {
    showHnOk = false;
  } else {
    const txt = readOrNull(showHnDataPath);
    if (txt === null) {
      showHnOk = false;
    } else {
      const r = checkShowHnRows(txt);
      showHnRows = r.rows;
      showHnOk = r.ok;
    }
  }

  const ok =
    withinWindow &&
    reportOk &&
    kqAllResolved &&
    showHnOk &&
    issues.length === 0;

  return {
    slotKst: slot,
    withinWindow,
    offsetMinutes: Math.round(offsetMinutes * 100) / 100,
    reportLines,
    reportOk,
    kqResolved,
    kqAllResolved,
    showHnRows,
    showHnOk,
    ok,
    issues,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkDPlus1Handoff({
    slotKst: args.slotKst,
    reportPath: args.reportPath,
    kqList: args.kqList,
    showHnDataPath: args.showHnDataPath,
    kqResolveDir: args.kqResolveDir,
    now: args.now,
  });
  console.log(JSON.stringify({ dPlus1Handoff: result }));
  console.log(
    `check:d-plus-1-handoff ok=${result.ok} slot=${result.slotKst} offset=${result.offsetMinutes}min within=${result.withinWindow} report=${result.reportOk}(${result.reportLines}) kq=${result.kqAllResolved} showHn=${result.showHnOk}(${result.showHnRows})`,
  );
  if (!result.ok && result.issues.length > 0) {
    console.error(`issues: ${result.issues.join(" / ")}`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
