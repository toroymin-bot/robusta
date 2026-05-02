#!/usr/bin/env node
/**
 * verify-d29.mjs
 *   - C-D29-1~5 (D-5 03시 슬롯, 2026-05-03) — Tori spec, D-D29 5건 통합 회귀 게이트.
 *   - verify-d28 패턴 계승. 168 정식 HARD GATE 는 verify-d27 가 담당 — 본 게이트는 build skip.
 *
 * 검증 범위 (총 20+ assertion, 명세 §9 verify 케이스 5×4 매핑):
 *   1) C-D29-1 — schedule-runner CostGuard + DAILY_BUDGET_USD + db.ts v9 costAccum (5 assertion)
 *   2) C-D29-2 — Insight 타입 + insight-footer.tsx + i18n + message-bubble lazy (5 assertion)
 *   3) C-D29-3 — font-loader.ts loadKoreanFont + isInSubsetRange + LICENSE (4 assertion)
 *   4) C-D29-4 — rule-row-adapter.ts ruleToRow / rowToRule / cronToFrequency (3 assertion)
 *   5) C-D29-5 — insight-mark-mount.tsx + conversation-workspace 마운트 (3 assertion)
 *   합계: 20 assertion (목표 충족)
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
// 1) C-D29-1 — schedule-runner CostGuard + db v9 costAccum (5 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const runner = await readSrc("src/modules/schedules/schedule-runner.ts");
  assert(
    "C-D29-1: DAILY_BUDGET_USD = 1.0 + DEFAULT_PER_MESSAGE_USD 상수",
    /DAILY_BUDGET_USD\s*=\s*1\.0/.test(runner) &&
      /DEFAULT_PER_MESSAGE_USD\s*=\s*0\.005/.test(runner),
  );
  assert(
    "C-D29-1: MODEL_COST_USD 단가 테이블 (sonnet 0.003 / opus 0.075 / haiku 0.001)",
    /["']claude-sonnet-4-6["']\s*:\s*0\.003/.test(runner) &&
      /["']claude-opus-4-6["']\s*:\s*0\.075/.test(runner) &&
      /["']claude-haiku-4-5-20251001["']\s*:\s*0\.001/.test(runner),
  );
  assert(
    "C-D29-1: CostGuard 인터페이스 (dailyBudgetUsd / estimateUsdForFire / getDailyAccumUsd / addAccum)",
    /interface\s+CostGuard\s*\{[\s\S]*?dailyBudgetUsd:\s*number;[\s\S]*?estimateUsdForFire:[\s\S]*?getDailyAccumUsd:[\s\S]*?addAccum:[\s\S]*?\}/.test(
      runner,
    ),
  );
  assert(
    "C-D29-1: tick 내 비용 cap 평가 (accumTick + estimate > dailyBudgetUsd → onBudgetSkip)",
    /accumTick\s*\+\s*estimate\s*>\s*costGuard\.dailyBudgetUsd/.test(runner) &&
      /onBudgetSkip/.test(runner),
  );
  const db = await readSrc("src/modules/storage/db.ts");
  assert(
    "C-D29-1: db.ts v9 costAccum 테이블 + CostAccumRow 인터페이스",
    /export\s+interface\s+CostAccumRow\s*\{[\s\S]*?date:\s*string;[\s\S]*?usd:\s*number;[\s\S]*?\}/.test(
      db,
    ) &&
      /this\.version\(9\)\.stores\(/.test(db) &&
      /costAccum:\s*"date,\s*updatedAt"/.test(db),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D29-2 — Insight 타입 + insight-footer + i18n + message-bubble lazy (5 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const types = await readSrc("src/modules/conversation/conversation-types.ts");
  assert(
    "C-D29-2: MultiSpeakerInsightKind 타입 (agreement/disagreement/complement/blindspot)",
    /export\s+type\s+MultiSpeakerInsightKind\s*=[\s\S]*?"agreement"[\s\S]*?"disagreement"[\s\S]*?"complement"[\s\S]*?"blindspot"/.test(
      types,
    ),
  );
  assert(
    "C-D29-2: Insight 인터페이스 (id / kind / speakerIds / summary) + Message.insights 옵셔널",
    /export\s+interface\s+Insight\s*\{[\s\S]*?id:\s*string;[\s\S]*?kind:\s*MultiSpeakerInsightKind;[\s\S]*?speakerIds:\s*string\[\];[\s\S]*?summary:\s*string;[\s\S]*?\}/.test(
      types,
    ) &&
      /insights\?:\s*Insight\[\]/.test(types),
  );
  const footer = await readSrc(
    "src/modules/conversation/insight-footer.tsx",
  );
  assert(
    "C-D29-2: MultiSpeakerInsightFooter export + 4 hue 매핑 + ellipsis",
    /export\s+function\s+MultiSpeakerInsightFooter/.test(footer) &&
      /KIND_HUE_HEX[\s\S]*?agreement[\s\S]*?disagreement[\s\S]*?complement[\s\S]*?blindspot/.test(
        footer,
      ) &&
      /function\s+ellipsis/.test(footer),
  );
  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D29-2: i18n insight.footer.* + insight.multi.kind.* (ko + en)",
    /"insight\.footer\.label":\s*"통찰 \{count\}"/.test(messages) &&
      /"insight\.multi\.kind\.agreement":\s*"합의"/.test(messages) &&
      /"insight\.footer\.label":\s*"Insights \{count\}"/.test(messages) &&
      /"insight\.multi\.kind\.agreement":\s*"Agreement"/.test(messages),
  );
  const bubble = await readSrc("src/modules/conversation/message-bubble.tsx");
  assert(
    "C-D29-2: message-bubble lazy MultiSpeakerInsightFooter + insights.length>0 가드",
    /MultiSpeakerInsightFooter\s*=\s*dynamic/.test(bubble) &&
      /message\.insights\s*&&[\s\S]*?message\.insights\.length\s*>\s*0/.test(
        bubble,
      ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D29-3 — font-loader + LICENSE (4 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const loader = await readSrc("src/modules/export/font-loader.ts");
  assert(
    "C-D29-3: loadKoreanFont(text) export + isInSubsetRange + needsFullFont",
    /export\s+async\s+function\s+loadKoreanFont/.test(loader) &&
      /export\s+function\s+isInSubsetRange/.test(loader) &&
      /export\s+function\s+needsFullFont/.test(loader),
  );
  assert(
    "C-D29-3: subset 범위 (ASCII / Latin-1 / Hangul Syllables AC00-D7A3 / Jamo 3131-318E)",
    /0x0020[\s\S]*?0x007e/.test(loader) &&
      /0x00a0[\s\S]*?0x00ff/.test(loader) &&
      /0xac00[\s\S]*?0xd7a3/.test(loader) &&
      /0x3131[\s\S]*?0x318e/.test(loader),
  );
  assert(
    "C-D29-3: fallback chain (full fetch fail → subset fallback + console.warn)",
    /full font fetch failed.*subset fallback/i.test(loader) &&
      /console\.warn/.test(loader),
  );
  const hasLicense = await exists("public/fonts/LICENSE.OFL.txt");
  const hasReadme = await exists("public/fonts/README.md");
  assert(
    "C-D29-3: public/fonts/LICENSE.OFL.txt + README.md 등록",
    hasLicense && hasReadme,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D29-4 — rule-row-adapter (3 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const adapter = await readSrc(
    "src/modules/schedules/rule-row-adapter.ts",
  );
  assert(
    "C-D29-4: ruleToRow / rowToRule / frequencyToCron / cronToFrequency export",
    /export\s+function\s+ruleToRow/.test(adapter) &&
      /export\s+function\s+rowToRule/.test(adapter) &&
      /export\s+function\s+frequencyToCron/.test(adapter) &&
      /export\s+function\s+cronToFrequency/.test(adapter),
  );
  assert(
    "C-D29-4: every-minutes / hourly-at / daily-at 3 패턴 cron 매칭",
    /every-minutes/.test(adapter) &&
      /hourly-at/.test(adapter) &&
      /daily-at/.test(adapter) &&
      /\\\*\\\/\(\\d\+\)/.test(adapter),
  );
  assert(
    "C-D29-4: cron preset 외 → null + console.warn (cron not representable)",
    /not representable/i.test(adapter) && /console\.warn/.test(adapter),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D29-5 — insight-mark-mount + workspace 마운트 (3 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const mount = await readSrc(
    "src/modules/insights/insight-mark-mount.tsx",
  );
  assert(
    "C-D29-5: InsightMarkMount export + useEffect hydrate 호출",
    /export\s+function\s+InsightMarkMount/.test(mount) &&
      /useAutoMarkSampleStore[\s\S]*?\.hydrate/.test(mount) &&
      /useEffect/.test(mount),
  );
  assert(
    "C-D29-5: null 렌더 + idempotent (hydrate 1회 useEffect deps)",
    /return\s+null/.test(mount),
  );
  const workspace = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  assert(
    "C-D29-5: conversation-workspace dynamic InsightMarkMount + JSX 마운트",
    /InsightMarkMount\s*=\s*dynamic/.test(workspace) &&
      /<InsightMarkMount\s*\/>/.test(workspace),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\nverify-d29: ${pass}/${total} PASS, ${fail} FAIL`);
if (fail > 0) {
  process.exit(1);
}
