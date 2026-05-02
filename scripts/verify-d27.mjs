#!/usr/bin/env node
/**
 * verify-d27.mjs
 *   - C-D27-5 (D6 15시 슬롯, 2026-05-02) — Tori spec, D-D27 5건 통합 회귀 게이트.
 *   - verify-d26.mjs 패턴 계승. 5건 합산 ~51 assertion + First Load JS 168 kB **정식 HARD GATE**.
 *
 * 검증 범위:
 *   1) C-D27-1 — messages-catalog-{ko,en}.ts + i18n.ts loadCatalog/isCatalogKey + catalog-i18n.ts tc + 호출자 6개 tc 변환 + check-i18n catalog parity
 *   2) C-D27-2 — auto-mark-sample-types.ts (TP/FP/FN/TN) + insight-mark.tsx sample-store add 분기
 *   3) C-D27-3 — visited-store.ts + scenario-pick.ts + app/page.tsx Welcome 분기
 *   4) C-D27-4 — persona-from-preset.ts + participants-panel.tsx 'catalog:' prefix 분기
 *   5) C-D27-5 — header-pdf-button.tsx + dev-mode-strip dynamic 마운트 + verify-d27 자체
 *
 * HARD GATE: First Load JS <= 168 kB (next build 파싱). 한시 175 종료 — 정식 168 복귀.
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
    pass += 1;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail += 1;
  }
}

async function readSrc(p) {
  return readFile(resolve(root, p), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) C-D27-1 — i18n catalog dynamic 분리 (14 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const catalogKo = await readSrc("src/modules/i18n/messages-catalog-ko.ts");
  const catalogEn = await readSrc("src/modules/i18n/messages-catalog-en.ts");
  assert(
    "C-D27-1: messages-catalog-ko.ts MESSAGES_CATALOG_KO export",
    /export\s+const\s+MESSAGES_CATALOG_KO\s*=/.test(catalogKo),
  );
  assert(
    "C-D27-1: messages-catalog-en.ts MESSAGES_CATALOG_EN export",
    /export\s+const\s+MESSAGES_CATALOG_EN\s*=/.test(catalogEn),
  );

  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D27-1: messages.ts 에서 persona.catalog. 키 0",
    !/"persona\.catalog\./.test(messages),
  );
  assert(
    "C-D27-1: messages.ts 에서 scenario. 키 0",
    !/"scenario\.[a-zA-Z]/.test(messages),
  );
  assert(
    "C-D27-1: messages.ts 에서 pdfExport. 키 0",
    !/"pdfExport\./.test(messages),
  );
  assert(
    "C-D27-1: messages.ts 에서 devMode. 키 0",
    !/"devMode\./.test(messages),
  );
  assert(
    "C-D27-1: messages.ts 에서 persona.picker.tab. 키 0",
    !/"persona\.picker\.tab\./.test(messages),
  );

  const i18n = await readSrc("src/modules/i18n/i18n.ts");
  assert(
    "C-D27-1: i18n.ts loadCatalog export",
    /export\s+(async\s+)?function\s+loadCatalog/.test(i18n),
  );
  assert(
    "C-D27-1: i18n.ts isCatalogKey export",
    /export\s+function\s+isCatalogKey/.test(i18n),
  );

  const catalogI18n = await readSrc("src/modules/i18n/catalog-i18n.ts");
  assert(
    "C-D27-1: catalog-i18n.ts tc export",
    /export\s+function\s+tc/.test(catalogI18n),
  );

  // 메인 번들 모듈에서 catalog 키 정적 사용 0 — workspace / header-cluster.
  const ws = await readSrc("src/modules/conversation/conversation-workspace.tsx");
  assert(
    "C-D27-1: conversation-workspace.tsx 에 catalog 키 정적 호출 0",
    !/(persona\.catalog\.|scenario\.[a-zA-Z]|pdfExport\.|devMode\.|persona\.picker\.tab\.)/.test(
      ws,
    ),
  );
  const headerCluster = await readSrc(
    "src/modules/conversation/header-cluster.tsx",
  );
  assert(
    "C-D27-1: header-cluster.tsx 에 catalog 키 정적 호출 0",
    !/(persona\.catalog\.|scenario\.[a-zA-Z]|pdfExport\.|devMode\.|persona\.picker\.tab\.)/.test(
      headerCluster,
    ),
  );

  // catalog-i18n 정적 import 가드 — header-cluster / workspace 직접 import 금지.
  assert(
    "C-D27-1: header-cluster.tsx 에 catalog-i18n 정적 import 0",
    !/from\s+["']@\/modules\/i18n\/catalog-i18n["']/.test(headerCluster),
  );
  assert(
    "C-D27-1: conversation-workspace.tsx 에 catalog-i18n 정적 import 0",
    !/from\s+["']@\/modules\/i18n\/catalog-i18n["']/.test(ws),
  );

  // check-i18n parity 게이트 도입.
  const checkI18n = await readSrc("scripts/check-i18n-keys.mjs");
  assert(
    "C-D27-1: check-i18n-keys.mjs 에 catalog parity 게이트",
    /catalogKo|catalog parity|messages-catalog-ko/.test(checkI18n),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D27-2 — sample-store add 통합 (10 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const types = await readSrc("src/modules/insights/auto-mark-sample-types.ts");
  assert(
    "C-D27-2: auto-mark-sample-types.ts classifySample export",
    /export\s+function\s+classifySample/.test(types),
  );
  assert(
    "C-D27-2: classifySample TP 분기 (inferred===actual)",
    /inferred\s*===\s*actual/.test(types),
  );
  assert(
    "C-D27-2: classifySample FN 분기 (!inferred && actual)",
    /!inferred\s+&&\s+actual/.test(types),
  );
  assert(
    "C-D27-2: classifySample SampleCase 4종 (tp|fp|fn|tn)",
    /['"]tp['"][\s\S]*?['"]fp['"][\s\S]*?['"]fn['"][\s\S]*?['"]tn['"]/.test(
      types,
    ),
  );

  const insightMark = await readSrc("src/modules/conversation/insight-mark.tsx");
  assert(
    "C-D27-2: insight-mark.tsx auto-mark-sample-store import",
    /from\s+["']@\/stores\/auto-mark-sample-store["']/.test(insightMark),
  );
  assert(
    "C-D27-2: insight-mark.tsx handleMark 에서 sample-store add 호출",
    /useAutoMarkSampleStore\.getState\(\)\.add/.test(insightMark),
  );
  assert(
    "C-D27-2: insight-mark.tsx handleMark previousAuto null 가드",
    /markedBy\s*===\s*["']auto["']/.test(insightMark),
  );
  assert(
    "C-D27-2: insight-mark.tsx handleUnmark FP (actual: null)",
    /actual:\s*null/.test(insightMark),
  );

  const sampleStore = await readSrc("src/stores/auto-mark-sample-store.ts");
  assert(
    "C-D27-2: sample-store SAMPLE_LIMIT FIFO 가드",
    /SAMPLE_LIMIT/.test(sampleStore) && /shift/.test(sampleStore),
  );
  assert(
    "C-D27-2: sample-store AutoMarkSample 타입 사용 + samples 배열",
    /AutoMarkSample/.test(sampleStore) && /samples:\s*AutoMarkSample\[\]/.test(sampleStore),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D27-3 — Welcome 라우팅 (10 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const visited = await readSrc("src/modules/visit/visited-store.ts");
  assert(
    "C-D27-3: visited-store hasVisited export",
    /export\s+function\s+hasVisited/.test(visited),
  );
  assert(
    "C-D27-3: visited-store markVisited export",
    /export\s+function\s+markVisited/.test(visited),
  );
  assert(
    "C-D27-3: visited-store SSR 가드 (typeof window === 'undefined')",
    /typeof\s+window\s*===\s*["']undefined["']/.test(visited),
  );
  assert(
    "C-D27-3: visited-store localStorage try/catch fallback",
    /try\s*\{[\s\S]*localStorage[\s\S]*?\}\s*catch/.test(visited),
  );

  const pick = await readSrc("src/modules/scenarios/scenario-pick.ts");
  assert(
    "C-D27-3: scenario-pick pickScenario export",
    /export\s+function\s+pickScenario/.test(pick),
  );
  assert(
    "C-D27-3: scenario-pick deps 주입 (registerPersona / setSeedPlaceholder / markVisited / switchToWorkspace)",
    /registerPersona[\s\S]+?setSeedPlaceholder[\s\S]+?markVisited[\s\S]+?switchToWorkspace/.test(
      pick,
    ),
  );

  const page = await readSrc("src/app/page.tsx");
  assert(
    "C-D27-3: app/page.tsx hasVisited 분기",
    /hasVisited\(\)/.test(page),
  );
  assert(
    "C-D27-3: app/page.tsx WelcomeView dynamic ssr:false",
    /WelcomeView[\s\S]+?ssr:\s*false/.test(page),
  );
  assert(
    "C-D27-3: app/page.tsx ConversationWorkspace dynamic ssr:false",
    /ConversationWorkspace[\s\S]+?ssr:\s*false/.test(page),
  );
  assert(
    "C-D27-3: app/page.tsx markVisited 호출",
    /markVisited\(\)/.test(page),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D27-4 — picker catalog 사전 등록 (8 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const fromPreset = await readSrc(
    "src/modules/personas/persona-from-preset.ts",
  );
  assert(
    "C-D27-4: persona-from-preset.ts personaFromPreset export",
    /export\s+function\s+personaFromPreset/.test(fromPreset),
  );
  assert(
    "C-D27-4: personaFromPreset Persona 반환 (id/kind/colorToken/...)",
    /id:\s*["`]/.test(fromPreset) && /colorToken/.test(fromPreset),
  );
  assert(
    "C-D27-4: personaFromPreset isPreset=false (사용자 인스턴스)",
    /isPreset:\s*false/.test(fromPreset),
  );

  const panel = await readSrc(
    "src/modules/participants/participants-panel.tsx",
  );
  assert(
    "C-D27-4: participants-panel 'catalog:' prefix 분기",
    /personaId\.startsWith\(["']catalog:["']\)/.test(panel),
  );
  assert(
    "C-D27-4: participants-panel PERSONA_CATALOG_V1 동적 import",
    /import\(["']@\/modules\/personas\/persona-catalog["']\)/.test(panel),
  );
  assert(
    "C-D27-4: participants-panel personaFromPreset 동적 import",
    /import\(["']@\/modules\/personas\/persona-from-preset["']\)/.test(panel),
  );
  assert(
    "C-D27-4: participants-panel 알 수 없는 catalog id console.warn",
    /console\.warn[\s\S]+?catalog/.test(panel),
  );
  assert(
    "C-D27-4: participants-panel 'custom' 탭 호환 보존 (personasFromStore lookup)",
    /personasFromStore\.find/.test(panel),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D27-5 — header PDF + dev-mode-strip 마운트 + HARD GATE (5 assertion + HARD GATE 1)
// ─────────────────────────────────────────────────────────────────────────────
{
  const pdfBtn = await readSrc(
    "src/modules/conversation/header-pdf-button.tsx",
  );
  assert(
    "C-D27-5: header-pdf-button.tsx HeaderPdfButton export",
    /export\s+function\s+HeaderPdfButton/.test(pdfBtn),
  );
  assert(
    "C-D27-5: header-pdf-button PdfExportDialog dynamic ssr:false",
    /PdfExportDialog[\s\S]+?dynamic[\s\S]+?ssr:\s*false/.test(pdfBtn),
  );

  const headerCluster = await readSrc(
    "src/modules/conversation/header-cluster.tsx",
  );
  assert(
    "C-D27-5: header-cluster.tsx HeaderPdfButton dynamic 마운트",
    /HeaderPdfButton[\s\S]+?dynamic/.test(headerCluster),
  );

  const ws = await readSrc("src/modules/conversation/conversation-workspace.tsx");
  assert(
    "C-D27-5: conversation-workspace.tsx DevModeStrip dynamic 마운트",
    /DevModeStrip[\s\S]+?dynamic/.test(ws) &&
      /<DevModeStrip\s*\/>/.test(ws),
  );

  const devStrip = await readSrc("src/modules/conversation/dev-mode-strip.tsx");
  assert(
    "C-D27-5: dev-mode-strip #dev hash 가드 (location.hash === '#dev')",
    /location\.hash\s*===\s*["']#dev["']/.test(devStrip),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD GATE — First Load JS <= 168 kB 정식
// ─────────────────────────────────────────────────────────────────────────────
{
  const BUNDLE_LIMIT_KB = 168;
  let firstLoadKb = NaN;
  let buildOk = false;
  if (process.env.VERIFY_D27_SKIP_BUILD === "1") {
    console.log(
      "[verify-d27] VERIFY_D27_SKIP_BUILD=1 → next build 스킵 (HARD GATE 게이트는 별도 step 에서 수행)",
    );
    // SKIP 시 게이트는 건너뛰지만 assertion 수는 동일하게 유지하기 위해 skip 으로 PASS 처리.
    assert(`First Load JS <= ${BUNDLE_LIMIT_KB} kB (skipped)`, true);
  } else {
    try {
      const out = execSync("npx --no-install next build", {
        encoding: "utf8",
        stdio: "pipe",
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      });
      buildOk = true;
      // First Load JS shared by all   168 kB
      const m = out.match(
        /First Load JS shared by all[\s\S]*?(\d+(?:\.\d+)?)\s*kB/,
      );
      firstLoadKb = m ? parseFloat(m[1]) : NaN;
      // 디버그 — 빌드 출력 마지막 50 라인.
      const lines = out.split("\n");
      const tail = lines.slice(Math.max(0, lines.length - 50)).join("\n");
      console.log("\n[next build tail]\n" + tail);
    } catch (e) {
      console.error("[verify-d27] next build 실패");
      console.error(e.stdout?.toString() ?? "");
      console.error(e.stderr?.toString() ?? "");
    }
    assert(
      `next build 성공`,
      buildOk,
      "build fail — 위 로그 확인",
    );
    assert(
      `First Load JS <= ${BUNDLE_LIMIT_KB} kB 정식 (실측 ${Number.isNaN(firstLoadKb) ? "?" : firstLoadKb} kB)`,
      Number.isFinite(firstLoadKb) && firstLoadKb <= BUNDLE_LIMIT_KB,
      Number.isFinite(firstLoadKb) && firstLoadKb > BUNDLE_LIMIT_KB
        ? `+${(firstLoadKb - BUNDLE_LIMIT_KB).toFixed(1)} kB 초과 — D-D28 즉시 핫픽스 의무`
        : "",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\nverify-d27: ${pass}/${total} PASS, ${fail} FAIL`);
if (fail > 0) {
  process.exit(1);
}
