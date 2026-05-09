#!/usr/bin/env node
/**
 * analyze-byok-funnel-weekly.mjs
 *   - C-D67-2 (D+1 15시 §8 슬롯, 2026-05-09) — Tori spec C-D67-2 (§20.5.2).
 *
 * Why: BYOK 7일 누적 펀넬 분석 (1주차 측정 D+6 5/14 등).
 *   pings 배열 또는 NDJSON 파일 → week 라벨 + 카운트 + conversion + 일별 7일 breakdown JSON.
 *   외부 fetch 0건 / Dexie 미접근 / 정적 read-only.
 *
 * 자율 정정 큐 (D-67-자-2):
 *   환경 변수 ANALYTICS_PINGS_PATH 로 NDJSON 파일 경로 override 가능 (D-66-자-2 정합).
 *
 * 함수 시그니처 (named export, §20.5.2 본체 lock 정합):
 *   analyzeByokFunnelWeekly(
 *     pings: Array<{ ts: string, kind: 'visit'|'attempt'|'success' }>,
 *     opts?: { tzOffset?: string, weekEndIso?: string }
 *   ) -> {
 *     week: string,
 *     visit: number,
 *     attempt: number,
 *     success: number,
 *     conversion: number,
 *     dailyBreakdown: Array<{ day: string, visit: number, attempt: number, success: number }>,
 *   }
 *
 * 입출력 정의:
 *   pings 인자 미지정 시 env ANALYTICS_PINGS_PATH NDJSON 파일 로드 (한 줄 1 ping JSON).
 *   opts.tzOffset    기본 '+09:00'.
 *   opts.weekEndIso  기본 현재 시각 (ISO+09:00). 7일 윈도우 종료 시점.
 *   week             ISO 주차 라벨 'YYYY-Www' (weekEndIso 기준).
 *   conversion       success/visit × 100 (소수점 2자리, visit=0 시 0).
 *   dailyBreakdown   weekEnd-6d ∼ weekEnd 7일, 각 day='YYYY-MM-DD'.
 *
 * 엣지 케이스:
 *   1) pings 빈 배열 + 파일 부재 → 모두 0, dailyBreakdown 7일 0 채움.
 *   2) 잘못된 kind → 무시 (집계 제외).
 *   3) 7일 윈도우 외 ts → 무시.
 *   4) ts 비-ISO/+09:00 → 무시.
 *   5) ts 파싱 실패 → 무시.
 *
 * 사용 (CLI):
 *   $ node scripts/analyze-byok-funnel-weekly.mjs \
 *       --pings-path=data/analytics_pings.jsonl \
 *       --week-end=2026-05-14T22:00:00+09:00
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VALID_KINDS = new Set(["visit", "attempt", "success"]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TZ_OFFSET = "+09:00";

function envPingsPath() {
  const v = process.env.ANALYTICS_PINGS_PATH;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function readPingsFile(p) {
  try {
    const text = readFileSync(resolve(process.cwd(), p), "utf8");
    const out = [];
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line.length === 0) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        console.error("analyze-byok-funnel-weekly: malformed JSON line skipped");
      }
    }
    return out;
  } catch {
    return [];
  }
}

function isIsoWithOffset(s) {
  return typeof s === "string" && /[+-]\d{2}:\d{2}$/.test(s);
}

function dayLabelKst(ms) {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

// ISO week label: YYYY-Www (1-53). Reference: ISO 8601 — Thursday in target week determines year.
function isoWeekLabel(ms) {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  // Convert to UTC date object representing same KST date.
  const utcD = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utcD.getUTCDay() || 7;
  utcD.setUTCDate(utcD.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcD.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcD.getTime() - yearStart.getTime()) / ONE_DAY_MS + 1) / 7);
  return `${utcD.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function analyzeByokFunnelWeekly(pings, opts) {
  const o = opts || {};
  const tzOffset = o.tzOffset ?? DEFAULT_TZ_OFFSET;
  const weekEndIso = o.weekEndIso ?? new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  let weekEndMs = new Date(weekEndIso).getTime();
  if (!Number.isFinite(weekEndMs)) {
    weekEndMs = Date.now();
  }
  const weekStartMs = weekEndMs - 7 * ONE_DAY_MS;

  let resolvedPings = pings;
  if (!Array.isArray(resolvedPings)) {
    const p = envPingsPath();
    resolvedPings = p ? readPingsFile(p) : [];
  }

  // 7-day daily skeleton (UTC-anchored day boundaries via KST label).
  const dailyMap = new Map();
  for (let i = 6; i >= 0; i--) {
    const dayMs = weekEndMs - i * ONE_DAY_MS;
    const label = dayLabelKst(dayMs);
    dailyMap.set(label, { day: label, visit: 0, attempt: 0, success: 0 });
  }

  let visit = 0;
  let attempt = 0;
  let success = 0;

  for (const ping of resolvedPings) {
    if (!ping || typeof ping !== "object") continue;
    const { ts, kind } = ping;
    if (!VALID_KINDS.has(kind)) continue;
    if (!isIsoWithOffset(ts)) continue;
    const tsMs = new Date(ts).getTime();
    if (!Number.isFinite(tsMs)) continue;
    if (tsMs < weekStartMs || tsMs > weekEndMs) continue;
    const label = dayLabelKst(tsMs);
    const bucket = dailyMap.get(label);
    if (!bucket) continue;
    if (kind === "visit") {
      bucket.visit++;
      visit++;
    } else if (kind === "attempt") {
      bucket.attempt++;
      attempt++;
    } else if (kind === "success") {
      bucket.success++;
      success++;
    }
  }

  const conversionRaw = visit > 0 ? (success / visit) * 100 : 0;
  const conversion = Math.round(conversionRaw * 100) / 100;
  const week = isoWeekLabel(weekEndMs);
  // Touch tzOffset for forward-compat (currently +09:00 only).
  if (typeof tzOffset !== "string") {
    throw new Error("tzOffset must be string");
  }
  const dailyBreakdown = Array.from(dailyMap.values());

  return { week, visit, attempt, success, conversion, dailyBreakdown };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    pingsPath: get("pings-path"),
    weekEndIso: get("week-end"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    let pings;
    if (args.pingsPath) {
      pings = readPingsFile(args.pingsPath);
    }
    const result = analyzeByokFunnelWeekly(pings, {
      weekEndIso: args.weekEndIso ?? undefined,
    });
    console.log(JSON.stringify({ byokFunnelWeekly: result }));
    console.log(
      `analyze:byok-weekly week=${result.week} visit=${result.visit} attempt=${result.attempt} success=${result.success} conversion=${result.conversion}%`,
    );
    process.exit(0);
  } catch (e) {
    console.error(`analyze:byok-weekly ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
