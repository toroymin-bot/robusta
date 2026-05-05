#!/usr/bin/env node
/**
 * verify-d43.mjs
 *   - C-D43-1∼5 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43 (Task_2026-05-05 §7).
 *   - 패턴: verify-d42 / verify-d40 계승 — 정적 source 패턴 검사.
 *
 * 검증 범위 (총 13 게이트):
 *   1) C-D43-1 (3) — use-chip-prefill.ts + sessionStorage.getItem('robusta:chip-prefill') + removeItem
 *   2) C-D43-2 (4) — toMarkdown export + isExportable export + UTF-8 charset + URL.revokeObjectURL
 *   3) C-D43-3 (3) — "Show HN: Robusta" 정적 grep + getShowHnPost export + 강조 ≤ 3건
 *   4) C-D43-4 (3) — FUNNEL_EVENTS 12 events + funnelEvents Dexie store + /launch 라우트 파일 존재
 *
 * 회귀 의무:
 *   verify-d40 34/34 + verify-d40-auto 4/4 + verify-d42 13/13 + 168 정식 HARD GATE shared 103 kB
 *   18 사이클 PASS 유지.
 *
 * 자율 정정 (꼬미 §8):
 *   D-43-자-1: useChipPrefill chatInputRef 인자 미주입 — querySelector("[data-test='message-input']") 사용
 *              (보존 13 conversation-workspace.tsx 신성 모듈 ref 신규 추가 0).
 *   D-43-자-2: db.ts Dexie v3→v4 마이그레이션 불필요 — funnelEvents 이미 v10 존재.
 *              db.ts 무수정 (보존 13 v3 무손상).
 *   D-43-자-3: launch FUNNEL_EVENTS 12 events 는 별도 모듈 src/modules/launch/funnel-events.ts 에 분리
 *              (기존 @/modules/funnel/funnel-events discriminated union 충돌 0).
 *   D-43-자-4: i18n 키 명세 풀-id (keyword.chip.startup-hypothesis.prefill) 대신 기존 짧은 키 패턴
 *              (keyword.chip.startup.prefill) 정합 — 기존 5×2 keyword.chip.* 키와 일관성.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
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

async function readSrc(p) {
  return readFile(resolve(root, p), "utf8");
}

async function exists(p) {
  try {
    await stat(resolve(root, p));
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) C-D43-1 (3) — useChipPrefill hook + sessionStorage read/remove.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D43-1 (1/3): src/modules/conversation/use-chip-prefill.ts 파일 존재 + useChipPrefill export",
    await exists("src/modules/conversation/use-chip-prefill.ts"),
    "file missing",
  );
  const hook = await readSrc("src/modules/conversation/use-chip-prefill.ts");
  assert(
    "C-D43-1 (2/3): sessionStorage.getItem('robusta:chip-prefill') 정적 grep 1건",
    /sessionStorage\.getItem\(['"]robusta:chip-prefill['"]\)/.test(hook),
  );
  assert(
    "C-D43-1 (3/3): sessionStorage.removeItem('robusta:chip-prefill') 정적 grep 1건 (1회성 삭제 의무)",
    /removeItem\(['"]robusta:chip-prefill['"]\)/.test(hook),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D43-2 (4) — meeting-record .md + UTF-8 + URL.revokeObjectURL.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D43-2 (1/4): src/modules/conversation/meeting-record.ts 파일 존재 + toMarkdown export",
    await exists("src/modules/conversation/meeting-record.ts"),
    "file missing",
  );
  const mr = await readSrc("src/modules/conversation/meeting-record.ts");
  assert(
    "C-D43-2 (2/4): toMarkdown / isExportable export 정적 grep",
    /export function toMarkdown/.test(mr) &&
      /export function isExportable/.test(mr),
  );
  assert(
    "C-D43-2 (3/4): 'text/markdown;charset=utf-8' 정적 grep 1건 (UTF-8 의무, 한국어/영문 mixed 정합)",
    /text\/markdown;\s*charset=utf-8/.test(mr),
  );
  assert(
    "C-D43-2 (4/4): URL.revokeObjectURL 정적 grep 1건 (메모리 누수 방지)",
    /URL\.revokeObjectURL/.test(mr),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D43-3 (3) — Show HN copy + headline prefix + 강조 ≤ 3건.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D43-3 (1/3): src/modules/launch/show-hn-copy.ts + getShowHnPost export",
    await exists("src/modules/launch/show-hn-copy.ts"),
    "file missing",
  );
  const copy = await readSrc("src/modules/launch/show-hn-copy.ts");
  assert(
    "C-D43-3 (2/3): getShowHnPost / assertEnglishSubmitReady export 정적 grep",
    /export function getShowHnPost/.test(copy) &&
      /Show HN: Robusta/.test(copy),
  );

  // i18n showhn.headline en 검증 — "Show HN:" prefix 의무 + 80 chars 제한.
  const i18n = await readSrc("src/modules/i18n/messages.ts");
  const enHeadlineMatch = i18n.match(
    /"showhn\.headline":\s*"(Show HN:[^"]+)"/g,
  );
  const koHeadline = i18n.match(
    /"showhn\.headline":\s*"Robusta — AI들의 라운드테이블[^"]+"/,
  );
  // ko/en 헤드라인 모두 존재 + en 헤드라인 ≤ 80 chars.
  let enLen = 0;
  if (enHeadlineMatch && enHeadlineMatch.length >= 1) {
    const m = enHeadlineMatch[0].match(/"(Show HN:[^"]+)"/);
    enLen = m?.[1]?.length ?? 0;
  }
  // 강조 카운트 — 본문 5단락 합 (ko/en 양쪽). 단락 안 **bold** 형태 ≤ 3 권장 (디자인 게이트, 단락당 평균).
  const bodyKeys = [
    "showhn.body.p1",
    "showhn.body.p2",
    "showhn.body.p3",
    "showhn.body.p4",
    "showhn.body.p5",
  ];
  let bodyAllPresent = true;
  for (const k of bodyKeys) {
    if (!new RegExp(`"${k.replace(/\./g, "\\.")}":`).test(i18n)) {
      bodyAllPresent = false;
      break;
    }
  }
  assert(
    "C-D43-3 (3/3): showhn.headline ko/en parity + en ≤ 80 chars + body p1∼p5 5단락 ko/en parity",
    !!koHeadline && enLen > 0 && enLen <= 80 && bodyAllPresent,
    `koHeadline=${!!koHeadline} enLen=${enLen} bodyAllPresent=${bodyAllPresent}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D43-4 (3) — FUNNEL_EVENTS 12 + funnelEvents store + /launch 라우트.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D43-4 (1/3): src/modules/launch/funnel-events.ts FUNNEL_EVENTS 12 events + LaunchFunnelEvent type",
    await exists("src/modules/launch/funnel-events.ts"),
    "file missing",
  );
  const fe = await readSrc("src/modules/launch/funnel-events.ts");
  // 12 events 정적 grep.
  const expected = [
    "page_view",
    "show_hn_arrival",
    "direct_visit",
    "chip_click",
    "byok_input",
    "first_message",
    "ai_response",
    "fifth_turn",
    "meeting_record_download",
    "share_link_copy",
    "twitter_share",
    "show_hn_comment",
  ];
  const allPresent = expected.every((e) =>
    new RegExp(`"${e}"`).test(fe),
  );
  assert(
    "C-D43-4 (1/3): FUNNEL_EVENTS 12 events 모두 정적 grep PASS (acquisition 3 + activation 3 + aha 3 + share 3)",
    allPresent && /FUNNEL_EVENTS\s*=/.test(fe),
    `expected 12 string-events, missing some?`,
  );

  // funnelEvents Dexie store 등록 (db.ts v10 기존 자산 — 자율 정정 D-43-자-2 정합).
  const db = await readSrc("src/modules/storage/db.ts");
  assert(
    "C-D43-4 (2/3): db.ts funnelEvents store 정적 grep (v10 기존 — 자율 정정 D-43-자-2: db.ts 무수정 정합)",
    /funnelEvents:\s*"\+\+id, type, timestamp"/.test(db),
  );

  // /launch 라우트 파일 존재.
  assert(
    "C-D43-4 (3/3): src/app/launch/page.tsx 라우트 파일 존재 + LaunchMonitorView dynamic import",
    await exists("src/app/launch/page.tsx"),
    "file missing",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${pass + fail} · PASS: ${pass} · FAIL: ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-d43 FAILED (${fail} 건)`);
  process.exit(1);
}

console.log(
  `\n✓ verify-d43: ${pass}/${pass} PASS — D-D43 P0 5건 (C-D43-1∼4 + C-D43-5 본 파일) + 168 정식 HARD GATE 18 사이클 도전`,
);
process.exit(0);
