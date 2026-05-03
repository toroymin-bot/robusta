#!/usr/bin/env node
/**
 * verify-conservation-13.mjs
 *   C-D32-1 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-1 (F-D32-1).
 *   목적: 보존 13 conversation-store.ts 의 parseMessageInsights wiring 회귀 보호 게이트.
 *
 *   C-D31-2 등록 (D-5 11시) 이후 분기 추가/확장 시 자동 감지.
 *   Do §3.6 보존 13 자산 — 본체 직접 수정은 명시 마이그레이션 Spec 동반 시만 허용.
 *
 *   본 게이트는 정규식 기반 정적 검사 (acorn 미도입, 의존성 0).
 *
 *   검증 룰 (자율 결정 — 명세 §7 C-D32-1 5케이스 + 실용 변환):
 *     1) parseMessageInsights( 호출 분기 ≤ 2 (retry done + AutoLoop done)
 *     2) 호출 분기 1건 이상 (Spec 003 wiring 누락 감지)
 *     3) parseMessageInsights import ≤ 1줄 (conversation-api 단일 경로)
 *     4) 각 호출 라인 직후 ≤ 5줄 내 updateMessage 호출 (분리·캐시 등 우회 패턴 차단)
 *     5) export interface ConversationState 시그니처 snapshot 포함 — diff 시 hint
 *
 *   exit 0 = PASS, exit 1 = FAIL (회귀 또는 누락).
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const TARGET = "src/stores/conversation-store.ts";
const HOOK_NAME = "parseMessageInsights";

let pass = 0;
let fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass += 1;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail += 1;
  }
}

async function exists(p) {
  try {
    await stat(resolve(root, p));
    return true;
  } catch {
    return false;
  }
}

const present = await exists(TARGET);
assert(
  `보존 13 conversation-store.ts 존재 (${TARGET})`,
  present,
  "파일 누락 — 보존 13 자산 신성 위반",
);
if (!present) {
  console.error(`\nverify-conservation-13: FAIL ${fail} / PASS ${pass}`);
  process.exit(1);
}

const src = await readFile(resolve(root, TARGET), "utf8");
const lines = src.split("\n");

// (1) parseMessageInsights( 호출 분기 ≤ 2 (호출 라인 카운트)
const callRegex = new RegExp(`\\b${HOOK_NAME}\\s*\\(`, "g");
const importRegex = new RegExp(`^\\s*${HOOK_NAME}\\s*,?\\s*$`);

let callCount = 0;
let importCount = 0;
const callLineNumbers = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // 호출 (선언/import 제외 — import 는 별도 카운트)
  if (callRegex.test(line)) {
    callCount += 1;
    callLineNumbers.push(i);
  }
  callRegex.lastIndex = 0;
  // import 라인 (단순 식별자 형식)
  if (importRegex.test(line)) {
    importCount += 1;
  }
}

assert(
  `(1) ${HOOK_NAME}( 호출 분기 ≤ 2 (실제 ${callCount})`,
  callCount <= 2,
  `초과 호출 — Spec 003 wiring 분기 폭증. 명시 마이그 Spec 필요.`,
);

// (2) 호출 분기 ≥ 1 (Spec 003 wiring 누락 감지)
assert(
  `(2) ${HOOK_NAME}( 호출 분기 ≥ 1 (실제 ${callCount})`,
  callCount >= 1,
  `wiring 누락 — Spec 003 폴리시 손상.`,
);

// (3) import ≤ 1줄
assert(
  `(3) ${HOOK_NAME} import ≤ 1줄 (실제 ${importCount})`,
  importCount <= 1,
  `다중 import — single source 위배.`,
);

// (4) 각 호출 라인 직후 ≤ 5줄 내 updateMessage 호출 존재
//     (parseMessageInsights 결과를 즉시 updateMessage 에 흘려보내야 함)
const UPDATE_PATTERN = /\.updateMessage\s*\(/;
const UPDATE_WINDOW_LINES = 5;
let updateProximityFails = 0;
for (const callLine of callLineNumbers) {
  let found = false;
  for (
    let j = callLine + 1;
    j <= Math.min(callLine + UPDATE_WINDOW_LINES, lines.length - 1);
    j++
  ) {
    if (UPDATE_PATTERN.test(lines[j])) {
      found = true;
      break;
    }
  }
  if (!found) updateProximityFails += 1;
}
assert(
  `(4) 각 호출 라인 직후 ≤ ${UPDATE_WINDOW_LINES}줄 내 updateMessage 인접 (실패 ${updateProximityFails})`,
  updateProximityFails === 0,
  `호출 결과를 즉시 updateMessage 에 적용하지 않는 분기 존재 — 우회 패턴 의심.`,
);

// (5) ConversationStore zustand 시그니처 snapshot — 변경 시 hint
//     현 코드 사실: `interface ConversationStore { ... }` (D-9.3 zustand store).
//     꼬미 자율 정정: 명세 §7 의 `export interface ConversationState` 표기는 오기 — 실 구조는 ConversationStore.
const storeSig = /\binterface\s+ConversationStore\b/.test(src);
assert(
  `(5) interface ConversationStore 시그니처 보존`,
  storeSig,
  `시그니처 변경 — 본 게이트 스냅샷 갱신 필요.`,
);

console.log(
  `\nverify-conservation-13: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}`,
);
process.exit(fail === 0 ? 0 : 1);
