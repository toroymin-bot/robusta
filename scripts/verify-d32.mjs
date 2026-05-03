#!/usr/bin/env node
/**
 * verify-d32.mjs
 *   - C-D32-1~5 (D-5 15시 슬롯, 2026-05-03) — Tori spec (Task_2026-05-03 §7).
 *   - 패턴: verify-d31 계승 — 정적 source 패턴 검사. 168 정식 HARD GATE 는 verify-d27 담당.
 *
 * 검증 범위 (총 27 assertion, 명세 §7 verify 케이스 5+5+5+6+6 매핑):
 *   1) C-D32-1 — verify-conservation-13.mjs 신규 게이트 (5)
 *   2) C-D32-2 — funnelEvents insight_displayed 추적 (5)
 *   3) C-D32-3 — Spec 005 MCP 골격 (5)
 *   4) C-D32-4 — KeyInputModal 신규 (6)
 *   5) C-D32-5 — CronPreviewChip 신규 (6)
 *
 * 의존성 0 — node 표준만.
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
// 1) C-D32-1 — verify-conservation-13 신규 게이트 (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const present = await exists("scripts/verify-conservation-13.mjs");
  assert(
    "C-D32-1: scripts/verify-conservation-13.mjs 존재",
    present,
  );
  if (present) {
    const src = await readSrc("scripts/verify-conservation-13.mjs");
    assert(
      "C-D32-1: parseMessageInsights 호출 분기 ≤ 2 룰 명시",
      /호출 분기 ≤ 2/.test(src) || /callCount\s*<=\s*2/.test(src),
    );
    assert(
      "C-D32-1: import ≤ 1줄 룰 명시",
      /import ≤ 1/.test(src) || /importCount\s*<=\s*1/.test(src),
    );
    assert(
      "C-D32-1: updateMessage 인접성 룰 명시",
      /updateMessage/.test(src),
    );
    assert(
      "C-D32-1: ConversationStore 시그니처 snapshot",
      /ConversationStore/.test(src),
    );
  }
  const pkg = await readSrc("package.json");
  assert(
    "C-D32-1: package.json verify:conservation-13 스크립트 등록",
    /"verify:conservation-13"/.test(pkg),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D32-2 — funnelEvents insight_displayed 추적 (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const funnel = await exists("src/modules/funnel/funnel-events.ts");
  assert("C-D32-2: src/modules/funnel/funnel-events.ts 존재", funnel);
  if (funnel) {
    const src = await readSrc("src/modules/funnel/funnel-events.ts");
    assert(
      "C-D32-2: FunnelEvent union insight_displayed 정의",
      /type:\s*"insight_displayed"/.test(src),
    );
    assert(
      "C-D32-2: logFunnelEvent dedupe 가드 (insightDisplayedSeen Set)",
      /insightDisplayedSeen/.test(src) && /\.has\(/.test(src),
    );
  }
  const bubble = await readSrc("src/modules/conversation/message-bubble.tsx");
  assert(
    "C-D32-2: message-bubble.tsx 가 logFunnelEvent import",
    /from\s+"@\/modules\/funnel\/funnel-events"/.test(bubble) &&
      /\blogFunnelEvent\b/.test(bubble),
  );
  assert(
    "C-D32-2: message-bubble useEffect 안 logFunnelEvent type insight_displayed 호출",
    /useEffect\(/.test(bubble) &&
      /type:\s*"insight_displayed"/.test(bubble),
  );
  const db = await readSrc("src/modules/storage/db.ts");
  assert(
    "C-D32-2: Dexie v10 funnelEvents 테이블 정의",
    /version\(10\)/.test(db) && /funnelEvents:\s*"\+\+id, type, timestamp"/.test(db),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D32-3 — Spec 005 MCP 골격 (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const types = await exists("src/modules/mcp/types.ts");
  const client = await exists("src/modules/mcp/mcp-client.ts");
  const idx = await exists("src/modules/mcp/index.ts");
  assert(
    "C-D32-3: src/modules/mcp/{types,mcp-client,index}.ts 모두 존재",
    types && client && idx,
  );
  if (types) {
    const src = await readSrc("src/modules/mcp/types.ts");
    assert(
      "C-D32-3: MCPTool / MCPClient / MCPServerConfig 타입 export",
      /export\s+interface\s+MCPTool/.test(src) &&
        /export\s+interface\s+MCPClient/.test(src) &&
        /export\s+interface\s+MCPServerConfig/.test(src),
    );
  }
  if (client) {
    const src = await readSrc("src/modules/mcp/mcp-client.ts");
    assert(
      "C-D32-3: createStubMCPClient — listTools = [], callTool throw",
      /createStubMCPClient/.test(src) &&
        /return\s*\[\]/.test(src) &&
        /throw new Error\([^)]*MCP not yet implemented/.test(src),
    );
  }
  const section = await exists("src/modules/mcp/mcp-section.tsx");
  assert("C-D32-3: MCPSection (disabled UI) 신규 파일 존재", section);
  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D32-3: i18n mcp.section.* 2키 ko/en parity",
    (messages.match(/"mcp\.section\.title"/g) ?? []).length >= 2 &&
      (messages.match(/"mcp\.section\.placeholder"/g) ?? []).length >= 2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D32-4 — KeyInputModal 신규 (6)
// ─────────────────────────────────────────────────────────────────────────────
{
  const modal = await exists("src/modules/api-keys/key-input-modal.tsx");
  assert("C-D32-4: src/modules/api-keys/key-input-modal.tsx 존재", modal);
  if (modal) {
    const src = await readSrc("src/modules/api-keys/key-input-modal.tsx");
    assert(
      "C-D32-4: KeyInputModal export 시그니처 + provider anthropic 단일",
      /export function KeyInputModal/.test(src) &&
        /provider:\s*"anthropic"/.test(src),
    );
    assert(
      "C-D32-4: useApiKeyStore.save + pingApiKey 검증 시퀀스",
      /useApiKeyStore\.getState\(\)\.save/.test(src) &&
        /pingApiKey\(/.test(src),
    );
    assert(
      "C-D32-4: show/hide 토글 (showKey state + type=password|text)",
      /setShowKey/.test(src) &&
        /type=\{showKey\s*\?\s*"text"\s*:\s*"password"\}/.test(src),
    );
    assert(
      "C-D32-4: Esc 키 → onClose listener",
      /e\.key\s*===\s*"Escape"/.test(src),
    );
    assert(
      "C-D32-4: Anthropic Console 가이드 링크",
      /console\.anthropic\.com\/settings\/keys/.test(src),
    );
  }
  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D32-4: i18n keymodal.* 5키 ko/en parity",
    (messages.match(/"keymodal\.title"/g) ?? []).length >= 2 &&
      (messages.match(/"keymodal\.guide"/g) ?? []).length >= 2 &&
      (messages.match(/"keymodal\.action\.save"/g) ?? []).length >= 2 &&
      (messages.match(/"keymodal\.toggle\.show"/g) ?? []).length >= 2 &&
      (messages.match(/"keymodal\.toggle\.hide"/g) ?? []).length >= 2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D32-5 — CronPreviewChip 신규 (6)
// ─────────────────────────────────────────────────────────────────────────────
{
  const chip = await exists("src/modules/schedule/cron-preview-chip.tsx");
  assert("C-D32-5: src/modules/schedule/cron-preview-chip.tsx 존재", chip);
  if (chip) {
    const src = await readSrc("src/modules/schedule/cron-preview-chip.tsx");
    assert(
      "C-D32-5: CronPreviewChip export + cronToHuman + nextFireMs",
      /export function CronPreviewChip/.test(src) &&
        /export function cronToHuman/.test(src) &&
        /export function nextFireMs/.test(src),
    );
    assert(
      "C-D32-5: cronToHuman 패턴 1 (*/N) 처리",
      /\*\\\/\(\\d\+\)/.test(src),
    );
    assert(
      "C-D32-5: invalid 시 cronpreview.invalid chip fallback",
      /cronpreview\.invalid/.test(src),
    );
    assert(
      "C-D32-5: tooltip cronpreview.next + KST 시각 포맷",
      /cronpreview\.next/.test(src) &&
        /Asia\/Seoul/.test(src),
    );
    assert(
      "C-D32-5: 외부 의존 0 (cronstrue / cron-parser import 0)",
      !/from\s+["']cronstrue["']/.test(src) &&
        !/from\s+["']cron-parser["']/.test(src),
    );
  }
  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D32-5: i18n cronpreview.* 3키 ko/en parity",
    (messages.match(/"cronpreview\.next"/g) ?? []).length >= 2 &&
      (messages.match(/"cronpreview\.invalid"/g) ?? []).length >= 2 &&
      (messages.match(/"cronpreview\.tz"/g) ?? []).length >= 2,
  );
}

console.log(
  `\nverify-d32: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}`,
);
process.exit(fail === 0 ? 0 : 1);
