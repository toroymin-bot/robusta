#!/usr/bin/env node
/**
 * check-ocp-append.mjs
 *   - C-D75-2 ⭐ (D+3 07시 §4 슬롯, 2026-05-11) — Tori spec C-D75-2 (Task_2026-05-11 §3.6).
 *
 * Why: 꼬미/똘이 슬롯 종료 4단계 (verify→commit→push→OCP append) 중 OCP append 누락 검출 +
 *   누락률 % 산출 read-only 분석 (KQ_28 재발 방지 본체). 외부 fetch 0건 / 네트워크 0.
 *
 * 함수 시그니처 (named export, §3.6 본체 lock 정합):
 *   checkOcpAppend({ logPath, taskPagePrefix, appendWindowMin, since, until })
 *     → { entries, missed, missRatePercent, summary }
 *
 *     - logPath:         string, default 'analytics/ocp-append-log.jsonl'.
 *     - taskPagePrefix:  string, default 'Task_'.
 *     - appendWindowMin: number minutes, default 30.
 *     - since:           number ms epoch or null (default: now - 7d).
 *     - until:           number ms epoch (default: Date.now()).
 *
 * JSONL 스키마 (L-D75-3 8 필드 lock):
 *   { commit_sha, commit_msg, commit_iso, page_id,
 *     page_last_modified_iso, append_window_min, slot_who, slot_iso }
 *
 * 출력 정의 (§3.6):
 *   entries          AppendEntry[]  — 분석 윈도우 내 jsonl 엔트리
 *   missed           MissedAppend[] — 누락 후보 리스트
 *   missRatePercent  number | null  — missed.length / entries.length × 100 (1자리 round)
 *   summary          string         — 사람이 읽는 1줄 요약
 *
 * 엣지 케이스 (§3.6):
 *   1) logPath 부재 또는 빈 파일 → entries=[], missed=[], missRatePercent=null
 *   2) since=null              → 직전 7일 default
 *   3) 미래 슬롯 (slotIso > until)  → 분석 제외
 *   4) 동일 슬롯 다중 heartbeat → 첫 entry만 count
 *   5) DST 0 — KST 고정 +09:00, TZ 분기 0
 *
 * --validate-schema 모드 (L-D75-3 게이트):
 *   stdin (또는 logPath) jsonl 각 라인 검증, 8 필드 정확 lock. Missing/extra field 검출.
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_LOG_PATH = "analytics/ocp-append-log.jsonl";
const DEFAULT_APPEND_WINDOW_MIN = 30;
const DEFAULT_TASK_PAGE_PREFIX = "Task_";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MIN_MS = 60 * 1000;

// L-D75-3 8 필드 lock. 추가/삭제 0.
const REQUIRED_FIELDS = [
  "commit_sha",
  "commit_msg",
  "commit_iso",
  "page_id",
  "page_last_modified_iso",
  "append_window_min",
  "slot_who",
  "slot_iso",
];

function readJsonlLines(path) {
  if (!existsSync(path)) return { lines: [], missing: true };
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { lines: [], missing: true };
  }
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return { lines, missing: false };
}

function parseEntry(line, lineNo) {
  try {
    const obj = JSON.parse(line);
    return { ok: true, obj, lineNo };
  } catch (e) {
    return { ok: false, error: e.message, lineNo };
  }
}

function validateSchema(obj) {
  const errors = [];
  const keys = Object.keys(obj);
  for (const f of REQUIRED_FIELDS) {
    if (!(f in obj)) errors.push(`missing field: ${f}`);
  }
  for (const k of keys) {
    if (!REQUIRED_FIELDS.includes(k)) errors.push(`extra field: ${k}`);
  }
  return errors;
}

export async function checkOcpAppend(opts) {
  const o = opts || {};
  const logPath = typeof o.logPath === "string" && o.logPath.length > 0
    ? o.logPath
    : DEFAULT_LOG_PATH;
  const appendWindowMin =
    typeof o.appendWindowMin === "number" && Number.isFinite(o.appendWindowMin) && o.appendWindowMin > 0
      ? o.appendWindowMin
      : DEFAULT_APPEND_WINDOW_MIN;
  const until = typeof o.until === "number" && Number.isFinite(o.until)
    ? o.until
    : Date.now();
  const since = typeof o.since === "number" && Number.isFinite(o.since)
    ? o.since
    : until - SEVEN_DAYS_MS;

  const { lines, missing } = readJsonlLines(resolve(logPath));
  if (missing || lines.length === 0) {
    return {
      entries: [],
      missed: [],
      missRatePercent: null,
      summary: missing
        ? `ocp-append-log: ${logPath} not found — empty analysis`
        : `ocp-append-log: ${logPath} empty — empty analysis`,
    };
  }

  const allEntries = [];
  for (let i = 0; i < lines.length; i++) {
    const p = parseEntry(lines[i], i + 1);
    if (p.ok) allEntries.push(p.obj);
  }

  // 윈도우 + 미래 슬롯 필터 + 동일 슬롯 첫 entry만.
  const seenSlot = new Set();
  const entries = [];
  for (const e of allEntries) {
    const slotMs = Date.parse(e.slot_iso);
    if (!Number.isFinite(slotMs)) continue;
    if (slotMs < since || slotMs > until) continue;
    const slotKey = `${e.slot_who}|${e.slot_iso}`;
    if (seenSlot.has(slotKey)) continue;
    seenSlot.add(slotKey);
    entries.push(e);
  }

  const missed = [];
  for (const e of entries) {
    const commitMs = Date.parse(e.commit_iso);
    const pageMs = Date.parse(e.page_last_modified_iso);
    const win = (
      typeof e.append_window_min === "number" && e.append_window_min > 0
        ? e.append_window_min
        : appendWindowMin
    ) * ONE_MIN_MS;
    if (!Number.isFinite(commitMs)) continue;
    const lateOrMissing =
      !Number.isFinite(pageMs) || pageMs - commitMs > win;
    if (lateOrMissing) {
      missed.push({
        slot_who: e.slot_who,
        slot_iso: e.slot_iso,
        commit_sha: e.commit_sha,
        commit_iso: e.commit_iso,
        last_page_modified: Number.isFinite(pageMs) ? e.page_last_modified_iso : null,
      });
    }
  }

  const missRatePercent = entries.length === 0
    ? null
    : Math.round((missed.length / entries.length) * 1000) / 10;

  const summary = `ocp-append-log: entries=${entries.length} missed=${missed.length} missRatePercent=${missRatePercent}`;

  return { entries, missed, missRatePercent, summary };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  const flag = (k) => argv.includes(`--${k}`);
  return {
    logPath: get("log-path"),
    appendWindowMin: get("append-window-min"),
    since: get("since"),
    until: get("until"),
    validateSchema: flag("validate-schema"),
  };
}

async function mainValidateSchema(logPath) {
  const { lines, missing } = readJsonlLines(resolve(logPath));
  if (missing) {
    console.log(`validate-schema: ${logPath} not found — 0 lines, PASS (empty file)`);
    process.exit(0);
  }
  if (lines.length === 0) {
    console.log(`validate-schema: ${logPath} empty — PASS`);
    process.exit(0);
  }
  let pass = 0;
  let fail = 0;
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const p = parseEntry(lines[i], i + 1);
    if (!p.ok) {
      fail++;
      errors.push(`line ${p.lineNo}: parse error ${p.error}`);
      continue;
    }
    const errs = validateSchema(p.obj);
    if (errs.length === 0) pass++;
    else {
      fail++;
      errors.push(`line ${p.lineNo}: ${errs.join(", ")}`);
    }
  }
  console.log(`validate-schema: ${pass}/${pass + fail} PASS (8 fields lock: ${REQUIRED_FIELDS.join(",")})`);
  if (fail > 0) {
    for (const e of errors.slice(0, 10)) console.error(`  ✗ ${e}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const logPath = args.logPath ?? DEFAULT_LOG_PATH;

  if (args.validateSchema) {
    await mainValidateSchema(logPath);
    return;
  }

  try {
    const opts = { logPath };
    if (args.appendWindowMin !== null) opts.appendWindowMin = parseInt(args.appendWindowMin, 10);
    if (args.since !== null) opts.since = Date.parse(args.since);
    if (args.until !== null) opts.until = Date.parse(args.until);
    const r = await checkOcpAppend(opts);
    console.log(JSON.stringify({ ocpAppend: r }));
    console.log(`check:ocp-append ${r.summary}`);
    // read-only 분석 — 누락 있어도 fail 아님 (exit 0).
    process.exit(0);
  } catch (e) {
    console.error(`check:ocp-append ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
