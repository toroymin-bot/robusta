#!/usr/bin/env node
/**
 * extract-insight-trigger-state.mjs
 *   - C-D72-2 ⭐ (D+2 19시 §8 슬롯, 2026-05-10) — Tori spec C-D72-2 (§7.5).
 *
 * Why: B-D72-1 / F-D72-1 / DG-D72-1 (Auto-Trigger 게이지 / 진행 바) 데이터 파이프라인 전제.
 *   read-only 트리거 상태 추출. 2 임계 AND 결합 (메시지 카운트 + 충돌 쌍 카운트).
 *   C-D71-2 extractConflictPairs 1:1 호출로 충돌 쌍 카운트 산출.
 *   외부 fetch 0건 / Dexie 미접근.
 *
 * 자율 정정 큐 (D-72-자-2 / D-72-자-3):
 *   환경 변수 INSIGHT_TRIGGER_MIN_MESSAGES (디폴트 30) / INSIGHT_TRIGGER_MIN_CONFLICTS (디폴트 2) 으로
 *   override 가능 (디폴트 보존, backward-compatible).
 *
 * 함수 시그니처 (named export, §7.5 본체 lock 정합):
 *   extractInsightTriggerState({
 *     roomId, messages, minMessages, minConflicts, conflictMaxLookback
 *   })
 *     -> { shouldTrigger, messageCount, conflictPairCount, thresholds, reasons }
 *
 *     - roomId:              string (방 식별자, 호출자 추적용)
 *     - messages:            Array<{ id, speakerId, text, ts }>
 *     - minMessages:         int, default process.env.INSIGHT_TRIGGER_MIN_MESSAGES || 30
 *     - minConflicts:        int, default process.env.INSIGHT_TRIGGER_MIN_CONFLICTS || 2
 *     - conflictMaxLookback: int, default process.env.CONFLICT_MAX_LOOKBACK || 5 (C-D71-2 정합)
 *
 * 로직 (§7.5):
 *   1) messageCount = messages.length
 *   2) conflictPairCount = extractConflictPairs(opts).pairs.length (C-D71-2 1:1 호출)
 *   3) shouldTrigger = (messageCount >= minMessages) && (conflictPairCount >= minConflicts)
 *
 * 출력 (§7.5):
 *   shouldTrigger     boolean — 양 조건 AND 충족
 *   messageCount      number  — messages.length
 *   conflictPairCount number  — extractConflictPairs 결과 pairs.length
 *   thresholds        { minMessages, minConflicts }
 *   reasons           string[] — ['empty messages' | 'message-count below' | 'conflict-count below' | 'thresholds met']
 *
 * 엣지 케이스:
 *   1) messages 빈 배열 → shouldTrigger=false, messageCount=0, conflictPairCount=0, reasons=['empty messages']
 *   2) messages 부재(비배열) → 빈 배열로 폴백
 *   3) minMessages / minConflicts 음수/비숫자 → 디폴트 사용
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { extractConflictPairs } from "./extract-conflict-pairs.mjs";

const DEFAULT_MIN_MESSAGES = 30;
const DEFAULT_MIN_CONFLICTS = 2;

function envMinMessages() {
  const v = process.env.INSIGHT_TRIGGER_MIN_MESSAGES;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return DEFAULT_MIN_MESSAGES;
}

function envMinConflicts() {
  const v = process.env.INSIGHT_TRIGGER_MIN_CONFLICTS;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_MIN_CONFLICTS;
}

export function extractInsightTriggerState(opts) {
  const o = opts || {};
  const messages = Array.isArray(o.messages) ? o.messages : [];
  const minMessages = typeof o.minMessages === "number" && Number.isFinite(o.minMessages) && o.minMessages >= 1
    ? o.minMessages
    : envMinMessages();
  const minConflicts = typeof o.minConflicts === "number" && Number.isFinite(o.minConflicts) && o.minConflicts >= 0
    ? o.minConflicts
    : envMinConflicts();

  const reasons = [];
  const messageCount = messages.length;

  if (messageCount === 0) {
    return {
      shouldTrigger: false,
      messageCount: 0,
      conflictPairCount: 0,
      thresholds: { minMessages, minConflicts },
      reasons: ["empty messages"],
    };
  }

  // C-D71-2 1:1 호출 — extractConflictPairs(opts) 결과 pairs.length 사용.
  const conflictResult = extractConflictPairs({
    roomId: o.roomId,
    messages,
    maxLookback: o.conflictMaxLookback,
  });
  const conflictPairCount = conflictResult.pairs.length;

  const messageOk = messageCount >= minMessages;
  const conflictOk = conflictPairCount >= minConflicts;

  if (!messageOk) reasons.push("message-count below");
  if (!conflictOk) reasons.push("conflict-count below");
  if (messageOk && conflictOk) reasons.push("thresholds met");

  return {
    shouldTrigger: messageOk && conflictOk,
    messageCount,
    conflictPairCount,
    thresholds: { minMessages, minConflicts },
    reasons,
  };
}

function readStdinSync() {
  try {
    const fs = require("node:fs");
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main() {
  // CLI: stdin JSON {roomId, messages, minMessages?, minConflicts?, conflictMaxLookback?} 또는 --file=path
  const fileArg = process.argv.find((x) => x.startsWith("--file="));
  let input;
  try {
    if (fileArg) {
      const path = fileArg.slice("--file=".length);
      const fs = require("node:fs");
      input = JSON.parse(fs.readFileSync(path, "utf8"));
    } else {
      const stdin = readStdinSync();
      input = stdin.length > 0 ? JSON.parse(stdin) : { messages: [] };
    }
  } catch (e) {
    console.error(`extract:insight-trigger-state ERROR: ${e.message}`);
    process.exit(1);
  }
  const result = extractInsightTriggerState(input);
  console.log(JSON.stringify(result));
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
