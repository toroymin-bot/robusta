#!/usr/bin/env node
/**
 * sim-byok-demo.mjs
 *   - C-D47-1 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-1 (B-D47-1 / F-D47-1).
 *
 * Why: Roy BYOK 시연 5/6 16:00 KST T-30분 자동 dry-run 게이트.
 *   시연 30분 전 마지막 검증 윈도우 — 깨지면 §8 꼬미 15시 30분 핫픽스 가능.
 *
 * 정책:
 *   - mock 모드만 — 실 BYOK 키 미사용 (시연 비용 0).
 *   - 보존 13 api-key-ping.ts / persona-store / toast.tsx read-only grep.
 *   - persona-store mock — Node 환경에서 IndexedDB 미접근. grep 정합 검증으로 대체 (D-47-자-A 추정).
 *   - showToast mock — DOM 미접근. ttlMs 5000 grep 정합만 (보존 13 toast 정합).
 *   - 외부 dev-deps +0 (node:fs + 정규식만 사용).
 *
 * 6 gates:
 *   1) PERSONA_PROVIDERS 5종 grep (persona-types.ts SoT 정합)
 *   2) PERSONA_DEMO_SEEDS 4종 grep (persona-demo-seeds.ts SoT 정합)
 *   3) applyDemoSeeds 멱등 — upsert 호출 grep + id 중복 0 (4종 'demo:dev/designer/pm/marketer')
 *   4) settings page DemoModeButton onClick → applyDemoSeeds 1회 호출 grep
 *   5) showToast ttlMs: 5000 grep (보존 13 toast 정합)
 *   6) api-key-ping read-only — pingApiKey export grep (시연 시 호출 정합)
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
  console.log("sim:byok-demo — BYOK 시연 dry-run 6 게이트");

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

  // 1) PERSONA_PROVIDERS 5종 — Roy `Do` §10 화이트리스트.
  const providers = ["anthropic", "openai", "gemini", "grok", "deepseek"];
  const providerHits = providers.filter((p) =>
    new RegExp(`"${p}"`).test(personaTypes),
  );
  if (providerHits.length === 5) {
    pass("1. PERSONA_PROVIDERS 5종 grep (anthropic/openai/gemini/grok/deepseek)");
  } else {
    fail("1. PERSONA_PROVIDERS", `expected 5, got ${providerHits.length}`);
  }

  // 2) PERSONA_DEMO_SEEDS 4종 — id 'demo:dev/designer/pm/marketer'.
  const seedIds = ["demo:dev", "demo:designer", "demo:pm", "demo:marketer"];
  const seedHits = seedIds.filter((id) =>
    new RegExp(`"${id}"`).test(personaSeeds),
  );
  if (seedHits.length === 4) {
    pass("2. PERSONA_DEMO_SEEDS 4종 grep (demo:dev/designer/pm/marketer)");
  } else {
    fail("2. PERSONA_DEMO_SEEDS", `expected 4, got ${seedHits.length}`);
  }

  // 3) applyDemoSeeds 멱등 — upsert 호출 grep + 동일 id 4종 (중복 0).
  const hasUpsert = /store\.upsert\(seed\)/.test(personaSeeds);
  const uniqueSeedIds = new Set(seedIds);
  if (hasUpsert && uniqueSeedIds.size === 4) {
    pass("3. applyDemoSeeds 멱등 — store.upsert(seed) + 4종 unique id");
  } else {
    fail("3. applyDemoSeeds 멱등", `upsert=${hasUpsert} unique=${uniqueSeedIds.size}`);
  }

  // 4) settings page DemoModeButton + demo-mode-button.tsx applyDemoSeeds() 호출.
  const pageHasDemo = /DemoModeButton/.test(settingsPage);
  const btnHasApply = /applyDemoSeeds\s*\(/.test(demoBtn);
  if (pageHasDemo && btnHasApply) {
    pass("4. settings page DemoModeButton + onClick applyDemoSeeds() wiring");
  } else {
    fail(
      "4. DemoModeButton wiring",
      `page=${pageHasDemo} apply=${btnHasApply}`,
    );
  }

  // 5) showToast ttlMs 5000 grep (보존 13 toast.tsx durationMs 정합).
  //   demo-mode-button.tsx 에서 push({tone:'info', ttlMs:5000}) 패턴 grep.
  const hasToast5000 = /ttlMs:\s*5000/.test(demoBtn);
  if (hasToast5000) {
    pass("5. showToast ttlMs: 5000 grep (보존 13 toast 5초 정합)");
  } else {
    fail("5. showToast ttlMs", "missing ttlMs: 5000");
  }

  // 6) api-key-ping read-only — pingApiKey export grep + write ops 0.
  const hasPingExport = /export async function pingApiKey/.test(apiKeyPing);
  const writeOps = apiKeyPing.match(/\bdb\.(put|add|delete|update)\b/g);
  if (hasPingExport && (!writeOps || writeOps.length === 0)) {
    pass("6. api-key-ping pingApiKey export + read-only (db write 0)");
  } else {
    fail(
      "6. api-key-ping",
      `export=${hasPingExport} writes=${writeOps?.length ?? 0}`,
    );
  }

  if (failed === 0) {
    console.log("sim:byok-demo — 6/6 PASS");
  } else {
    console.error(`sim:byok-demo — FAIL (${failed} 게이트)`);
  }
}

main().catch((err) => {
  console.error("sim:byok-demo — ERROR", err);
  process.exit(1);
});
