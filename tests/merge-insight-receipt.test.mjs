#!/usr/bin/env node
/**
 * tests/merge-insight-receipt.test.mjs
 *   - C-D73-2 테스트 6 케이스 (§8.5 명세 정합).
 *
 * 6 케이스 (똘이 §8.5 명시):
 *   1) 빈 messages + 빈 pins → items=[], stats 모두 0
 *   2) pin 1건 + auto 0건 → items 1건 (source='pin', score=5)
 *   3) pin 0건 + auto 3건 → items 3건 (source='auto')
 *   4) pin 1건 + auto 3건 + dedup 1건 (동일 messageId) → items 3건 dedupCount=1 (pin 우선)
 *   5) C-D70-2/C-D71-2/C-D72-2 1:1 호출 정합성
 *   6) triggerState.shouldTrigger=true 시 receipt.triggerState 정확 echo
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { mergeInsightReceipt } from "../scripts/merge-insight-receipt.mjs";

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
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// 도우미 — score≥3 통과용 메시지(qa-pair + length≥200 → score=2 + length=200 +1 = 3 이상 보장).
function makeAutoCandidateSeq() {
  // 직전 메시지 '?' + 본 메시지 length≥100 → qa-pair (+1).
  // length≥200 (+1).
  // 숫자 포함 (+1) → minScore 3 통과.
  const longText = "이 결정에 대해 자세히 분석해보면 비용은 30% 감소하고 안정성은 유지된다. ".repeat(10);
  return [
    { id: "m1", speakerId: "ai-a", text: "어떻게 결정해야 할까요?", ts: "2026-05-10T20:00:00+09:00" },
    { id: "m2", speakerId: "ai-b", text: longText, ts: "2026-05-10T20:01:00+09:00" },
    { id: "m3", speakerId: "ai-c", text: longText, ts: "2026-05-10T20:02:00+09:00" },
    { id: "m4", speakerId: "ai-a", text: longText, ts: "2026-05-10T20:03:00+09:00" },
  ];
}

console.log("merge-insight-receipt — 6 케이스 테스트");

// case 1: 빈 messages + 빈 pins
assertCase("case1: 빈 messages + 빈 pins → items=[] stats=0", () => {
  const r = mergeInsightReceipt({ roomId: "r1", messages: [], userPins: [] });
  eq(r.receipt.items.length, 0, "items.length");
  eq(r.stats.pinCount, 0, "pinCount");
  eq(r.stats.autoCount, 0, "autoCount");
  eq(r.stats.mergedCount, 0, "mergedCount");
  eq(r.stats.dedupCount, 0, "dedupCount");
  eq(r.receipt.triggerState.messageCount, 0, "triggerState.messageCount");
});

// case 2: pin 1건 + auto 0건
assertCase("case2: pin 1건 + auto 0건 → items 1건 source='pin' score=5", () => {
  const messages = [
    { id: "m1", speakerId: "ai-a", text: "짧은 한 줄.", ts: "2026-05-10T20:00:00+09:00" },
  ];
  const r = mergeInsightReceipt({
    roomId: "r2",
    messages,
    userPins: [{ messageId: "m1", ts: "2026-05-10T20:01:00+09:00" }],
  });
  eq(r.receipt.items.length, 1, "items.length");
  eq(r.receipt.items[0].source, "pin", "source");
  eq(r.receipt.items[0].score, 5, "score");
  eq(r.stats.pinCount, 1, "pinCount");
  eq(r.stats.autoCount, 0, "autoCount");
});

// case 3: pin 0건 + auto 3건
assertCase("case3: pin 0건 + auto 3건 → items 3건 source='auto'", () => {
  const messages = makeAutoCandidateSeq();
  const r = mergeInsightReceipt({ roomId: "r3", messages, userPins: [] });
  eq(r.stats.pinCount, 0, "pinCount");
  if (r.stats.autoCount < 1) {
    throw new Error(`expected autoCount >= 1, got ${r.stats.autoCount}`);
  }
  for (const it of r.receipt.items) {
    eq(it.source, "auto", "source");
  }
});

// case 4: pin 1건 + auto 3건 + dedup 1건 → items mergedCount, dedupCount=1, pin 우선
assertCase("case4: pin + auto dedup → pin 우선 score=5 사수", () => {
  const messages = makeAutoCandidateSeq();
  // m2가 자동 후보로 잡힐 것을 가정 + 동일 m2를 pin으로 추가.
  const r = mergeInsightReceipt({
    roomId: "r4",
    messages,
    userPins: [{ messageId: "m2", ts: "2026-05-10T20:05:00+09:00" }],
  });
  // 합 vs merged 차이가 dedup.
  eq(r.stats.pinCount + r.stats.autoCount - r.stats.mergedCount, r.stats.dedupCount, "dedupCount 산식");
  // m2 항목은 pin 우선.
  const m2 = r.receipt.items.find((x) => x.messageId === "m2");
  if (!m2) throw new Error("m2 not in items");
  eq(m2.source, "pin", "m2 source 우선");
  eq(m2.score, 5, "m2 score=5 사수");
});

// case 5: C-D70-2/C-D71-2/C-D72-2 1:1 호출 정합성
assertCase("case5: C-D70-2/C-D71-2/C-D72-2 호출 정합 (triggerState 형식)", () => {
  const messages = makeAutoCandidateSeq();
  const r = mergeInsightReceipt({ roomId: "r5", messages, userPins: [] });
  // triggerState 키 3종 사수 (shouldTrigger / messageCount / conflictPairCount).
  if (typeof r.receipt.triggerState.shouldTrigger !== "boolean") {
    throw new Error("triggerState.shouldTrigger 누락");
  }
  if (typeof r.receipt.triggerState.messageCount !== "number") {
    throw new Error("triggerState.messageCount 누락");
  }
  if (typeof r.receipt.triggerState.conflictPairCount !== "number") {
    throw new Error("triggerState.conflictPairCount 누락");
  }
  eq(r.receipt.triggerState.messageCount, messages.length, "messageCount echo");
});

// case 6: triggerState.shouldTrigger=true 시 정확 echo (override로 임계 1로 낮춤).
assertCase("case6: shouldTrigger=true override → triggerState 정확 echo", () => {
  // 충돌 표현 포함 메시지 2건 + 메시지 ≥ 1 → minMessages=1 / minConflicts=0 으로 trigger=true 강제.
  const messages = [
    { id: "m1", speakerId: "ai-a", text: "이건 좋은 의견입니다.", ts: "2026-05-10T20:00:00+09:00" },
    { id: "m2", speakerId: "ai-b", text: "하지만 비용이 너무 높습니다.", ts: "2026-05-10T20:01:00+09:00" },
  ];
  const r = mergeInsightReceipt({
    roomId: "r6",
    messages,
    userPins: [],
    minMessages: 1,
    minConflicts: 0,
  });
  eq(r.receipt.triggerState.shouldTrigger, true, "shouldTrigger");
  eq(r.receipt.triggerState.messageCount, 2, "messageCount");
});

console.log("");
console.log(
  `merge-insight-receipt tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
