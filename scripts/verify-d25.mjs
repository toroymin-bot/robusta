#!/usr/bin/env node
/**
 * verify-d25.mjs
 *   - C-D25-5 (D6 07시 슬롯, 2026-05-02) — Tori spec, D-D25 5건 통합 회귀 게이트.
 *   - verify-d24.mjs 패턴 계승. assertion 43건 목표 (10/8/9/8/8).
 *
 * 검증 범위:
 *   1) C-D25-1 — 자동 마크 v0 (auto-mark.ts) + insight-mark.tsx auto/user 분기 + i18n auto.label
 *   2) C-D25-2 — Dexie v7 insights 표 + insight-store hydrate/markedBy + SSR 가드
 *   3) C-D25-3 — picker-card 우상단 hue dot + persona-catalog v1 5종 + colorTokenToHue 매핑
 *   4) C-D25-4 — ROBUSTA_TEST_MODE 가드 정식 + conversation-api injection + production dead code
 *   5) C-D25-5 — workspace insight count lazy 분리 + check-concept-copy 게이트 + verify-gate.yml step
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
// 1) C-D25-1 — 자동 마크 v0 (auto-mark.ts) + insight-mark UI 분기 + i18n auto.label
// ─────────────────────────────────────────────────────────────────────────────
{
  const auto = await readSrc("src/modules/insights/auto-mark.ts");
  assert(
    "C-D25-1: auto-mark.ts 헤더 주석 (D6 07시)",
    auto.includes("C-D25-1") && auto.includes("2026-05-02"),
  );
  // D-D26 (C-D26-1) 진화: inferInsightKind / maybeAutoMark 모두 async + vocab dynamic 으로 분리.
  assert(
    "C-D25-1: inferInsightKind export + InferInsightKindOptions (D-D26: async)",
    /export\s+(async\s+)?function\s+inferInsightKind/.test(auto) &&
      auto.includes("export interface InferInsightKindOptions"),
  );
  // 어휘 사전은 D-D26 에서 ./auto-mark-vocab 로 분리 — auto-mark.ts 또는 vocab 둘 중 한 곳에 정의되면 PASS.
  const vocab = await readSrc("src/modules/insights/auto-mark-vocab.ts").catch(
    () => "",
  );
  assert(
    "C-D25-1: ko 어휘 사전 3종 (counter / augment / newView) — D-D26: vocab 분리",
    /COUNTER_VOCAB_KO\s*=\s*\[/.test(auto + vocab) &&
      /AUGMENT_VOCAB_KO\s*=\s*\[/.test(auto + vocab) &&
      /NEWVIEW_VOCAB_KO\s*=\s*\[/.test(auto + vocab),
  );
  assert(
    "C-D25-1: en 어휘 사전 3종 (counter / augment / newView) — D-D26: vocab 분리",
    (auto + vocab).includes("COUNTER_VOCAB_EN") &&
      (auto + vocab).includes("AUGMENT_VOCAB_EN") &&
      (auto + vocab).includes("NEWVIEW_VOCAB_EN"),
  );
  assert(
    "C-D25-1: 우선순위 newView > counter > augment 분기 (의미 강도 순)",
    /newView\.some[\s\S]{0,80}return "newView"[\s\S]{0,80}counter\.some[\s\S]{0,80}return "counter"[\s\S]{0,80}augment\.some/.test(
      auto,
    ),
  );
  assert(
    "C-D25-1: maybeAutoMark export + AI 한정 + system 가드 + existingMark skip (D-D26: async)",
    /export\s+(async\s+)?function\s+maybeAutoMark/.test(auto) &&
      auto.includes('participantKind !== "ai"') &&
      auto.includes('participantId === "system"') &&
      auto.includes("existingMark") &&
      auto.includes('markedBy: "auto"'),
  );

  const mark = await readSrc("src/modules/conversation/insight-mark.tsx");
  assert(
    "C-D25-1: insight-mark.tsx auto vs user 분기 (border-dashed vs border-solid)",
    mark.includes("border-dashed") &&
      mark.includes("border-solid") &&
      mark.includes('markedBy === "auto"'),
  );
  assert(
    "C-D25-1: insight-mark.tsx 'AI 추정' 라벨 마운트 (insight.auto.label)",
    mark.includes("insight.auto.label") &&
      mark.includes("insight-auto-label"),
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D25-1: i18n insight.auto.label ko/en parity",
    i18n.includes('"insight.auto.label": "AI 추정"') &&
      i18n.includes('"insight.auto.label": "AI inferred"'),
  );

  // 호출처 — done 분기 3곳 모두 maybeAutoMark dynamic import + 호출 의무.
  //   C-D25-5 168 회복: view/store 모두 dynamic import 로 변환됨 (rename: maybeAutoMarkRetry/maybeAutoMarkAuto).
  const view = await readSrc("src/modules/conversation/conversation-view.tsx");
  const store = await readSrc("src/stores/conversation-store.ts");
  const dynamicImports =
    (view.match(/import\([\s\S]{0,10}"@\/modules\/insights\/auto-mark"/g) || [])
      .length +
    (store.match(/import\([\s\S]{0,10}"@\/modules\/insights\/auto-mark"/g) || [])
      .length;
  assert(
    "C-D25-1: maybeAutoMark dynamic import ≥ 3 (view runAiTurn / store retry / store runAutoTurn)",
    dynamicImports >= 3,
    `actual=${dynamicImports}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D25-2 — Dexie v7 insights 표 + insight-store 영구화
// ─────────────────────────────────────────────────────────────────────────────
{
  const db = await readSrc("src/modules/storage/db.ts");
  assert(
    "C-D25-2: db.ts InsightRow 인터페이스 (8 필드 — id/roomId/sourceMessageId/text/personaId/insightKind/markedBy/createdAt)",
    db.includes("export interface InsightRow") &&
      db.includes("id: string") &&
      db.includes("roomId: string") &&
      db.includes("sourceMessageId: string") &&
      db.includes('markedBy: "user" | "auto"'),
  );
  assert(
    "C-D25-2: db.ts insights Table + this.version(7).stores",
    db.includes("insights!: Table<InsightRow") &&
      db.includes("this.version(7)") &&
      db.includes(
        'insights: "id, roomId, sourceMessageId, [roomId+createdAt]"',
      ),
  );
  assert(
    "C-D25-2: db.ts v7 비파괴 — 기존 v6 표(personas/messages/apiKeys/...) 보존",
    db.includes("personas: \"&id, kind, isPreset") &&
      db.includes("messages:\n        \"id, conversationId, createdAt, status, streamingStartedAt\""),
  );

  const store = await readSrc("src/modules/insights/insight-store.ts");
  assert(
    "C-D25-2: insight-store hydrate(roomId) — Dexie 조회 + 메모리 캐시",
    store.includes("hydrate: (roomId: string) => Promise<void>") &&
      store.includes("async hydrate(roomId)") &&
      store.includes("[roomId+createdAt]"),
  );
  assert(
    "C-D25-2: insight-store capture/remove Dexie 동시 write (safeDexie wrapper)",
    store.includes("safeDexie(async () =>") &&
      store.includes("db.insights.put") &&
      store.includes("db.insights.delete"),
  );
  assert(
    "C-D25-2: insight-store SSR 가드 (typeof window === 'undefined')",
    store.includes('typeof window === "undefined"'),
  );
  assert(
    "C-D25-2: insight-store markedBy 필드 + ROOM_CACHE_LIMIT 50",
    store.includes('markedBy?: "user" | "auto"') &&
      store.includes("ROOM_CACHE_LIMIT = 50"),
  );
  assert(
    "C-D25-2: rowToInsight / insightToRow 변환 함수 (Dexie row ↔ store Insight)",
    store.includes("function rowToInsight") &&
      store.includes("function insightToRow"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D25-3 — picker-card hue dot + persona-catalog v1 + colorTokenToHue 매핑
// ─────────────────────────────────────────────────────────────────────────────
{
  // D-D26 (C-D26-5) 진화: 매핑 정의를 theme.ts → theme-hue.ts 별도 모듈로 분리.
  //   theme 또는 theme-hue 둘 중 한 곳에서 발견되면 PASS.
  const theme = await readSrc("src/modules/ui/theme.ts");
  const themeHue = await readSrc("src/modules/ui/theme-hue.ts").catch(() => "");
  const themeAll = theme + "\n" + themeHue;
  assert(
    "C-D25-3: PERSONA_COLOR_TOKEN_TO_HUE 매핑 (5 AI + 2 human = 7) — D-D26: theme-hue 분리",
    themeAll.includes("PERSONA_COLOR_TOKEN_TO_HUE") &&
      themeAll.includes('"robusta-color-participant-1": 20') &&
      themeAll.includes('"robusta-color-participant-5": 280') &&
      themeAll.includes('"robusta-color-participant-human-1"'),
  );
  assert(
    "C-D25-3: personaColorTokenToHue 함수 + satisfies Record<PersonaColorToken, number> — D-D26: theme-hue 분리",
    themeAll.includes("export function personaColorTokenToHue") &&
      themeAll.includes("satisfies Record<PersonaColorToken, number>"),
  );

  const picker = await readSrc(
    "src/modules/personas/persona-picker-modal.tsx",
  );
  assert(
    "C-D25-3: picker-modal PersonaCardColorDot import + 우상단 마운트",
    picker.includes(
      'import { PersonaCardColorDot } from "./persona-card-color-dot"',
    ) &&
      picker.includes("personaColorTokenToHue") &&
      picker.includes('data-test="picker-card-color-dot"') &&
      picker.includes('className="pointer-events-none absolute right-2 top-2"'),
  );
  assert(
    "C-D25-3: picker-card position relative (PersonaCardColorDot absolute 슬롯)",
    picker.includes("relative flex flex-col") &&
      picker.includes('data-test="picker-card-color-dot"'),
  );

  const catalog = await readSrc("src/modules/personas/persona-catalog.ts");
  assert(
    "C-D25-3: persona-catalog.ts PERSONA_CATALOG_V1 5건 정의",
    catalog.includes("PERSONA_CATALOG_V1") &&
      catalog.includes("catalog:critical-mate") &&
      catalog.includes("catalog:optimistic-mate") &&
      catalog.includes("catalog:data-mate") &&
      catalog.includes("catalog:designer") &&
      catalog.includes("catalog:user-advocate"),
  );
  assert(
    "C-D25-3: persona-catalog.ts PersonaCatalogEntry 인터페이스 6 필드",
    catalog.includes("export interface PersonaCatalogEntry") &&
      catalog.includes("i18nKey:") &&
      catalog.includes("descriptionKey:") &&
      catalog.includes("seedHintKey:") &&
      catalog.includes("colorToken: PersonaColorToken") &&
      catalog.includes("defaultProvider: PersonaProvider"),
  );
  assert(
    "C-D25-3: persona-catalog 5 colorToken 1:1 (AI participant 1~5)",
    catalog.includes("robusta-color-participant-1") &&
      catalog.includes("robusta-color-participant-2") &&
      catalog.includes("robusta-color-participant-3") &&
      catalog.includes("robusta-color-participant-4") &&
      catalog.includes("robusta-color-participant-5"),
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  // 5종 이름 × ko/en = 10 키. desc/seedHint 는 D-D26 본문 보강 (Tori §9 / 168 회복 우선).
  const nameCount = (
    i18n.match(/"persona\.catalog\.[a-zA-Z]+\.name":\s*"[^"]+"/g) || []
  ).length;
  assert(
    "C-D25-3: i18n persona.catalog.*.name 10 키 (5종 × ko+en) — desc/seedHint D-D26",
    nameCount === 10,
    `actual=${nameCount}`,
  );
  assert(
    "C-D25-3: i18n 페르소나 카탈로그 ko/en parity",
    i18n.includes('"persona.catalog.criticalMate.name": "비판적 동료"') &&
      i18n.includes('"persona.catalog.criticalMate.name": "Critical Mate"'),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D25-4 — ROBUSTA_TEST_MODE 가드 정식 + conversation-api injection
// ─────────────────────────────────────────────────────────────────────────────
{
  const tm = await readSrc("src/modules/conversation/test-mode.ts");
  assert(
    "C-D25-4: test-mode.ts isTestMode 가드 (env+NODE_ENV)",
    tm.includes('process.env?.ROBUSTA_TEST_MODE === "true"') &&
      tm.includes('process.env?.NODE_ENV !== "production"'),
  );
  assert(
    "C-D25-4: TestInjection 인터페이스 (3 kind: compacted/error/slow)",
    tm.includes("export interface TestInjection") &&
      tm.includes('"compacted" | "error" | "slow"'),
  );
  assert(
    "C-D25-4: getTestInjection / clearTestInjection export + globalThis 안전 read",
    tm.includes("export function getTestInjection") &&
      tm.includes("export function clearTestInjection") &&
      tm.includes('typeof globalThis === "undefined"'),
  );
  assert(
    "C-D25-4: production NODE_ENV 단락 평가 (isTestMode=false → null)",
    tm.includes("if (!isTestMode) return null"),
  );

  const api = await readSrc("src/modules/conversation/conversation-api.ts");
  assert(
    "C-D25-4: conversation-api streamMessage test-mode 진입 가드 (env+NODE_ENV) + dynamic import",
    api.includes('process.env?.ROBUSTA_TEST_MODE === "true"') &&
      api.includes('process.env?.NODE_ENV !== "production"') &&
      api.includes('await import("./test-mode")'),
  );
  assert(
    "C-D25-4: conversation-api injection 분기 3종 (compacted/error/slow)",
    api.includes('injection.kind === "compacted"') &&
      api.includes('injection.kind === "error"') &&
      api.includes('injection.kind === "slow"'),
  );
  assert(
    "C-D25-4: clearTestInjection 호출 (1회성 mock — error/normal 양 분기)",
    api.includes("tm.clearTestInjection();"),
  );
  // ROBUSTA_TEST_MODE 가 NEXT_PUBLIC_ 접두 미사용 — 클라이언트 번들에 자동 inline 0.
  assert(
    "C-D25-4: ROBUSTA_TEST_MODE 가 NEXT_PUBLIC_ 접두 미사용 (클라이언트 번들 노출 0)",
    !tm.includes("NEXT_PUBLIC_ROBUSTA_TEST_MODE"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D25-5 — workspace insight count lazy 분리 + check-concept-copy + verify-gate.yml
// ─────────────────────────────────────────────────────────────────────────────
{
  const ws = await readSrc("src/modules/conversation/conversation-workspace.tsx");
  assert(
    "C-D25-5: workspace insight-store 정적 import 제거 (lazy 분리)",
    !/^import \{ useInsightStore \} from "@\/modules\/insights\/insight-store"/m.test(
      ws,
    ),
  );
  assert(
    "C-D25-5: workspace insightCount lazy useEffect (dynamic import + setInsightCount)",
    ws.includes('void import("@/modules/insights/insight-store").then') &&
      ws.includes("setInsightCount(") &&
      ws.includes('useState<number | null>(null)'),
  );
  assert(
    "C-D25-5: workspace 첫 페인트 placeholder \"...\" (insightCount === null 분기)",
    ws.includes('insightCount === null ? "..." : String(insightCount)'),
  );
  assert(
    "C-D25-5: workspace hydrate(DEFAULT_CONVERSATION_ID) — Dexie 영구화 호출",
    ws.includes("hydrate(DEFAULT_CONVERSATION_ID)"),
  );

  // check-concept-copy.mjs 게이트 정식 도입.
  const concept = await readSrc("scripts/check-concept-copy.mjs");
  assert(
    "C-D25-5: check-concept-copy.mjs BLEND_VOCAB 사전 (한·영 7종)",
    concept.includes("BLEND_VOCAB_REGEX") &&
      concept.includes("AI 도구") &&
      concept.includes("AI 어시스턴트") &&
      concept.includes("챗봇") &&
      concept.includes("AI assistant") &&
      concept.includes("AI tool") &&
      concept.includes("chatbot") &&
      concept.includes("AI chat"),
  );
  assert(
    "C-D25-5: check-concept-copy whitelist 분리 파일 (scripts/check-concept-copy.whitelist.json)",
    concept.includes("scripts/check-concept-copy.whitelist.json"),
  );

  // verify-gate.yml D-D25 step 추가.
  const yml = await readSrc(".github/workflows/verify-gate.yml");
  assert(
    "C-D25-5: verify-gate.yml verify-d24 step 보존 + verify-d25 step 추가",
    yml.includes("verify-d24.mjs") && yml.includes("verify-d25.mjs"),
  );
  assert(
    "C-D25-5: verify-gate.yml check-concept-copy step 추가",
    yml.includes("check-concept-copy.mjs"),
  );

  // package.json scripts.
  const pkg = JSON.parse(await readSrc("package.json"));
  assert(
    "C-D25-5: package.json scripts.verify:d25 + check:concept-copy",
    typeof pkg.scripts["verify:d25"] === "string" &&
      typeof pkg.scripts["check:concept-copy"] === "string",
  );

  // 라이브 게이트 — check-concept-copy / 어휘 룰 / verify-d24 / verify-hue-sync 회귀.
  const conceptRun = tryExec("node scripts/check-concept-copy.mjs");
  assert(
    "C-D25-5: check-concept-copy 0 hits PASS (Robusta 컨셉 사수)",
    conceptRun.ok,
    conceptRun.err || conceptRun.out,
  );
  const vocabRun = tryExec("node scripts/check-vocab.mjs --all");
  assert(
    "C-D25-5: check-vocab 0 hits (어휘 룰 id-22 — 박다/박제 0건)",
    vocabRun.ok,
    vocabRun.err || vocabRun.out,
  );
  const hueRun = tryExec("node scripts/verify-hue-sync.mjs");
  assert(
    "C-D25-5: verify-hue-sync TS↔CSS 동기 PASS (5 hue × 2 컴포넌트)",
    hueRun.ok,
    hueRun.err || hueRun.out,
  );
  const d24Run = tryExec("node scripts/verify-d24.mjs");
  assert(
    "C-D25-5: verify-d24 회귀 PASS (D-D24 5건 보존)",
    d24Run.ok,
    d24Run.err || d24Run.out,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 종합
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n--- verify-d25: ${pass}/${pass + fail} PASS ---`);
if (fail > 0) {
  process.exit(1);
}
process.exit(0);
