#!/usr/bin/env node
/**
 * verify-d24.mjs
 *   - D-D24 (D6 03시 슬롯, 2026-05-02) — D-D24 5건 통합 회귀 게이트.
 *   - verify-d23.mjs 패턴 계승. assertion 38건 목표.
 *
 * 검증 범위:
 *   1) C-D24-1 — KQ_17 (a) PersonaCardColorDot + participants-panel 마운트 + i18n
 *   2) C-D24-2 — 5베이스 hue CSS 변수 토큰화 + theme.ts CSS_VARS export + verify-hue-sync PASS
 *   3) C-D24-3 — Spec 003 통찰 강조 푸터: Message.insight 옵셔널 + InsightFooter dynamic + i18n 8 키
 *   4) C-D24-4 — 인사이트 라이브러리 사이드 시트 v0: insight-store 4 메서드 + dynamic + 진입 버튼
 *   5) C-D24-5 — 본 스크립트 자체 + verify-gate.yml D-D24 step + verify-hue-sync 호출
 *
 * 의존성 0 — node 표준만.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const root = resolve(process.cwd());
let pass = 0;
let fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass++;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail++;
  }
}

async function readSrc(p) {
  return readFile(resolve(root, p), "utf8");
}

function tryExec(cmd) {
  try {
    const out = execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    return { ok: true, out };
  } catch (e) {
    return {
      ok: false,
      out: e.stdout?.toString() ?? "",
      err: e.stderr?.toString() ?? "",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) C-D24-1 — KQ_17 (a) PersonaCardColorDot + participants-panel 마운트 + i18n
// ─────────────────────────────────────────────────────────────────────────────
{
  const dot = await readSrc(
    "src/modules/personas/persona-card-color-dot.tsx",
  );
  assert(
    "C-D24-1: persona-card-color-dot.tsx 헤더 주석 (D6 03시)",
    dot.includes("C-D24-1") && dot.includes("2026-05-02"),
  );
  assert(
    "C-D24-1: PersonaCardColorDot export + Props 3 필드 (hue/locale/size)",
    dot.includes("export interface PersonaCardColorDotProps") &&
      dot.includes("hue: number") &&
      dot.includes('locale: "ko" | "en"') &&
      dot.includes("size?: number"),
  );
  assert(
    "C-D24-1: hueToBaseName import + 호출",
    dot.includes(
      'import { hueToBaseName } from "@/modules/ui/theme"',
    ) && dot.includes("hueToBaseName(hue, locale)"),
  );
  assert(
    "C-D24-1: role=\"img\" + aria-label + title (네이티브 툴팁)",
    dot.includes('role="img"') &&
      dot.includes("aria-label={baseName}") &&
      dot.includes("title={baseName}"),
  );
  assert(
    "C-D24-1: backgroundColor `hsl(${hue}, 65%, 55%)` (C-D23-3 측정값 모드)",
    dot.includes("hsl(${hue}, 65%, 55%)"),
  );
  assert(
    "C-D24-1: sr-only span 색명 (a11y 보강)",
    dot.includes('className="sr-only"') &&
      dot.includes("{baseName}"),
  );

  const panel = await readSrc(
    "src/modules/participants/participants-panel.tsx",
  );
  assert(
    "C-D24-1: participants-panel PersonaCardColorDot import",
    panel.includes(
      'import { PersonaCardColorDot } from "@/modules/personas/persona-card-color-dot"',
    ),
  );
  assert(
    "C-D24-1: participants-panel 카드 우상단 PersonaCardColorDot 마운트",
    panel.includes("<PersonaCardColorDot") &&
      panel.includes('className="pointer-events-none absolute right-2 top-2'),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D24-2 — 5베이스 hue CSS 변수 토큰화 + theme.ts CSS_VARS + verify-hue-sync
// ─────────────────────────────────────────────────────────────────────────────
{
  const css = await readSrc("src/app/globals.css");
  for (const [i, expected] of [
    [1, 20],
    [2, 50],
    [3, 150],
    [4, 200],
    [5, 280],
  ]) {
    assert(
      `C-D24-2: globals.css --participant-hue-base-${i}: ${expected}`,
      new RegExp(
        `--participant-hue-base-${i}\\s*:\\s*${expected}\\s*;`,
      ).test(css),
    );
  }

  const theme = await readSrc("src/modules/ui/theme.ts");
  assert(
    "C-D24-2: theme.ts PARTICIPANT_HUE_SEED_CSS_VARS export",
    theme.includes("export const PARTICIPANT_HUE_SEED_CSS_VARS"),
  );
  assert(
    "C-D24-2: theme.ts CSS_VARS 5 항목 정확",
    theme.includes('"--participant-hue-base-1"') &&
      theme.includes('"--participant-hue-base-2"') &&
      theme.includes('"--participant-hue-base-3"') &&
      theme.includes('"--participant-hue-base-4"') &&
      theme.includes('"--participant-hue-base-5"'),
  );

  const panel = await readSrc(
    "src/modules/participants/participants-panel.tsx",
  );
  assert(
    "C-D24-2: panel hueToBaseName import + 색명 합성",
    panel.includes(
      'import { hueToBaseName } from "@/modules/ui/theme"',
    ) &&
      panel.includes("const colorName = hue !== null ? hueToBaseName(hue") &&
      panel.includes('"participants.shapeColor.aria"'),
  );

  // verify-hue-sync.mjs 직접 실행 — TS↔CSS 동기 의무.
  const hueSync = tryExec("node scripts/verify-hue-sync.mjs");
  assert(
    "C-D24-2: verify-hue-sync.mjs PASS",
    hueSync.ok,
    hueSync.err || hueSync.out,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D24-3 — Spec 003 통찰 강조 푸터: Message.insight + InsightFooter + i18n
// ─────────────────────────────────────────────────────────────────────────────
{
  const types = await readSrc("src/modules/conversation/conversation-types.ts");
  assert(
    "C-D24-3: InsightKind = 'newView' | 'counter' | 'augment'",
    types.includes(
      'export type InsightKind = "newView" | "counter" | "augment"',
    ),
  );
  assert(
    "C-D24-3: InsightMark 인터페이스 (kind / markedAt / markedBy)",
    types.includes("export interface InsightMark") &&
      types.includes("markedBy:") &&
      types.includes('"user" | "auto"'),
  );
  assert(
    "C-D24-3: Message.insight?: InsightMark 옵셔널 추가 (비파괴)",
    types.includes("insight?: InsightMark"),
  );

  const insight = await readSrc(
    "src/modules/conversation/insight-mark.tsx",
  );
  assert(
    "C-D24-3: InsightFooter export + Props (message / onCapture / forceShowButtons)",
    insight.includes("export interface InsightFooterProps") &&
      insight.includes("export function InsightFooter"),
  );
  assert(
    "C-D24-3: KIND_GLYPH 3종 (💡/⚖/➕)",
    insight.includes('newView: "💡"') &&
      insight.includes('counter: "⚖"') &&
      insight.includes('augment: "➕"'),
  );
  assert(
    "C-D24-3: 시스템 메시지 가드 (system / system-source-context-slicer)",
    insight.includes('participantId === "system"') &&
      insight.includes('"system-source-context-slicer"'),
  );

  const bubble = await readSrc(
    "src/modules/conversation/message-bubble.tsx",
  );
  assert(
    "C-D24-3: message-bubble dynamic import InsightFooter (메인 번들 +0)",
    bubble.includes('import("./insight-mark")') &&
      bubble.includes('dynamic('),
  );
  assert(
    "C-D24-3: message-bubble done 메시지에만 InsightFooter 마운트 (status 가드)",
    bubble.includes('message.status === "done"') &&
      bubble.includes("<InsightFooter"),
  );

  const ko = await readSrc("src/modules/i18n/messages.ts");
  for (const k of [
    "insight.kind.newView",
    "insight.kind.counter",
    "insight.kind.augment",
    "insight.markButton.tooltip",
    "insight.unmark.toast",
    "insight.unmark.action",
  ]) {
    // ko + en 양면 정의 — 각 키가 적어도 2회 등장 (parity).
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g");
    const matches = ko.match(re) ?? [];
    assert(
      `C-D24-3: i18n key "${k}" ko/en parity (≥2회 등장)`,
      matches.length >= 2,
      `count=${matches.length}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D24-4 — 인사이트 라이브러리 사이드 시트 v0
// ─────────────────────────────────────────────────────────────────────────────
{
  const store = await readSrc("src/modules/insights/insight-store.ts");
  assert(
    "C-D24-4: insight-store 4 메서드 (capture/byRoom/count/remove)",
    store.includes("capture(params)") &&
      store.includes("byRoom(roomId") &&
      store.includes("count(roomId)") &&
      store.includes("remove(id)"),
  );
  assert(
    "C-D24-4: useInsightStore zustand create export",
    store.includes("export const useInsightStore = create<InsightStoreState>"),
  );

  const sheet = await readSrc(
    "src/modules/insights/insight-library-sheet.tsx",
  );
  assert(
    "C-D24-4: InsightLibrarySheet export + Props (roomId / open / onClose)",
    sheet.includes("export interface InsightLibrarySheetProps") &&
      sheet.includes("export function InsightLibrarySheet"),
  );
  assert(
    "C-D24-4: InsightLibrarySheet 빈 상태 i18n (insightLibrary.empty)",
    sheet.includes('t("insightLibrary.empty")'),
  );
  assert(
    "C-D24-4: InsightLibrarySheet limit 50 + 더 보기 stub",
    sheet.includes("PAGE_LIMIT = 50") &&
      sheet.includes("insight-library-load-more"),
  );

  const ws = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  assert(
    "C-D24-4: workspace dynamic import InsightLibrarySheet (메인 번들 +0)",
    ws.includes('import("@/modules/insights/insight-library-sheet")') &&
      ws.includes("dynamic("),
  );
  assert(
    "C-D24-4: workspace 인사이트 진입 버튼 (data-test=insight-library-entry)",
    ws.includes('data-test="insight-library-entry"'),
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  for (const k of [
    "insightLibrary.title",
    "insightLibrary.empty",
    "insightLibrary.entry.button",
    "insightLibrary.entry.label",
    "insightLibrary.capture.guide",
  ]) {
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g");
    const matches = i18n.match(re) ?? [];
    assert(
      `C-D24-4: i18n key "${k}" ko/en parity (≥2회 등장)`,
      matches.length >= 2,
      `count=${matches.length}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D24-5 — verify-gate.yml D-D24 step + 회귀 0
// ─────────────────────────────────────────────────────────────────────────────
{
  const yml = await readSrc(".github/workflows/verify-gate.yml");
  assert(
    "C-D24-5: verify-gate.yml D-D24 통합 검증 step 추가",
    yml.includes("verify-d24.mjs") || yml.includes("D-D24"),
  );
  assert(
    "C-D24-5: verify-gate.yml verify-hue-sync.mjs step 추가",
    yml.includes("verify-hue-sync.mjs"),
  );
  assert(
    "C-D24-5: verify-gate.yml D-D23 step 보존 (회귀 0)",
    yml.includes("verify-d23.mjs"),
  );
  assert(
    "C-D24-5: verify-gate.yml D-D22 step 보존 (회귀 0)",
    yml.includes("verify-d22.mjs"),
  );

  // 회귀 — verify-d22 / verify-d23 직접 실행. PASS 의무.
  const v22 = tryExec("node scripts/verify-d22.mjs");
  assert("C-D24-5: verify-d22.mjs 회귀 PASS", v22.ok, v22.err || v22.out);
  const v23 = tryExec("node scripts/verify-d23.mjs");
  assert("C-D24-5: verify-d23.mjs 회귀 PASS", v23.ok, v23.err || v23.out);
}

console.log(`\n${pass} pass · ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
