#!/usr/bin/env node
/**
 * verify-d28.mjs
 *   - C-D28-1~5 (D6 23시 슬롯, 2026-05-02) — Tori spec, D-D28 5건 통합 회귀 게이트.
 *   - verify-d27 패턴 계승. 16+ assertion. 168 정식 HARD GATE 는 verify-d27 가 담당 →
 *     본 게이트는 build skip 으로 verify-d27 cache 재사용.
 *
 * 검증 범위:
 *   1) C-D28-1 — db.ts v8 schedules 테이블 + ScheduleRow 타입 (4 assertion)
 *   2) C-D28-2 — check-catalog-isolation 강화 메시지 + EXCLUDED_DIRS (3 assertion)
 *   3) C-D28-3 — schedule-runner 5분 polling + 4중 가드 (4 assertion)
 *   4) C-D28-4 — db.ts v8 autoMarks + auto-mark-sample-store hydrate/persist (3 assertion)
 *   5) C-D28-5 — conversation-store pickScenario 4 deps + page.tsx wiring (4 assertion)
 *   합계: 18 assertion (목표 16 초과 충족)
 *
 * 의존성 0 — node 표준만.
 */

import { readFile } from "node:fs/promises";
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

// ─────────────────────────────────────────────────────────────────────────────
// 1) C-D28-1 — db.ts v8 schedules 테이블 (4 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const db = await readSrc("src/modules/storage/db.ts");
  assert(
    "C-D28-1: db.ts ScheduleRow 인터페이스 export",
    /export\s+interface\s+ScheduleRow\s*\{[\s\S]*?id:\s*string;[\s\S]*?cron:\s*string;[\s\S]*?target_room:\s*string;[\s\S]*?target_persona:\s*string;[\s\S]*?prompt:\s*string;[\s\S]*?enabled:\s*boolean;[\s\S]*?last_run:\s*number\s*\|\s*null;[\s\S]*?created_at:\s*number;[\s\S]*?\}/.test(
      db,
    ),
  );
  assert(
    "C-D28-1: db.ts version(8) 정의",
    /this\.version\(8\)\.stores\(\{[\s\S]*?\}\)/.test(db),
  );
  assert(
    "C-D28-1: db.ts v8 schedules 인덱스 정의",
    /schedules:\s*"id,\s*enabled,\s*target_room,\s*created_at,\s*last_run"/.test(
      db,
    ),
  );
  assert(
    "C-D28-1: db.ts schedules! Table 선언",
    /schedules!:\s*Table<ScheduleRow,\s*string>/.test(db),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D28-2 — check-catalog-isolation 강화 (3 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const script = await readSrc("scripts/check-catalog-isolation.mjs");
  assert(
    "C-D28-2: EXCLUDED_DIRS Set 정의 (node_modules / .next / __test__ 등)",
    /EXCLUDED_DIRS\s*=\s*new\s+Set\(\[[\s\S]*?"node_modules"[\s\S]*?"\.next"[\s\S]*?"__test__"[\s\S]*?\]\)/.test(
      script,
    ),
  );
  assert(
    "C-D28-2: walk() 가 EXCLUDED_DIRS skip",
    /EXCLUDED_DIRS\.has\(e\.name\)/.test(script),
  );
  assert(
    "C-D28-2: 위반 시 LAZY 화이트리스트 추가 가이드 메시지",
    /신규\s*lazy\s*모듈은\s*LAZY\s*화이트리스트에\s*추가\s*필요/.test(script),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D28-3 — schedule-runner (4 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const runner = await readSrc("src/modules/schedules/schedule-runner.ts");
  assert(
    "C-D28-3: startScheduleRunner export + cleanup 함수 반환",
    /export\s+function\s+startScheduleRunner\([\s\S]*?\):\s*\(\)\s*=>\s*void/.test(
      runner,
    ),
  );
  assert(
    "C-D28-3: DEFAULT_TICK_MS = 5분 (300_000ms)",
    /DEFAULT_TICK_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(runner),
  );
  assert(
    "C-D28-3: 4중 가드 — DAILY_CAP / HOURLY_CAP / LOOP_GUARD_MS 상수",
    /DAILY_CAP\s*=\s*200/.test(runner) &&
      /HOURLY_CAP\s*=\s*30/.test(runner) &&
      /LOOP_GUARD_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(runner),
  );
  assert(
    "C-D28-3: visibilitychange listener (tab 백그라운드 catch-up)",
    /visibilitychange/.test(runner) &&
      /document\.addEventListener/.test(runner) &&
      /document\.removeEventListener/.test(runner),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D28-4 — autoMarks 영구화 (4 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const db = await readSrc("src/modules/storage/db.ts");
  assert(
    "C-D28-4: db.ts AutoMarkSampleRow 인터페이스 + autoMarks 인덱스",
    /export\s+interface\s+AutoMarkSampleRow/.test(db) &&
      /autoMarks:\s*"\+\+id,\s*roomId,\s*ts,\s*\[roomId\+ts\]"/.test(db),
  );
  const store = await readSrc("src/stores/auto-mark-sample-store.ts");
  assert(
    "C-D28-4: auto-mark-sample-store hydrate() 메서드 + Dexie autoMarks 조회",
    /hydrate:\s*\(\s*\)\s*=>\s*Promise<void>/.test(store) &&
      /db\.autoMarks\.orderBy\("ts"\)/.test(store),
  );
  assert(
    "C-D28-4: SAMPLE_LIMIT 1000 + LRU cap (가장 오래된 1건 삭제)",
    /SAMPLE_LIMIT\s*=\s*1000/.test(store) &&
      /db\.autoMarks\.orderBy\("ts"\)\.first\(\)/.test(store),
  );
  assert(
    "C-D28-4: add() 트랜잭션 + roomId 옵션 (DEFAULT_ROOM_ID fallback)",
    /db\.transaction\("rw",\s*db\.autoMarks/.test(store) &&
      /DEFAULT_ROOM_ID/.test(store),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D28-5 — pickScenario 4 deps wiring (4 assertion)
// ─────────────────────────────────────────────────────────────────────────────
{
  const cs = await readSrc("src/stores/conversation-store.ts");
  assert(
    "C-D28-5: conversation-store pickScenario 액션 + welcomePhase 상태",
    /pickScenario:\s*\(scenarioId:\s*string\)\s*=>\s*Promise<void>/.test(
      cs,
    ) && /welcomePhase:\s*"welcome"\s*\|\s*"workspace"/.test(cs),
  );
  // 4 deps wiring 모두 check — registerPersona / setSeedPlaceholder / markVisited / switchToWorkspace
  assert(
    "C-D28-5: 4 deps 모두 wiring (registerPersona/setSeedPlaceholder/markVisited/switchToWorkspace)",
    /registerPersona\(entry\)\s*\{[\s\S]*?personaFromPreset\(entry\)[\s\S]*?upsert\(persona\)/.test(
      cs,
    ) &&
      /setSeedPlaceholder:\s*\(text\)\s*=>\s*\{[\s\S]*?seedPlaceholder:\s*text/.test(
        cs,
      ) &&
      /markVisited:\s*\(\)\s*=>\s*\{[\s\S]*?markVisited\(\)/.test(cs) &&
      /switchToWorkspace:\s*\(\)\s*=>\s*\{[\s\S]*?welcomePhase:\s*"workspace"/.test(
        cs,
      ),
  );
  assert(
    "C-D28-5: scenario-catalog / scenario-pick / persona-store / persona-from-preset / visited-store dynamic import",
    /import\("@\/modules\/scenarios\/scenario-catalog"\)/.test(cs) &&
      /import\("@\/modules\/scenarios\/scenario-pick"\)/.test(cs) &&
      /import\("@\/modules\/personas\/persona-store"\)/.test(cs) &&
      /import\("@\/modules\/personas\/persona-from-preset"\)/.test(cs) &&
      /import\("@\/modules\/visit\/visited-store"\)/.test(cs),
  );
  const page = await readSrc("src/app/page.tsx");
  assert(
    "C-D28-5: page.tsx 가 store.pickScenario 호출 + welcomePhase 구독",
    /useConversationStore\(\(s\)\s*=>\s*s\.pickScenario\)/.test(page) &&
      /useConversationStore\(\(s\)\s*=>\s*s\.welcomePhase\)/.test(page) &&
      /pickScenario\(preset\.id\)/.test(page),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\nverify-d28: ${pass}/${total} PASS, ${fail} FAIL`);
if (fail > 0) {
  process.exit(1);
}
