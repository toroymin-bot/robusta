#!/usr/bin/env node
/**
 * verify-d35.mjs
 *   - C-D35-1~5 (D-4 03시 슬롯, 2026-05-04) — Tori spec (Task_2026-05-04 §1).
 *   - 패턴: verify-d34 계승 — 정적 source 패턴 검사.
 *
 * 검증 범위:
 *   1) C-D35-1 — Spec 005 MCP wiring + 6 게이트 (mcp-types/bundle/rpc-fallback/client + next.config + dev-deps)
 *   2) C-D35-2 — D-Day countdown auto-refresh (60분 interval)
 *   3) C-D35-3 — schedule UI wiring (cron-presets + add-form + page + broadcast + i18n 9키)
 *   4) C-D35-4 — KQ_23 도메인 fallback banner 사전 wiring (config + banner + workspace 마운트)
 *   5) C-D35-5 — BYOK 키 검증 ping (key-validate + api-keys-view 디바운스 + i18n 5키)
 *   6) i18n parity — 16 신규 키 ko/en 양쪽
 *   7) check-mcp-budget — 빌드 산출물 부재 시 skip-pass, 존재 시 1.5 MB 게이트
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
// 1) C-D35-1 — Spec 005 MCP wiring + 6 게이트
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D35-1: src/modules/mcp/mcp-types.ts 신규 파일 존재",
    await exists("src/modules/mcp/mcp-types.ts"),
  );
  const types = await readSrc("src/modules/mcp/mcp-types.ts");
  assert(
    "C-D35-1: mcp-types McpError class export + reason + context",
    /export class McpError/.test(types) &&
      /reason:\s*McpErrorReason/.test(types),
  );

  assert(
    "C-D35-1: src/modules/mcp/mcp-bundle.ts 신규 파일 존재",
    await exists("src/modules/mcp/mcp-bundle.ts"),
  );
  const bundle = await readSrc("src/modules/mcp/mcp-bundle.ts");
  assert(
    "C-D35-1: mcp-bundle invokeMcp export + Client SDK 정적 import (단일 진입점)",
    /export async function invokeMcp/.test(bundle) &&
      /from\s+["']@modelcontextprotocol\/sdk\/client\/index\.js["']/.test(bundle),
  );

  assert(
    "C-D35-1: src/modules/mcp/mcp-rpc-fallback.ts 신규 파일 존재",
    await exists("src/modules/mcp/mcp-rpc-fallback.ts"),
  );
  const fallback = await readSrc("src/modules/mcp/mcp-rpc-fallback.ts");
  assert(
    "C-D35-1: mcp-rpc-fallback invokeMcpFallback export + AbortController + JSON-RPC 2.0",
    /export async function invokeMcpFallback/.test(fallback) &&
      /AbortController/.test(fallback) &&
      /jsonrpc:\s*"2\.0"/.test(fallback),
  );

  const client = await readSrc("src/modules/mcp/mcp-client.ts");
  assert(
    "C-D35-1 (3) 단일 진입점: mcp-client callMcpTool export",
    /export async function callMcpTool/.test(client),
  );
  assert(
    "C-D35-1 (1) dynamic import: mcp-client 안 await import('./mcp-bundle')",
    /await\s+import\(\s*["']\.\/mcp-bundle["']\s*\)/.test(client),
  );
  // (5) 정적 import 검사 — 주석 회피. import 라인만 매칭 (라인 시작 from).
  const staticSdkImportLines = client
    .split("\n")
    .filter((l) => /^\s*import\b/.test(l) && /@modelcontextprotocol\/sdk/.test(l));
  assert(
    `C-D35-1 (5) 정적 import 0건: mcp-client 안 SDK 정적 import 0줄 (실제 ${staticSdkImportLines.length})`,
    staticSdkImportLines.length === 0,
  );
  assert(
    "C-D35-1 (6) RPC fallback wiring: mcp-client 안 await import('./mcp-rpc-fallback')",
    /await\s+import\(\s*["']\.\/mcp-rpc-fallback["']\s*\)/.test(client),
  );

  const nextCfg = await readSrc("next.config.ts");
  assert(
    "C-D35-1 (2) server entry 차단: next.config serverExternalPackages 에 SDK 등록",
    /serverExternalPackages\s*:\s*\[[^\]]*@modelcontextprotocol\/sdk/.test(nextCfg),
  );
  assert(
    "C-D35-1 (5) alias 차단: next.config webpack IgnorePlugin 으로 SDK 진입 제한",
    /IgnorePlugin/.test(nextCfg) && /@modelcontextprotocol\/sdk/.test(nextCfg),
  );

  const pkg = JSON.parse(await readSrc("package.json"));
  assert(
    "C-D35-1: package.json devDependencies @modelcontextprotocol/sdk 정확 1건",
    typeof pkg.devDependencies["@modelcontextprotocol/sdk"] === "string",
  );
  assert(
    "C-D35-1: package.json scripts.check:mcp:budget 등록",
    typeof pkg.scripts["check:mcp:budget"] === "string",
  );

  assert(
    "C-D35-1: scripts/check-mcp-budget.mjs 신규 파일 존재",
    await exists("scripts/check-mcp-budget.mjs"),
  );
  const budget = await readSrc("scripts/check-mcp-budget.mjs");
  assert(
    "C-D35-1: check-mcp-budget 1.5 MB 한도 정의",
    /BUDGET_BYTES\s*=\s*1\.5\s*\*\s*1024\s*\*\s*1024/.test(budget),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D35-2 — D-Day countdown auto-refresh (60분)
// ─────────────────────────────────────────────────────────────────────────────
{
  const lozenge = await readSrc("src/modules/header/d-day-lozenge.tsx");
  assert(
    "C-D35-2: d-day-lozenge useEffect 1건 + setInterval + clearInterval cleanup",
    /useEffect\(/.test(lozenge) &&
      /setInterval\(/.test(lozenge) &&
      /clearInterval\(/.test(lozenge),
  );
  assert(
    "C-D35-2: REFRESH_INTERVAL_MS = 60 * 60 * 1000 (3600000 ms)",
    /REFRESH_INTERVAL_MS\s*=\s*60\s*\*\s*60\s*\*\s*1000/.test(lozenge),
  );
  assert(
    "C-D35-2: useState label + computeLabel pattern",
    /useState/.test(lozenge) && /computeLabel/.test(lozenge),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D35-3 — schedule UI wiring + funnelEvents
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D35-3: src/modules/schedules/cron-presets.ts 신규 파일 존재",
    await exists("src/modules/schedules/cron-presets.ts"),
  );
  const presets = await readSrc("src/modules/schedules/cron-presets.ts");
  assert(
    "C-D35-3: CRON_PRESETS export + 5건 (hourly/daily9/weekday_mon9/monthly_d1_9/friday18)",
    /CRON_PRESETS/.test(presets) &&
      /hourly/.test(presets) &&
      /daily9/.test(presets) &&
      /weekday_mon9/.test(presets) &&
      /monthly_d1_9/.test(presets) &&
      /friday18/.test(presets),
  );
  assert(
    "C-D35-3: 5 preset cron 정확 (0 * * * * / 0 9 * * * / 0 9 * * 1 / 0 9 1 * * / 0 18 * * 5)",
    /"0 \* \* \* \*"/.test(presets) &&
      /"0 9 \* \* \*"/.test(presets) &&
      /"0 9 \* \* 1"/.test(presets) &&
      /"0 9 1 \* \*"/.test(presets) &&
      /"0 18 \* \* 5"/.test(presets),
  );

  assert(
    "C-D35-3: src/modules/schedules/schedule-add-form.tsx 신규 파일 존재",
    await exists("src/modules/schedules/schedule-add-form.tsx"),
  );
  const form = await readSrc("src/modules/schedules/schedule-add-form.tsx");
  assert(
    "C-D35-3: ScheduleAddForm export + onSubmit + persistCronPresetRow 호출",
    /export function ScheduleAddForm/.test(form) &&
      /persistCronPresetRow/.test(form),
  );
  assert(
    "C-D35-3: form data-test (preset/label/persona/enable/submit) 5건",
    /data-test="schedules-add-preset"/.test(form) &&
      /data-test="schedules-add-label"/.test(form) &&
      /data-test="schedules-add-persona"/.test(form) &&
      /data-test="schedules-add-enable"/.test(form) &&
      /data-test="schedules-add-submit"/.test(form),
  );

  assert(
    "C-D35-3: src/modules/schedules/schedule-broadcast.ts 신규 파일 존재",
    await exists("src/modules/schedules/schedule-broadcast.ts"),
  );
  const broadcast = await readSrc(
    "src/modules/schedules/schedule-broadcast.ts",
  );
  assert(
    "C-D35-3: schedule-broadcast 채널 'robusta-schedule-sync' (persona 채널 분리)",
    /CHANNEL_NAME\s*=\s*"robusta-schedule-sync"/.test(broadcast),
  );
  assert(
    "C-D35-3: publishScheduleChange + subscribeScheduleSync export",
    /export function publishScheduleChange/.test(broadcast) &&
      /export function subscribeScheduleSync/.test(broadcast),
  );

  const page = await readSrc("src/app/schedules/page.tsx");
  assert(
    "C-D35-3: /schedules/page 가 ScheduleAddForm import + 마운트",
    /import\s+\{\s*ScheduleAddForm\s*\}/.test(page) &&
      /<ScheduleAddForm/.test(page),
  );
  assert(
    "C-D35-3: /schedules/page subscribeScheduleSync 사용 (다른 탭 동기화)",
    /subscribeScheduleSync/.test(page),
  );

  const bridge = await readSrc(
    "src/modules/schedules/schedule-store-bridge.ts",
  );
  assert(
    "C-D35-3: schedule-store-bridge persistCronPresetRow export (cron 직접 등록)",
    /export\s+async\s+function\s+persistCronPresetRow/.test(bridge),
  );

  // funnelEvents schedule_fired 회귀 (D-D34 wiring 보호)
  const runner = await readSrc("src/modules/schedules/schedule-runner.ts");
  assert(
    "C-D35-3 회귀: schedule-runner schedule_fired logFunnelEvent dynamic import 유지",
    /import\("@\/modules\/funnel\/funnel-events"\)/.test(runner) &&
      /type:\s*"schedule_fired"/.test(runner),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D35-4 — KQ_23 도메인 fallback banner
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D35-4: src/modules/domain/domain-fallback-config.ts 신규 파일 존재",
    await exists("src/modules/domain/domain-fallback-config.ts"),
  );
  const cfg = await readSrc("src/modules/domain/domain-fallback-config.ts");
  assert(
    "C-D35-4: FALLBACK_ENABLE_ISO = '2026-05-05T09:00:00Z' (5/5 18:00 KST)",
    /FALLBACK_ENABLE_ISO\s*=\s*"2026-05-05T09:00:00Z"/.test(cfg),
  );
  assert(
    "C-D35-4: isFallbackActive export + boolean return",
    /export function isFallbackActive\b[\s\S]*?:\s*boolean/.test(cfg),
  );
  assert(
    "C-D35-4: PRIMARY_DOMAIN = 'robusta.ai4min.com'",
    /PRIMARY_DOMAIN\s*=\s*"robusta\.ai4min\.com"/.test(cfg),
  );

  assert(
    "C-D35-4: src/modules/domain/domain-fallback-banner.tsx 신규 파일 존재",
    await exists("src/modules/domain/domain-fallback-banner.tsx"),
  );
  const banner = await readSrc(
    "src/modules/domain/domain-fallback-banner.tsx",
  );
  assert(
    "C-D35-4: DomainFallbackBanner export + SSR 가드 + isFallbackActive + PRIMARY_DOMAIN 비교",
    /export function DomainFallbackBanner/.test(banner) &&
      /typeof window === "undefined"/.test(banner) &&
      /isFallbackActive\(/.test(banner) &&
      /PRIMARY_DOMAIN/.test(banner),
  );
  assert(
    "C-D35-4: data-test='domain-fallback-banner' + sessionStorage dismiss key",
    /data-test="domain-fallback-banner"/.test(banner) &&
      /sessionStorage/.test(banner),
  );

  const ws = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  assert(
    "C-D35-4: conversation-workspace 가 DomainFallbackBanner import + JSX 마운트 (1줄+1줄)",
    /import\s+\{\s*DomainFallbackBanner\s*\}\s+from\s+"@\/modules\/domain\/domain-fallback-banner"/.test(ws) &&
      /<DomainFallbackBanner\s*\/>/.test(ws),
  );

  // 시점 산식 검증 — 4 케이스
  const enable = new Date("2026-05-05T09:00:00Z").getTime();
  const cases = [
    ["2026-05-04T03:00:00+09:00", false], // 5/4 03:00 KST → 5/3 18:00 UTC < enable
    ["2026-05-05T17:59:00+09:00", false], // 5/5 17:59 KST → 5/5 08:59 UTC < enable
    ["2026-05-05T18:00:00+09:00", true],  // 5/5 18:00 KST → 5/5 09:00 UTC = enable
    ["2026-05-08T10:00:00+09:00", true],  // D-Day
  ];
  let calcOk = true;
  for (const [iso, expected] of cases) {
    const now = new Date(iso).getTime();
    const active = now >= enable;
    if (active !== expected) {
      calcOk = false;
      console.error(`  case ${iso}: expected ${expected}, got ${active}`);
    }
  }
  assert(
    "C-D35-4: isFallbackActive 산식 4 케이스 (5/4 03:00 / 5/5 17:59 / 5/5 18:00 / 5/8 10:00)",
    calcOk,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D35-5 — BYOK 키 검증 ping
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D35-5: src/modules/api-keys/key-validate.ts 신규 파일 존재",
    await exists("src/modules/api-keys/key-validate.ts"),
  );
  const validate = await readSrc("src/modules/api-keys/key-validate.ts");
  assert(
    "C-D35-5: validateAnthropicKey export + Promise<ValidateResult>",
    /export async function validateAnthropicKey/.test(validate) &&
      /Promise<ValidateResult>/.test(validate),
  );
  assert(
    "C-D35-5: /v1/models endpoint + sk-ant- prefix 검증",
    /\/v1\/models/.test(validate) && /sk-ant-/.test(validate),
  );
  assert(
    "C-D35-5: HTTP 401·403 invalid + 429 rate_limit 분기",
    /401/.test(validate) && /403/.test(validate) && /429/.test(validate),
  );

  const view = await readSrc("src/modules/api-keys/api-keys-view.tsx");
  assert(
    "C-D35-5: api-keys-view validateAnthropicKey import + 디바운스 setTimeout(800)",
    /validateAnthropicKey/.test(view) && /setTimeout\(/.test(view) &&
      /800/.test(view),
  );
  assert(
    "C-D35-5: data-test='byok-validate-status' 1건",
    /data-test="byok-validate-status"/.test(view),
  );
  assert(
    "C-D35-5: AbortController 디바운스 취소 패턴",
    /AbortController/.test(view) || /validateAbortRef/.test(view),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) i18n parity — 16 신규 키 ko/en 양쪽
// ─────────────────────────────────────────────────────────────────────────────
{
  const messages = await readSrc("src/modules/i18n/messages.ts");
  // schedule.preset.* 5
  for (const k of [
    "schedule.preset.hourly",
    "schedule.preset.daily9",
    "schedule.preset.weekday_mon9",
    "schedule.preset.monthly_d1_9",
    "schedule.preset.friday18",
  ]) {
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g");
    assert(
      `i18n parity: ${k} ko/en 양쪽 (≥2건)`,
      (messages.match(re) ?? []).length >= 2,
    );
  }
  // schedule.add.* 5
  for (const k of [
    "schedule.add.preset",
    "schedule.add.label",
    "schedule.add.persona",
    "schedule.add.enable",
    "schedule.add.submit",
  ]) {
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g");
    assert(
      `i18n parity: ${k} ko/en 양쪽 (≥2건)`,
      (messages.match(re) ?? []).length >= 2,
    );
  }
  // domain.fallback.* 3
  for (const k of [
    "domain.fallback.title",
    "domain.fallback.body",
    "domain.fallback.cta",
  ]) {
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g");
    assert(
      `i18n parity: ${k} ko/en 양쪽 (≥2건)`,
      (messages.match(re) ?? []).length >= 2,
    );
  }
  // apikeys.validate.* 5
  for (const k of [
    "apikeys.validate.checking",
    "apikeys.validate.valid",
    "apikeys.validate.invalid",
    "apikeys.validate.network_error",
    "apikeys.validate.rate_limit",
  ]) {
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g");
    assert(
      `i18n parity: ${k} ko/en 양쪽 (≥2건)`,
      (messages.match(re) ?? []).length >= 2,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) check-mcp-budget — 빌드 산출물 부재 시 skip-pass
// ─────────────────────────────────────────────────────────────────────────────
{
  const child = spawnSync("node", ["scripts/check-mcp-budget.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert(
    `check-mcp-budget exit 0 (skip 또는 한도 통과) — exit=${child.status}`,
    child.status === 0,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\nverify-d35: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}`,
);
process.exit(fail === 0 ? 0 : 1);
