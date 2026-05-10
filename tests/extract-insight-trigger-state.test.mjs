#!/usr/bin/env node
/**
 * tests/extract-insight-trigger-state.test.mjs
 *   - C-D72-2 ⭐ 테스트 6 케이스 (§7.5 명세 정합).
 *
 * 6 케이스 (똘이 §7.5 명시):
 *   1) 빈 배열 → shouldTrigger=false reasons=['empty messages']
 *   2) 30 메시지 + 2 충돌 정확 일치 → shouldTrigger=true
 *   3) 29 메시지 + 5 충돌 → shouldTrigger=false (메시지 미달)
 *   4) 50 메시지 + 1 충돌 → shouldTrigger=false (충돌 미달)
 *   5) 30 메시지 + 2 충돌 + minMessages=50 override → shouldTrigger=false
 *   6) C-D71-2 호출 정합성 (extractConflictPairs 결과와 일치)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { extractInsightTriggerState } from "../scripts/extract-insight-trigger-state.mjs";
import { extractConflictPairs } from "../scripts/extract-conflict-pairs.mjs";

let passed = 0;
let failed = 0;

function assertCase(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name} — ${e.message}`);
  }
}

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

// 메시지 합성 헬퍼.
function buildMessages({ count, conflictCount }) {
  const msgs = [];
  for (let i = 0; i < count; i++) {
    msgs.push({
      id: `m${i + 1}`,
      speakerId: i % 2 === 0 ? "ai-A" : "ai-B",
      text: `메시지 ${i + 1}.`,
      ts: `t${i + 1}`,
    });
  }
  // 충돌 쌍 N개 — 마지막 N 메시지의 짝수 인덱스에 대립 표현 삽입.
  // 메시지가 충분치 않으면 최대한 만들어준다.
  let inserted = 0;
  for (let j = msgs.length - 1; j >= 1 && inserted < conflictCount; j -= 2) {
    msgs[j].text = "하지만 그 결정은 위험하다.";
    inserted++;
  }
  return msgs;
}

console.log("extract-insight-trigger-state — 6 케이스 테스트");

// case 1: 빈 배열 → shouldTrigger=false
assertCase("case1: 빈 배열 → shouldTrigger=false reasons에 empty messages", () => {
  const r = extractInsightTriggerState({ roomId: "r1", messages: [] });
  eq(r.shouldTrigger, false, "shouldTrigger");
  eq(r.messageCount, 0, "messageCount");
  eq(r.conflictPairCount, 0, "conflictPairCount");
  if (!r.reasons.includes("empty messages")) {
    throw new Error(`reasons missing 'empty messages': ${JSON.stringify(r.reasons)}`);
  }
});

// case 2: 30 메시지 + 2 충돌 → shouldTrigger=true
assertCase("case2: 30 메시지 + 2 충돌 정확 일치 → shouldTrigger=true", () => {
  const messages = buildMessages({ count: 30, conflictCount: 2 });
  const r = extractInsightTriggerState({ roomId: "r2", messages });
  eq(r.messageCount, 30, "messageCount");
  if (r.conflictPairCount < 2) {
    throw new Error(`conflictPairCount: expected >=2, got ${r.conflictPairCount}`);
  }
  eq(r.shouldTrigger, true, "shouldTrigger");
});

// case 3: 29 메시지 + 5 충돌 → shouldTrigger=false (메시지 미달)
assertCase("case3: 29 메시지 + 5 충돌 → shouldTrigger=false (메시지 미달)", () => {
  const messages = buildMessages({ count: 29, conflictCount: 5 });
  const r = extractInsightTriggerState({ roomId: "r3", messages });
  eq(r.messageCount, 29, "messageCount");
  eq(r.shouldTrigger, false, "shouldTrigger");
  if (!r.reasons.includes("message-count below")) {
    throw new Error(`reasons missing 'message-count below': ${JSON.stringify(r.reasons)}`);
  }
});

// case 4: 50 메시지 + 1 충돌 → shouldTrigger=false (충돌 미달)
assertCase("case4: 50 메시지 + 1 충돌 → shouldTrigger=false (충돌 미달)", () => {
  const messages = buildMessages({ count: 50, conflictCount: 1 });
  const r = extractInsightTriggerState({ roomId: "r4", messages });
  eq(r.messageCount, 50, "messageCount");
  eq(r.shouldTrigger, false, "shouldTrigger");
  if (!r.reasons.includes("conflict-count below")) {
    throw new Error(`reasons missing 'conflict-count below': ${JSON.stringify(r.reasons)}`);
  }
});

// case 5: 30 메시지 + 2 충돌 + minMessages=50 → shouldTrigger=false
assertCase("case5: 30 메시지 + 2 충돌 + minMessages=50 override → shouldTrigger=false", () => {
  const messages = buildMessages({ count: 30, conflictCount: 2 });
  const r = extractInsightTriggerState({
    roomId: "r5",
    messages,
    minMessages: 50,
  });
  eq(r.messageCount, 30, "messageCount");
  eq(r.thresholds.minMessages, 50, "thresholds.minMessages");
  eq(r.shouldTrigger, false, "shouldTrigger");
});

// case 6: C-D71-2 호출 정합성 — extractConflictPairs 결과와 일치
assertCase("case6: C-D71-2 호출 정합성 — extractConflictPairs 결과와 일치", () => {
  const messages = buildMessages({ count: 35, conflictCount: 3 });
  const conflictResult = extractConflictPairs({ roomId: "r6", messages });
  const r = extractInsightTriggerState({ roomId: "r6", messages });
  eq(r.conflictPairCount, conflictResult.pairs.length, "conflictPairCount == pairs.length");
});

console.log("");
console.log(
  `extract-insight-trigger-state tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
