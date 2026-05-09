#!/usr/bin/env node
/**
 * tests/analyze-byok-funnel.test.mjs
 *   - C-D66-2 테스트 (6 케이스, 명세 정합).
 *
 * 6 케이스 (§17.7 lock):
 *   1) 빈 파일 → counts/rates 모두 0, durationHours=0
 *   2) 정상 펀넬 (landing=100·key=40·room=25·msg=12) → keyRate=0.40, roomRate=0.625, msgRate=0.48
 *   3) providers 분포 (claude=20·gemini=10·chatgpt=8·grok=2·deepseek=0)
 *   4) unknown provider 1건 → providers.unknown=1
 *   5) sinceKst/untilKst 윈도우 필터 → 윈도우 외 라인 무시
 *   6) sid 정규식 위반 + malformed JSON 혼합 → 정상 라인만 집계
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import analyzeByokFunnel from "../scripts/analyze-byok-funnel.mjs";

const tmpRoot = mkdtempSync(join(tmpdir(), "byok-funnel-"));

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

function writeJsonl(name, lines) {
  const path = join(tmpRoot, name);
  writeFileSync(path, lines.join("\n"));
  return path;
}

function sid(n) {
  // 8자 hex
  return n.toString(16).padStart(8, "0");
}

function tsKst(hourOffset) {
  // 2026-05-08T07:00 KST + hourOffset
  const baseMs = new Date("2026-05-08T07:00:00+09:00").getTime();
  const ms = baseMs + hourOffset * 60 * 60 * 1000;
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yr}-${mo}-${da}T${hh}:${mm}:${ss}+09:00`;
}

console.log("analyze-byok-funnel — 6 케이스 테스트");

// case 1: 빈 파일 → counts/rates 모두 0
assertCase("case1: 빈 파일 → counts 0 / rates 0 / durationHours 0", () => {
  const path = writeJsonl("case1.jsonl", []);
  const r = analyzeByokFunnel({ pingsPath: path });
  eq(r.counts.landing, 0, "landing");
  eq(r.counts.key_added, 0, "key_added");
  eq(r.counts.room_entered, 0, "room_entered");
  eq(r.counts.msg_sent, 0, "msg_sent");
  eq(r.rates.keyRate, 0, "keyRate");
  eq(r.rates.roomRate, 0, "roomRate");
  eq(r.rates.msgRate, 0, "msgRate");
  eq(r.durationHours, 0, "durationHours");
});

// case 2: 정상 펀넬 (landing=100·key=40·room=25·msg=12)
assertCase("case2: 정상 펀넬 → keyRate=0.4 roomRate=0.625 msgRate=0.48", () => {
  const lines = [];
  for (let i = 0; i < 100; i++) {
    lines.push(JSON.stringify({ event: "landing", sid: sid(i), ts: tsKst(0) }));
  }
  for (let i = 0; i < 40; i++) {
    lines.push(JSON.stringify({ event: "key_added", sid: sid(i), ts: tsKst(0.1), provider: "claude" }));
  }
  for (let i = 0; i < 25; i++) {
    lines.push(JSON.stringify({ event: "room_entered", sid: sid(i), ts: tsKst(0.2), room_id: "r1" }));
  }
  for (let i = 0; i < 12; i++) {
    lines.push(JSON.stringify({ event: "msg_sent", sid: sid(i), ts: tsKst(0.3), room_id: "r1", len: 10 }));
  }
  const path = writeJsonl("case2.jsonl", lines);
  const r = analyzeByokFunnel({ pingsPath: path });
  eq(r.counts.landing, 100, "landing");
  eq(r.counts.key_added, 40, "key_added");
  eq(r.counts.room_entered, 25, "room_entered");
  eq(r.counts.msg_sent, 12, "msg_sent");
  eq(r.rates.keyRate, 0.4, "keyRate");
  eq(r.rates.roomRate, 0.625, "roomRate");
  eq(r.rates.msgRate, 0.48, "msgRate");
});

// case 3: providers 분포 (claude=20·gemini=10·chatgpt=8·grok=2·deepseek=0)
assertCase("case3: providers 분포 정합", () => {
  const lines = [];
  const layout = [
    ["claude", 20],
    ["gemini", 10],
    ["chatgpt", 8],
    ["grok", 2],
    ["deepseek", 0],
  ];
  let idx = 0;
  for (const [prov, n] of layout) {
    for (let i = 0; i < n; i++) {
      lines.push(JSON.stringify({ event: "key_added", sid: sid(idx++), ts: tsKst(0.1), provider: prov }));
    }
  }
  const path = writeJsonl("case3.jsonl", lines);
  const r = analyzeByokFunnel({ pingsPath: path });
  eq(r.providers.claude, 20, "claude");
  eq(r.providers.gemini, 10, "gemini");
  eq(r.providers.chatgpt, 8, "chatgpt");
  eq(r.providers.grok, 2, "grok");
  eq(r.providers.deepseek, 0, "deepseek");
  eq(r.providers.unknown, 0, "unknown");
});

// case 4: unknown provider 1건 → providers.unknown=1
assertCase("case4: unknown provider → providers.unknown=1", () => {
  const lines = [
    JSON.stringify({ event: "key_added", sid: sid(1), ts: tsKst(0.1), provider: "claude" }),
    JSON.stringify({ event: "key_added", sid: sid(2), ts: tsKst(0.1), provider: "openai-evil" }),
  ];
  const path = writeJsonl("case4.jsonl", lines);
  const r = analyzeByokFunnel({ pingsPath: path });
  eq(r.providers.claude, 1, "claude");
  eq(r.providers.unknown, 1, "unknown");
});

// case 5: sinceKst/untilKst 윈도우 필터
assertCase("case5: sinceKst/untilKst 윈도우 외 라인 무시", () => {
  const lines = [
    JSON.stringify({ event: "landing", sid: sid(1), ts: tsKst(-2) }), // before since
    JSON.stringify({ event: "landing", sid: sid(2), ts: tsKst(0) }), // in
    JSON.stringify({ event: "landing", sid: sid(3), ts: tsKst(1) }), // in
    JSON.stringify({ event: "landing", sid: sid(4), ts: tsKst(5) }), // after until
  ];
  const path = writeJsonl("case5.jsonl", lines);
  const r = analyzeByokFunnel({
    pingsPath: path,
    sinceKst: tsKst(-1),
    untilKst: tsKst(2),
  });
  eq(r.counts.landing, 2, "landing in window");
  eq(r.durationHours, 3, "durationHours = 3");
});

// case 6: sid 정규식 위반 + malformed JSON 혼합 → 정상 라인만 집계
assertCase("case6: sid 위반 + malformed JSON 혼합 → 정상 라인만", () => {
  const lines = [
    JSON.stringify({ event: "landing", sid: sid(1), ts: tsKst(0) }),
    JSON.stringify({ event: "landing", sid: "ZZZZZZZZ", ts: tsKst(0) }), // sid 위반
    JSON.stringify({ event: "landing", sid: "abc", ts: tsKst(0) }), // sid 길이 위반
    "{not json",
    JSON.stringify({ event: "landing", sid: sid(2), ts: tsKst(0) }),
  ];
  const path = writeJsonl("case6.jsonl", lines);
  const r = analyzeByokFunnel({ pingsPath: path });
  eq(r.counts.landing, 2, "landing 정상 라인만");
});

console.log("");
console.log(
  `analyze-byok-funnel tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
