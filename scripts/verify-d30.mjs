#!/usr/bin/env node
/**
 * verify-d30.mjs
 *   - C-D30-1~5 (D-5 07시 슬롯, 2026-05-03) — Tori spec, D-D30 5건 통합 회귀 게이트.
 *   - verify-d29 패턴 계승 (정적 source pattern 검사). 168 정식 HARD GATE 는 verify-d27 담당.
 *
 * 검증 범위 (총 26+ assertion, 명세 §7 verify 케이스 6+4+5+5+6 매핑):
 *   1) C-D30-1 — cost-cap-store / widget / badge + i18n 6키 (6 assertion)
 *   2) C-D30-2 — cost-broadcast + schedule-runner wiring (4 assertion)
 *   3) C-D30-3 — schedule-store-bridge persistRule / loadRules / deleteRule (5 assertion)
 *   4) C-D30-4 — build-fonts.mjs + package.json scripts (5 assertion)
 *   5) C-D30-5 — insight-parser + conversation-api wiring + system-prompt-composer 마크업 규칙 (6 assertion)
 *   합계: 26 assertion (명세 §7 목표 충족)
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
// 1) C-D30-1 — cost-cap-store / widget / badge + i18n 6키 (6 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const store = await readSrc("src/modules/cost-cap/cost-cap-store.ts");
  assert(
    "C-D30-1: useCostCap 훅 export + UseCostCapState (dailyUsd / capUsd / pct / resetAtKst / hydrated)",
    /export\s+function\s+useCostCap/.test(store) &&
      /dailyUsd:\s*number/.test(store) &&
      /capUsd:\s*number/.test(store) &&
      /pct:\s*number/.test(store) &&
      /resetAtKst:\s*string/.test(store) &&
      /hydrated:\s*boolean/.test(store),
  );
  assert(
    "C-D30-1: pctToTone (>95 error / >=80 warning / <80 info) + clampPct 0~100",
    /export\s+function\s+pctToTone/.test(store) &&
      /pct\s*>\s*95.*"error"/s.test(store) &&
      /pct\s*>=\s*80.*"warning"/s.test(store) &&
      /export\s+function\s+clampPct/.test(store),
  );
  const widget = await readSrc("src/modules/cost-cap/cost-cap-widget.tsx");
  assert(
    "C-D30-1: CostCapWidget export + Donut SVG + tone color 분기 (red-600 / amber-600 / blue-600)",
    /export\s+function\s+CostCapWidget/.test(widget) &&
      /function\s+Donut/.test(widget) &&
      /#dc2626/.test(widget) &&
      /#d97706/.test(widget) &&
      /#2563eb/.test(widget),
  );
  const badge = await readSrc("src/modules/cost-cap/cost-cap-badge.tsx");
  assert(
    "C-D30-1: CostCapBadge export + 16×16 SVG donut + tooltip ($x/$y reset)",
    /export\s+function\s+CostCapBadge/.test(badge) &&
      /BADGE_SIZE\s*=\s*16/.test(badge) &&
      /title=\{tooltipText\}/.test(badge),
  );
  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D30-1: i18n cost.cap.* 6키 ko (title / subtitle / current / reset / tooltip / warn)",
    /"cost\.cap\.title":\s*"BYOK 일일 비용 한도"/.test(messages) &&
      /"cost\.cap\.subtitle":\s*"당신의 키, 당신의 한도/.test(messages) &&
      /"cost\.cap\.current":\s*"\{current\} \/ \{cap\}"/.test(messages) &&
      /"cost\.cap\.reset":\s*"자정 \{time\} KST 리셋"/.test(messages) &&
      /"cost\.cap\.tooltip":\s*"비용 한도 \{pct\}% 사용"/.test(messages) &&
      /"cost\.cap\.warn":\s*"비용 한도 \{pct\}% 도달/.test(messages),
  );
  assert(
    "C-D30-1: i18n cost.cap.* 6키 en parity",
    /"cost\.cap\.title":\s*"BYOK daily cost cap"/.test(messages) &&
      /"cost\.cap\.subtitle":\s*"Your key, your cap/.test(messages) &&
      /"cost\.cap\.reset":\s*"Resets at \{time\} KST/.test(messages) &&
      /"cost\.cap\.tooltip":\s*"Cost cap \{pct\}% used"/.test(messages) &&
      /"cost\.cap\.warn":\s*"Cost cap \{pct\}% reached/.test(messages),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D30-2 — cost-broadcast + schedule-runner wiring (4 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const broadcast = await readSrc("src/modules/cost-cap/cost-broadcast.ts");
  assert(
    "C-D30-2: COST_BROADCAST_CHANNEL='robusta.cost' + CostBroadcastMessage 타입",
    /COST_BROADCAST_CHANNEL\s*=\s*"robusta\.cost"/.test(broadcast) &&
      /interface\s+CostBroadcastMessage[\s\S]*?type:\s*"cost-update"[\s\S]*?date:\s*string[\s\S]*?usd:\s*number/.test(
        broadcast,
      ),
  );
  assert(
    "C-D30-2: broadcastCostUpdate / subscribeCostUpdates export + 미지원 환경 가드 + console.warn 1회",
    /export\s+function\s+broadcastCostUpdate/.test(broadcast) &&
      /export\s+function\s+subscribeCostUpdates/.test(broadcast) &&
      /typeof\s+BroadcastChannel\s*!==\s*"undefined"/.test(broadcast) &&
      /warnedUnsupported/.test(broadcast),
  );
  assert(
    "C-D30-2: subscribe 자정 경계 race 방어 (date !== today 무시) + 잘못된 메시지 무시",
    /msg\.date\s*!==\s*today/.test(broadcast) &&
      /typeof\s+msg\.usd\s*!==\s*"number"/.test(broadcast),
  );
  const runner = await readSrc("src/modules/schedules/schedule-runner.ts");
  assert(
    "C-D30-2: schedule-runner addAccum 후 broadcastCostUpdate 호출 (dynamic import)",
    /broadcastCostUpdate/.test(runner) &&
      /import\(["']@\/modules\/cost-cap\/cost-broadcast["']\)/.test(runner),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D30-3 — schedule-store-bridge (5 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const bridge = await readSrc(
    "src/modules/schedules/schedule-store-bridge.ts",
  );
  assert(
    "C-D30-3: persistRule / loadRules / deleteRule / generateRuleId export",
    /export\s+async\s+function\s+persistRule/.test(bridge) &&
      /export\s+async\s+function\s+loadRules/.test(bridge) &&
      /export\s+async\s+function\s+deleteRule/.test(bridge) &&
      /export\s+function\s+generateRuleId/.test(bridge),
  );
  assert(
    "C-D30-3: persistRule = ruleToRow + db.schedules.put",
    /ruleToRow\s*\(/.test(bridge) && /db\.schedules\.put/.test(bridge),
  );
  assert(
    "C-D30-3: loadRules = db.schedules.toArray + rowToRule + custom cron filter (null skip)",
    /db\.schedules\.toArray/.test(bridge) &&
      /rowToRule\s*\(/.test(bridge) &&
      /if\s*\(rule\)\s*rules\.push/.test(bridge),
  );
  assert(
    "C-D30-3: deleteRule = db.schedules.delete(id) + 빈 id noop",
    /db\.schedules\.delete\(id\)/.test(bridge) && /if\s*\(!id\)\s*return/.test(bridge),
  );
  assert(
    "C-D30-3: SSR 가드 (typeof window === 'undefined')",
    /typeof\s+window\s*===\s*"undefined"/.test(bridge),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D30-4 — build-fonts.mjs + package.json (5 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const exists1 = await exists("scripts/build-fonts.mjs");
  assert("C-D30-4: scripts/build-fonts.mjs 존재", exists1);
  if (exists1) {
    const script = await readSrc("scripts/build-fonts.mjs");
    assert(
      "C-D30-4: pyftsubset 검증 + 미설치 안내 + exit 1",
      /pyftsubset/.test(script) &&
        /pip install fonttools brotli/.test(script) &&
        /process\.exit\(1\)/.test(script),
    );
    assert(
      "C-D30-4: subset unicodes (ASCII / Latin-1 / Hangul Syllables / Jamo)",
      /U\+0020-007E/.test(script) &&
        /U\+00A0-00FF/.test(script) &&
        /U\+AC00-D7A3/.test(script) &&
        /U\+3131-318E/.test(script),
    );
    assert(
      "C-D30-4: sha256 검증 + SHA256SUMS 파일 갱신 + 3회 retry",
      /createHash\(["']sha256["']\)/.test(script) &&
        /SHA256SUMS/.test(script) &&
        /MAX_RETRIES\s*=\s*3/.test(script),
    );
  } else {
    assert("C-D30-4: build-fonts.mjs 본문 검증 (skip — file missing)", false);
    assert("C-D30-4: subset unicodes (skip — file missing)", false);
    assert("C-D30-4: sha256 검증 (skip — file missing)", false);
  }
  const pkg = await readSrc("package.json");
  assert(
    "C-D30-4: package.json scripts.build:fonts + verify:d30 등록",
    /"build:fonts":\s*"node scripts\/build-fonts\.mjs"/.test(pkg) &&
      /"verify:d30":\s*"node scripts\/verify-d30\.mjs"/.test(pkg),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D30-5 — insight-parser + conversation-api wiring + system-prompt 마크업 규칙 (6 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const parser = await readSrc(
    "src/modules/conversation/insight-parser.ts",
  );
  assert(
    "C-D30-5: parseInsights export + INSIGHT_REGEX (4 kind 캡처 + non-greedy + s flag)",
    /export\s+function\s+parseInsights/.test(parser) &&
      /agreement\|disagreement\|complement\|blindspot/.test(parser) &&
      parser.includes("[\\/insight\\]") &&
      /\[\\s\\S\]\*\?/.test(parser),
  );
  assert(
    "C-D30-5: VALID_KINDS 4종 (agreement/disagreement/complement/blindspot) + escape lookbehind",
    /VALID_KINDS[\s\S]*?agreement[\s\S]*?disagreement[\s\S]*?complement[\s\S]*?blindspot/.test(
      parser,
    ) && parser.includes("(?<!\\\\)"),
  );
  assert(
    "C-D30-5: SUMMARY_MAX_CHARS=100 + ELLIPSIS '…' + truncateSummary",
    /SUMMARY_MAX_CHARS\s*=\s*100/.test(parser) &&
      /ELLIPSIS\s*=\s*"…"/.test(parser) &&
      /function\s+truncateSummary/.test(parser),
  );
  assert(
    "C-D30-5: cleanText 누적 (text.slice + lastIndex) + insights speakerIds=[speakerId]",
    /text\.slice\(lastIndex,\s*match\.index\)/.test(parser) &&
      /speakerIds:\s*\[speakerId\]/.test(parser),
  );
  const api = await readSrc("src/modules/conversation/conversation-api.ts");
  assert(
    "C-D30-5: conversation-api parseMessageInsights helper export + parseInsights import",
    /import\s+\{\s*parseInsights\s+as\s+parseInsightsRaw\s*\}\s+from\s+["']\.\/insight-parser["']/.test(
      api,
    ) && /export\s+function\s+parseMessageInsights/.test(api),
  );
  const composer = await readSrc(
    "src/modules/conversation/system-prompt-composer.ts",
  );
  assert(
    "C-D30-5: system-prompt-composer 통찰 마크업 규칙 1단락 (ko + en)",
    /통찰 마크업/.test(composer) &&
      /\[!insight:kind\]요약\[\/insight\]/.test(composer) &&
      /Insight markup/.test(composer) &&
      /\[!insight:kind\]summary\[\/insight\]/.test(composer),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\nverify-d30: ${pass}/${total} PASS, ${fail} FAIL`);
if (fail > 0) {
  process.exit(1);
}
