#!/usr/bin/env node
/**
 * tests/extract-conflict-pairs.test.mjs
 *   - C-D71-2 테스트 6 케이스 (§6.5 명세 정합).
 *
 * 6 케이스 (똘이 §6.5 명시):
 *   1) 빈 배열 → pairs=[], totalScanned=0
 *   2) 단일 메시지 → pairs=[]
 *   3) 대립표현+서로다른발화자+인접 → score=3 1쌍
 *   4) maxLookback=2, 5개 떨어진 충돌 → 제외
 *   5) 동일 발화자 대립 → score=2 (대립표현+인접만, cross-speaker 미충족)
 *   6) 다중 충돌 → pairs 길이 ≥ 2
 *
 * 외부 dev-deps +0 (node 표준만).
 */

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

console.log("extract-conflict-pairs — 6 케이스 테스트");

// case 1: 빈 배열
assertCase("case1: 빈 배열 → pairs=[] totalScanned=0", () => {
  const r = extractConflictPairs({ roomId: "r1", messages: [] });
  eq(r.pairs.length, 0, "pairs.length");
  eq(r.totalScanned, 0, "totalScanned");
});

// case 2: 단일 메시지 → pairs=[]
assertCase("case2: 단일 메시지 → pairs=[]", () => {
  const r = extractConflictPairs({
    roomId: "r2",
    messages: [
      { id: "m1", speakerId: "ai-A", text: "단일 메시지", ts: "t1" },
    ],
  });
  eq(r.pairs.length, 0, "pairs.length");
  eq(r.totalScanned, 1, "totalScanned");
});

// case 3: 대립표현+cross-speaker+인접 → score=3 1쌍
assertCase("case3: 대립+cross-speaker+인접 → score=3 1쌍", () => {
  const r = extractConflictPairs({
    roomId: "r3",
    messages: [
      { id: "m1", speakerId: "ai-A", text: "이 결정은 옳다.", ts: "t1" },
      { id: "m2", speakerId: "ai-B", text: "하지만 그 결정은 위험하다.", ts: "t2" },
    ],
  });
  eq(r.pairs.length, 1, "pairs.length");
  eq(r.pairs[0].score, 3, "score");
  eq(r.pairs[0].aId, "m1", "aId");
  eq(r.pairs[0].bId, "m2", "bId");
});

// case 4: maxLookback=2, 5개 떨어진 충돌 → 제외
assertCase("case4: maxLookback=2 → 5개 떨어진 충돌 제외", () => {
  const r = extractConflictPairs({
    roomId: "r4",
    messages: [
      { id: "m1", speakerId: "ai-A", text: "초기 결정", ts: "t1" },
      { id: "m2", speakerId: "ai-B", text: "동의", ts: "t2" },
      { id: "m3", speakerId: "ai-A", text: "확장", ts: "t3" },
      { id: "m4", speakerId: "ai-B", text: "더 발전", ts: "t4" },
      { id: "m5", speakerId: "ai-A", text: "종합", ts: "t5" },
      { id: "m6", speakerId: "ai-B", text: "그러나 m1 결정은 잘못됐다.", ts: "t6" },
    ],
    maxLookback: 2,
  });
  // m6 대립 표현 보유. lookback=2 → m4, m5 만 후보. 모두 cross-speaker 가능 (m5=ai-A, m4=ai-B와 동일).
  // m5 (가장 가까움, ai-A, m6=ai-B) 가 페어로 잡힘. m1 (5칸 떨어짐) 은 lookback 밖이므로 제외.
  // pairs 길이 1 + aId === m5 검증 (m1 미선택 — lookback 밖).
  eq(r.pairs.length, 1, "pairs.length");
  eq(r.pairs[0].aId, "m5", "aId (m1 lookback 밖 → 가장 가까운 m5)");
});

// case 5: 동일 발화자 대립 → score=2 (cross-speaker 미부여)
assertCase("case5: 동일 발화자 대립 → score=2", () => {
  const r = extractConflictPairs({
    roomId: "r5",
    messages: [
      { id: "m1", speakerId: "ai-A", text: "결정 옳다.", ts: "t1" },
      { id: "m2", speakerId: "ai-A", text: "하지만 재고 필요.", ts: "t2" },
    ],
  });
  eq(r.pairs.length, 1, "pairs.length");
  eq(r.pairs[0].score, 2, "score (cross-speaker 미부여)");
  if (r.pairs[0].reasons.includes("cross-speaker")) {
    throw new Error("cross-speaker should NOT be present (same speaker)");
  }
});

// case 6: 다중 충돌 → pairs 길이 ≥ 2
assertCase("case6: 다중 충돌 → pairs 길이 ≥ 2", () => {
  const r = extractConflictPairs({
    roomId: "r6",
    messages: [
      { id: "m1", speakerId: "ai-A", text: "첫 결정", ts: "t1" },
      { id: "m2", speakerId: "ai-B", text: "하지만 그 결정 위험.", ts: "t2" },
      { id: "m3", speakerId: "ai-A", text: "재고", ts: "t3" },
      { id: "m4", speakerId: "ai-C", text: "그러나 다른 시각.", ts: "t4" },
    ],
  });
  if (r.pairs.length < 2) {
    throw new Error(`expected pairs.length ≥ 2, got ${r.pairs.length}`);
  }
});

console.log("");
console.log(
  `extract-conflict-pairs tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
