#!/usr/bin/env node
/**
 * merge-insight-receipt.mjs
 *   - C-D73-2 ⭐ (D+2 23시 §6 슬롯, 2026-05-10) — Tori spec C-D73-2 (§8.5).
 *
 * Why: B-D73-1 ⭐ Insight Receipt v2 데이터 파이프라인 종착점.
 *   명시 캡처(F-D70-2 user-pin) ∪ 자동 후보(C-D70-2 extractInsightCandidates) → 단일 Receipt.
 *   트리거 상태(C-D72-2 extractInsightTriggerState, 내부 C-D71-2 호출) 정합 echo.
 *   외부 fetch 0건 / Dexie 미접근.
 *
 * 자율 정정 큐 (D-73-자-2):
 *   환경 변수 INSIGHT_MIN_SCORE / CONFLICT_MAX_LOOKBACK / INSIGHT_TRIGGER_MIN_MESSAGES /
 *   INSIGHT_TRIGGER_MIN_CONFLICTS — 디폴트 변경 없이 override만 (C-D70-2/C-D71-2/C-D72-2 정합 사슬 사수).
 *
 * 함수 시그니처 (named export, §8.5 본체 lock 정합):
 *   mergeInsightReceipt({ roomId, messages, userPins, minScore, maxLookback, minMessages, minConflicts })
 *     -> { receipt: { roomId, items, triggerState, mergedAt }, stats: { pinCount, autoCount, mergedCount, dedupCount } }
 *
 *     - roomId:       string (방 식별자)
 *     - messages:     Array<{ id, speakerId, text, ts }>
 *     - userPins:     Array<{ messageId, ts }> | undefined  — F-D70-2 명시 캡처
 *     - minScore:     int, default process.env.INSIGHT_MIN_SCORE || 3 (C-D70-2 정합)
 *     - maxLookback:  int, default process.env.CONFLICT_MAX_LOOKBACK || 5 (C-D71-2 정합)
 *     - minMessages:  int, default process.env.INSIGHT_TRIGGER_MIN_MESSAGES || 30 (C-D72-2 정합)
 *     - minConflicts: int, default process.env.INSIGHT_TRIGGER_MIN_CONFLICTS || 2 (C-D72-2 정합)
 *
 * 로직 (§8.5):
 *   1) autoResult = extractInsightCandidates({ roomId, messages, minScore })
 *      → autoItems = autoResult.candidates.map(c => ({ messageId: c.id, source: 'auto', score: c.score, reasons: c.reasons, speakerId: c.speakerId }))
 *   2) triggerState = extractInsightTriggerState({ roomId, messages, minMessages, minConflicts, conflictMaxLookback: maxLookback })
 *      → { shouldTrigger, messageCount, conflictPairCount }
 *   3) pinItems = (userPins || [])
 *        .map(pin => message lookup by messageId)
 *        .filter(found)
 *        .map(msg => ({ messageId: msg.id, source: 'pin', score: 5, reasons: ['user-pin'], speakerId: msg.speakerId }))
 *   4) items = pinItems ∪ autoItems (messageId 기준 dedup, pin 우선 — pin score=5 사수)
 *   5) mergedAt = new Date().toISOString()
 *
 * 출력 (§8.5):
 *   receipt.roomId        roomId
 *   receipt.items         Array<{ messageId, source: 'pin'|'auto', score, reasons, speakerId }>
 *   receipt.triggerState  { shouldTrigger, messageCount, conflictPairCount }
 *   receipt.mergedAt      ISO 8601 string
 *   stats.pinCount        pinItems.length (lookup 성공한 pin 만)
 *   stats.autoCount       autoItems.length
 *   stats.mergedCount     items.length (dedup 후)
 *   stats.dedupCount      pinCount + autoCount - mergedCount
 *
 * 엣지 케이스:
 *   1) messages 빈 배열 → items=[], stats 모두 0, triggerState.messageCount=0
 *   2) userPins 부재     → pinCount=0 (autoCount만)
 *   3) userPins messageId lookup 실패 → 해당 pin 무시 (pinCount 미카운트)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { extractInsightCandidates } from "./extract-insight-candidates.mjs";
import { extractInsightTriggerState } from "./extract-insight-trigger-state.mjs";

function isString(x) {
  return typeof x === "string" && x.length > 0;
}

export function mergeInsightReceipt(opts) {
  const o = opts || {};
  const roomId = isString(o.roomId) ? o.roomId : "";
  const messages = Array.isArray(o.messages) ? o.messages : [];
  const userPins = Array.isArray(o.userPins) ? o.userPins : [];

  // 1) 자동 후보 — C-D70-2 1:1 호출.
  const autoResult = extractInsightCandidates({
    roomId,
    messages,
    minScore: o.minScore,
  });
  const autoItems = autoResult.candidates.map((c) => ({
    messageId: c.id,
    source: "auto",
    score: c.score,
    reasons: c.reasons,
    speakerId: c.speakerId,
  }));

  // 2) 트리거 상태 — C-D72-2 1:1 호출 (내부 C-D71-2 호출 정합).
  const ts = extractInsightTriggerState({
    roomId,
    messages,
    minMessages: o.minMessages,
    minConflicts: o.minConflicts,
    conflictMaxLookback: o.maxLookback,
  });
  const triggerState = {
    shouldTrigger: ts.shouldTrigger,
    messageCount: ts.messageCount,
    conflictPairCount: ts.conflictPairCount,
  };

  // 3) 사용자 핀 — F-D70-2 명시 캡처. messageId 기준 lookup.
  const messageById = new Map();
  for (const m of messages) {
    if (m && isString(m.id)) {
      messageById.set(m.id, m);
    }
  }
  const pinItems = [];
  for (const pin of userPins) {
    if (!pin || !isString(pin.messageId)) continue;
    const msg = messageById.get(pin.messageId);
    if (!msg || !isString(msg.speakerId)) continue;
    pinItems.push({
      messageId: msg.id,
      source: "pin",
      score: 5, // 사용자 명시 신성 — score=5 사수.
      reasons: ["user-pin"],
      speakerId: msg.speakerId,
    });
  }

  // 4) dedup messageId 기준, pin 우선.
  const merged = new Map();
  for (const item of pinItems) {
    merged.set(item.messageId, item);
  }
  for (const item of autoItems) {
    if (!merged.has(item.messageId)) {
      merged.set(item.messageId, item);
    }
    // pin 우선 사수 — 동일 messageId 자동 후보는 무시.
  }
  const items = Array.from(merged.values());

  const pinCount = pinItems.length;
  const autoCount = autoItems.length;
  const mergedCount = items.length;
  const dedupCount = pinCount + autoCount - mergedCount;

  return {
    receipt: {
      roomId,
      items,
      triggerState,
      mergedAt: new Date().toISOString(),
    },
    stats: {
      pinCount,
      autoCount,
      mergedCount,
      dedupCount,
    },
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
  // CLI: stdin JSON {roomId, messages, userPins?, ...} 또는 --file=path
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
    console.error(`merge:insight-receipt ERROR: ${e.message}`);
    process.exit(1);
  }
  const result = mergeInsightReceipt(input);
  console.log(JSON.stringify(result));
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
