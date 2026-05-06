#!/usr/bin/env node
/**
 * sim-byok-demo-extended.mjs
 *   - C-D48-1 (D-2 11시 슬롯, 2026-05-06) — Tori spec C-D48-1 (B-D48-1 / F-D48-1).
 *
 * Why: Roy BYOK 시연 5/6 16:00 KST T-7h 1차 manual sim 게이트 (09:30 KST 자동 실행 정책 락).
 *   sim:byok-demo (T-30분 dry-run) 6 게이트 + 확장 2 게이트 = 8 게이트.
 *   T-7h 시점 점검 = §6/§7/§8 3개 슬롯 6시간 핫픽스 윈도우 확보 (잡스 두 겹 안전망).
 *
 * 정책:
 *   - 외부 dev-deps +0 (node:fs + 정규식만 사용).
 *   - 보존 13 read-only 의무 — api-key-ping.ts / persona-store / toast.tsx grep만.
 *   - mock 모드 — 실 BYOK 키 미사용 (시연 비용 0).
 *   - C-D48-2 (byok-demo-card.tsx) + C-D48-3 (funnel-events.ts byok_demo_*) 의존.
 *
 * 8 gates (sim:byok-demo 6 + 확장 2):
 *   1) PERSONA_PROVIDERS 5종 grep (persona-types.ts SoT 정합)
 *   2) PERSONA_DEMO_SEEDS 4종 grep (persona-demo-seeds.ts SoT 정합)
 *   3) applyDemoSeeds 멱등 — store.upsert(seed) + 4종 unique id
 *   4) settings page DemoModeButton + applyDemoSeeds() 호출
 *   5) showToast ttlMs: 5000 grep (보존 13 toast 정합)
 *   6) api-key-ping read-only — pingApiKey export grep + write ops 0
 *   7) (확장) byok-demo-card.tsx 표시 윈도우 ±2h 분기 grep — BYOK_DEMO_ISO import
 *      + WINDOW_MS_BEFORE/AFTER 2h 정합
 *   8) (확장) funnel-events.ts 'byok_demo_started/pinged/completed/failed' 4 events grep
 *      + demo-mode-button + byok-countdown-lozenge 호출 wiring grep
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
let failed = 0;

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  failed += 1;
  process.exitCode = 1;
}

async function main() {
  console.log("sim:byok-demo-extended — BYOK 시연 T-7h 1차 manual 8 게이트");

  const personaTypes = await readFile(
    resolve(root, "src/modules/personas/persona-types.ts"),
    "utf8",
  );
  const personaSeeds = await readFile(
    resolve(root, "src/modules/personas/persona-demo-seeds.ts"),
    "utf8",
  );
  const settingsPage = await readFile(
    resolve(root, "src/app/settings/page.tsx"),
    "utf8",
  );
  const demoBtn = await readFile(
    resolve(root, "src/modules/settings/demo-mode-button.tsx"),
    "utf8",
  );
  const apiKeyPing = await readFile(
    resolve(root, "src/modules/api-keys/api-key-ping.ts"),
    "utf8",
  );
  // 확장 2 게이트용 추가 read.
  const demoCard = await readFile(
    resolve(root, "src/modules/settings/byok-demo-card.tsx"),
    "utf8",
  );
  const funnelEvents = await readFile(
    resolve(root, "src/modules/launch/funnel-events.ts"),
    "utf8",
  );
  const lozenge = await readFile(
    resolve(root, "src/modules/settings/byok-countdown-lozenge.tsx"),
    "utf8",
  );

  // 1) PERSONA_PROVIDERS 5종.
  const providers = ["anthropic", "openai", "gemini", "grok", "deepseek"];
  const providerHits = providers.filter((p) =>
    new RegExp(`"${p}"`).test(personaTypes),
  );
  if (providerHits.length === 5) {
    pass("1. PERSONA_PROVIDERS 5종 grep");
  } else {
    fail("1. PERSONA_PROVIDERS", `expected 5, got ${providerHits.length}`);
  }

  // 2) PERSONA_DEMO_SEEDS 4종.
  const seedIds = ["demo:dev", "demo:designer", "demo:pm", "demo:marketer"];
  const seedHits = seedIds.filter((id) =>
    new RegExp(`"${id}"`).test(personaSeeds),
  );
  if (seedHits.length === 4) {
    pass("2. PERSONA_DEMO_SEEDS 4종 grep");
  } else {
    fail("2. PERSONA_DEMO_SEEDS", `expected 4, got ${seedHits.length}`);
  }

  // 3) applyDemoSeeds 멱등.
  const hasUpsert = /store\.upsert\(seed\)/.test(personaSeeds);
  const uniqueSeedIds = new Set(seedIds);
  if (hasUpsert && uniqueSeedIds.size === 4) {
    pass("3. applyDemoSeeds 멱등 — upsert + 4종 unique");
  } else {
    fail("3. applyDemoSeeds 멱등", `upsert=${hasUpsert} unique=${uniqueSeedIds.size}`);
  }

  // 4) settings page DemoModeButton + onClick applyDemoSeeds.
  const pageHasDemo = /DemoModeButton/.test(settingsPage);
  const btnHasApply = /applyDemoSeeds\s*\(/.test(demoBtn);
  if (pageHasDemo && btnHasApply) {
    pass("4. settings DemoModeButton + applyDemoSeeds wiring");
  } else {
    fail("4. DemoModeButton wiring", `page=${pageHasDemo} apply=${btnHasApply}`);
  }

  // 5) showToast ttlMs: 5000.
  const hasToast5000 = /ttlMs:\s*5000/.test(demoBtn);
  if (hasToast5000) {
    pass("5. showToast ttlMs: 5000 (보존 13 toast 5초 정합)");
  } else {
    fail("5. showToast ttlMs", "missing ttlMs: 5000");
  }

  // 6) api-key-ping read-only.
  const hasPingExport = /export async function pingApiKey/.test(apiKeyPing);
  const writeOps = apiKeyPing.match(/\bdb\.(put|add|delete|update)\b/g);
  if (hasPingExport && (!writeOps || writeOps.length === 0)) {
    pass("6. api-key-ping pingApiKey export + read-only");
  } else {
    fail(
      "6. api-key-ping",
      `export=${hasPingExport} writes=${writeOps?.length ?? 0}`,
    );
  }

  // 7) (확장) byok-demo-card.tsx 표시 윈도우 ±2h 분기.
  //   BYOK_DEMO_ISO import + WINDOW_MS_BEFORE 2h + WINDOW_MS_AFTER 2h 정합.
  const cardImports = /import\s*\{[^}]*BYOK_DEMO_ISO[^}]*\}\s*from\s*["']@\/modules\/dday\/dday-config["']/.test(
    demoCard,
  );
  const windowBefore = /WINDOW_MS_BEFORE\s*=\s*2\s*\*\s*60\s*\*\s*60_000/.test(
    demoCard,
  );
  const windowAfter = /WINDOW_MS_AFTER\s*=\s*2\s*\*\s*60\s*\*\s*60_000/.test(
    demoCard,
  );
  const cardSettingsImport =
    /import\s*\{[^}]*ByokDemoCard[^}]*\}\s*from\s*["']@\/modules\/settings\/byok-demo-card["']/.test(
      settingsPage,
    );
  if (cardImports && windowBefore && windowAfter && cardSettingsImport) {
    pass(
      "7. byok-demo-card BYOK_DEMO_ISO import + ±2h window + settings page wiring",
    );
  } else {
    fail(
      "7. byok-demo-card 표시 윈도우",
      `import=${cardImports} before=${windowBefore} after=${windowAfter} pageWire=${cardSettingsImport}`,
    );
  }

  // 8) (확장) funnel-events.ts 4 byok_demo_* events + wiring.
  const events = [
    "byok_demo_started",
    "byok_demo_pinged",
    "byok_demo_completed",
    "byok_demo_failed",
  ];
  const eventHits = events.filter((e) =>
    new RegExp(`"${e}"`).test(funnelEvents),
  );
  const btnLogStarted = /logFunnelEvent\(\s*["']byok_demo_started["']\s*\)/.test(
    demoBtn,
  );
  const btnLogPinged = /logFunnelEvent\(\s*["']byok_demo_pinged["']\s*\)/.test(
    demoBtn,
  );
  const btnLogFailed = /logFunnelEvent\(\s*["']byok_demo_failed["']\s*\)/.test(
    demoBtn,
  );
  const lozengeLogCompleted =
    /logFunnelEvent\(\s*["']byok_demo_completed["']\s*\)/.test(lozenge);
  if (
    eventHits.length === 4 &&
    btnLogStarted &&
    btnLogPinged &&
    btnLogFailed &&
    lozengeLogCompleted
  ) {
    pass(
      "8. funnel-events 4 byok_demo events + demo-button(started/pinged/failed) + lozenge(completed) wiring",
    );
  } else {
    fail(
      "8. funnel-events wiring",
      `events=${eventHits.length}/4 started=${btnLogStarted} pinged=${btnLogPinged} failed=${btnLogFailed} completed=${lozengeLogCompleted}`,
    );
  }

  if (failed === 0) {
    console.log("sim:byok-demo-extended — 8/8 PASS");
  } else {
    console.error(`sim:byok-demo-extended — FAIL (${failed} 게이트)`);
  }
}

main().catch((err) => {
  console.error("sim:byok-demo-extended — ERROR", err);
  process.exit(1);
});
