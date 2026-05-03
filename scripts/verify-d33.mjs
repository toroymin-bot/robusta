#!/usr/bin/env node
/**
 * verify-d33.mjs
 *   - C-D33-1~5 (D-5 19시 슬롯, 2026-05-03) — Tori spec (Task_2026-05-03 §9).
 *   - 패턴: verify-d32 계승 — 정적 source 패턴 검사. 168 정식 HARD GATE 는 verify-d27 담당.
 *   - 본 게이트는 conservation-13 v2 (conversation-workspace useEffect / 조건부 렌더 카운트 스냅샷) 포함.
 *
 * 검증 범위 (총 37 assertion):
 *   1) C-D33-1 — KeyInputModal 진입점 hook + funnelEvents byok_required (8)
 *   2) C-D33-2 — CronPreviewChip 마운트 + frequencyToCron (8)
 *   3) C-D33-3 — funnelEvents Confluence metric 자동 echo 게이트 (8)
 *   4) C-D33-4 — Spec 005 MCP D-4 SDK Phase 2 사전 준비 (5)
 *   5) C-D33-5 — Hero sub + 빈 방 hint pill (5)
 *   6) conservation-13 v2 — conversation-workspace 스냅샷 (3)
 *
 * 의존성 0 — node 표준만.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

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
// 1) C-D33-1 — KeyInputModal 진입점 hook + funnelEvents byok_required (8)
// ─────────────────────────────────────────────────────────────────────────────
{
  const funnel = await readSrc("src/modules/funnel/funnel-events.ts");
  assert(
    "C-D33-1: FunnelEvent union 에 'byok_required' type append",
    /type:\s*"byok_required"/.test(funnel),
  );
  assert(
    "C-D33-1: byok_required source union ('entry' | 'send_401') 정의",
    /source:\s*"entry"\s*\|\s*"send_401"/.test(funnel),
  );

  const ws = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  assert(
    "C-D33-1: workspace 가 KeyInputModal lazy import",
    /KeyInputModal\s*=\s*lazy\(/.test(ws) &&
      /from\s+"@\/modules\/api-keys\/key-input-modal"/.test(ws) ||
      /import\("@\/modules\/api-keys\/key-input-modal"\)/.test(ws),
  );
  assert(
    "C-D33-1: workspace useEffect 안 byok_required source='entry' 로깅",
    /type:\s*"byok_required"/.test(ws) && /source:\s*"entry"/.test(ws),
  );
  assert(
    "C-D33-1: workspace 가 useApiKeyStore.getState().keys.anthropic 검사 (hasAnyVerifiedKey 부재 fallback)",
    /useApiKeyStore\.getState\(\)\.keys\.anthropic/.test(ws),
  );
  assert(
    "C-D33-1: workspace 가 KeyInputModal 조건부 렌더 (keyInputOpen)",
    /keyInputOpen\s*&&/.test(ws) && /<KeyInputModal/.test(ws),
  );

  const api = await readSrc("src/modules/conversation/conversation-api.ts");
  assert(
    "C-D33-1: conversation-api 가 401 응답 시 byok_required source='send_401' 로깅",
    /response\.status\s*===\s*401/.test(api) &&
      /type:\s*"byok_required"/.test(api) &&
      /source:\s*"send_401"/.test(api),
  );

  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D33-1: i18n keymodal.trigger.* 2키 ko/en parity",
    (messages.match(/"keymodal\.trigger\.entry"/g) ?? []).length >= 2 &&
      (messages.match(/"keymodal\.trigger\.401"/g) ?? []).length >= 2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D33-2 — CronPreviewChip 마운트 + frequencyToCron (8)
// ─────────────────────────────────────────────────────────────────────────────
{
  const types = await readSrc("src/modules/schedule/schedule-types.ts");
  assert(
    "C-D33-2: schedule-types frequencyToCron export",
    /export function frequencyToCron/.test(types),
  );
  assert(
    "C-D33-2: frequencyToCron every-minutes → '*/N * * * *'",
    /\$\{f\.minutes\}\s*\*\s*\*\s*\*\s*\*/.test(types),
  );
  assert(
    "C-D33-2: frequencyToCron daily-at → 'M H * * *'",
    /\$\{f\.minute\}\s*\$\{f\.hour\}\s*\*\s*\*\s*\*/.test(types),
  );

  const modal = await readSrc("src/modules/schedule/schedule-modal.tsx");
  assert(
    "C-D33-2: schedule-modal 이 CronPreviewChip + frequencyToCron import",
    /CronPreviewChip/.test(modal) && /frequencyToCron/.test(modal),
  );
  assert(
    "C-D33-2: schedule-modal AddRuleForm 에 cron preview chip 마운트",
    /<CronPreviewChip\s+cron=/.test(modal) &&
      /schedule-add-cron-preview-/.test(modal),
  );

  const page = await readSrc("src/app/schedules/page.tsx");
  assert(
    "C-D33-2: /schedules page 가 CronPreviewChip + frequencyToCron import",
    /CronPreviewChip/.test(page) && /frequencyToCron/.test(page),
  );
  assert(
    "C-D33-2: /schedules 룰 카드에 chip 마운트 (data-test schedules-rule-cron-)",
    /<CronPreviewChip\s+cron=/.test(page) &&
      /schedules-rule-cron-/.test(page),
  );

  // 기존 chip 외부 의존 0 회귀 가드 (verify-d32 와 중복이지만 D-D33 명세 정합)
  const chip = await readSrc("src/modules/schedule/cron-preview-chip.tsx");
  assert(
    "C-D33-2: cron-preview-chip 외부 dev-dep 0 (cronstrue / cron-parser 미도입)",
    !/from\s+["']cronstrue["']/.test(chip) &&
      !/from\s+["']cron-parser["']/.test(chip),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D33-3 — funnelEvents Confluence metric 자동 echo 게이트 (8)
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D33-3: scripts/funnel-summary.mjs 신규 파일 존재",
    await exists("scripts/funnel-summary.mjs"),
  );
  const summary = await readSrc("scripts/funnel-summary.mjs");
  assert(
    "C-D33-3: funnel-summary FunnelEvent union 정적 파싱 (typeRegex)",
    /typeRegex/.test(summary) || /type:\\s\*"\(/.test(summary),
  );
  assert(
    "C-D33-3: funnel-summary 외부 의존 0 (Node 표준 fs/path 만)",
    /from\s+"node:fs\/promises"/.test(summary) &&
      !/import.*from\s+["'][^.@n]/m.test(
        summary.replace(/from\s+"node:[^"]+"/g, ""),
      ),
  );

  const pkg = await readSrc("package.json");
  assert(
    "C-D33-3: package.json verify:d33 스크립트 등록",
    /"verify:d33"/.test(pkg),
  );
  assert(
    "C-D33-3: package.json funnel:summary 스크립트 등록",
    /"funnel:summary"/.test(pkg),
  );

  // funnel-summary.mjs 실행 → JSON 출력 schema 검증
  const child = spawnSync("node", ["scripts/funnel-summary.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  let parsed = null;
  try {
    parsed = JSON.parse(child.stdout);
  } catch {}
  assert(
    "C-D33-3: funnel-summary stdout 가 valid JSON",
    parsed !== null && typeof parsed === "object",
  );
  assert(
    "C-D33-3: schema { as_of, byType, total } 필드 모두 존재",
    parsed &&
      typeof parsed.as_of === "string" &&
      typeof parsed.byType === "object" &&
      typeof parsed.total === "number",
  );
  assert(
    "C-D33-3: byType 에 insight_displayed + byok_required 자동 흡수",
    parsed &&
      Object.prototype.hasOwnProperty.call(parsed.byType, "insight_displayed") &&
      Object.prototype.hasOwnProperty.call(parsed.byType, "byok_required"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D33-4 — Spec 005 MCP D-4 SDK Phase 2 사전 준비 (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D33-4: specs/spec-005-mcp-phase2-wiring.md 신규 파일 존재 (꼬미 자율 미러)",
    await exists("specs/spec-005-mcp-phase2-wiring.md"),
  );

  const section = await readSrc("src/modules/mcp/mcp-section.tsx");
  assert(
    "C-D33-4: mcp-section 에 Phase 2 disabled chip + i18n key mcp.section.phase2.label",
    /mcp\.section\.phase2\.label/.test(section),
  );
  assert(
    "C-D33-4: mcp-section disabled 상태 유지 (button disabled)",
    /disabled/.test(section) && /aria-disabled/.test(section),
  );

  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D33-4: i18n mcp.section.phase2.label 1키 ko/en parity",
    (messages.match(/"mcp\.section\.phase2\.label"/g) ?? []).length >= 2,
  );

  // C-D33-4 (D-5 19시) → C-D35-1 (D-4 03시) 갱신:
  //   D-5 까지 SDK 미도입 의무 → D-4 본격 도입 (Tori spec §C-D35-1).
  //   본 게이트는 "도입 시점 = devDependencies 정확 1건" 으로 재정의 — 회귀 보호.
  const pkg = await readSrc("package.json");
  const pkgJson = JSON.parse(pkg);
  const sdkPin = pkgJson.devDependencies?.["@modelcontextprotocol/sdk"];
  assert(
    "C-D33-4 → C-D35-1: @modelcontextprotocol/sdk devDeps 정확 1건 (D-4 도입)",
    typeof sdkPin === "string" && sdkPin.length > 0,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D33-5 — Hero sub + 빈 방 hint pill (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const welcome = await readSrc("src/modules/scenarios/welcome-view.tsx");
  assert(
    "C-D33-5: welcome-view 가 hero.sub i18n 키 사용 (Robusta 컨셉 강화)",
    /hero\.sub/.test(welcome),
  );

  assert(
    "C-D33-5: src/modules/conversation/empty-room-hint.tsx 신규 파일 존재",
    await exists("src/modules/conversation/empty-room-hint.tsx"),
  );
  const hint = await readSrc("src/modules/conversation/empty-room-hint.tsx");
  assert(
    "C-D33-5: EmptyRoomHint export + room.empty.hint i18n 키 + count 0 unmount",
    /export function EmptyRoomHint/.test(hint) &&
      /room\.empty\.hint/.test(hint) &&
      /count\s*>\s*0/.test(hint) &&
      /return\s+null/.test(hint),
  );

  const ws = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  assert(
    "C-D33-5: workspace 가 EmptyRoomHint lazy import + 마운트",
    /EmptyRoomHint\s*=\s*lazy\(/.test(ws) && /<EmptyRoomHint/.test(ws),
  );

  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D33-5: i18n hero.sub + room.empty.hint 2키 ko/en parity",
    (messages.match(/"hero\.sub"/g) ?? []).length >= 2 &&
      (messages.match(/"room\.empty\.hint"/g) ?? []).length >= 2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) conservation-13 v2 — conversation-workspace 스냅샷 (3)
//    - useEffect 카운트 ≤ 8 (D-D33 후 스냅샷 — 향후 슬롯에서 추가 시 명시 정당화 의무)
//    - 조건부 모달 마운트 ({x && <Modal) 카운트 ≤ 4
//    - 보존 13 본체 (conversation-store.ts) 직접 수정 회귀 가드는 verify-conservation-13 담당
// ─────────────────────────────────────────────────────────────────────────────
{
  const ws = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  const useEffectCount = (ws.match(/useEffect\(/g) ?? []).length;
  const condRenderCount = (ws.match(/\}\s*&&\s*[(<]/g) ?? []).length;
  assert(
    `conservation-13 v2: workspace useEffect ≤ 8 (실제 ${useEffectCount}) — 추가 시 명시 정당화 의무`,
    useEffectCount <= 8,
  );
  assert(
    `conservation-13 v2: workspace 조건부 마운트 ≤ 4 (실제 ${condRenderCount}) — 추가 시 명시 정당화 의무`,
    condRenderCount <= 4,
  );
  assert(
    "conservation-13 v2: workspace 가 KeyInputModal/EmptyRoomHint 모두 lazy 분리 (메인 번들 +0 의무)",
    /KeyInputModal\s*=\s*lazy\(/.test(ws) &&
      /EmptyRoomHint\s*=\s*lazy\(/.test(ws),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\nverify-d33: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}`,
);
process.exit(fail === 0 ? 0 : 1);
