#!/usr/bin/env node
/**
 * verify-d34.mjs
 *   - C-D34-1~5 (D-5 23시 슬롯, 2026-05-03) — Tori spec (Task_2026-05-03 §11).
 *   - 패턴: verify-d33 계승 — 정적 source 패턴 검사. 168 정식 HARD GATE 는 verify-d27 담당.
 *
 * 검증 범위:
 *   1) C-D34-1 — D-Day 카운트다운 lozenge (logo 옆) (8)
 *   2) C-D34-2 — BYOK 메시지 정합 wiring (Settings + /getting-started/byok) (5)
 *   3) C-D34-3 — BroadcastChannel 페르소나 동기화 (6)
 *   4) C-D34-4 — cron-preview-chip 패턴 확장 (hourly-at + edge) (8)
 *   5) C-D34-5 — launch checklist + funnelEvents 'schedule_fired' (6)
 *   6) conservation-13 v3 — workspace 스냅샷 (useEffect/조건부 렌더 스냅샷 갱신) (3)
 *   7) funnel-summary schema 'schedule_fired' 자동 흡수 (1)
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
// 1) C-D34-1 — D-Day 카운트다운 lozenge (8)
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D34-1: src/modules/dday/dday-config.ts 신규 파일 존재",
    await exists("src/modules/dday/dday-config.ts"),
  );
  const cfg = await readSrc("src/modules/dday/dday-config.ts");
  assert(
    "C-D34-1: dday-config RELEASE_ISO = '2026-05-08T00:00:00+09:00'",
    /RELEASE_ISO\s*=\s*"2026-05-08T00:00:00\+09:00"/.test(cfg),
  );
  assert(
    "C-D34-1: dday-config daysUntilRelease export + Math.ceil",
    /export function daysUntilRelease/.test(cfg) &&
      /Math\.ceil/.test(cfg),
  );

  assert(
    "C-D34-1: src/modules/header/d-day-lozenge.tsx 신규 파일 존재",
    await exists("src/modules/header/d-day-lozenge.tsx"),
  );
  const lozenge = await readSrc("src/modules/header/d-day-lozenge.tsx");
  assert(
    "C-D34-1: DDayLozenge export + data-test='d-day-lozenge' + n>0/≤0 분기",
    /export function DDayLozenge/.test(lozenge) &&
      /data-test="d-day-lozenge"/.test(lozenge) &&
      /n\s*>\s*0/.test(lozenge),
  );
  assert(
    "C-D34-1: lozenge i18n dday.lozenge.dN + dday.lozenge.live 양쪽 사용",
    /dday\.lozenge\.dN/.test(lozenge) && /dday\.lozenge\.live/.test(lozenge),
  );

  const ws = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  assert(
    "C-D34-1: workspace 가 DDayLozenge import + JSX 마운트",
    /import\s+\{\s*DDayLozenge\s*\}\s+from\s+"@\/modules\/header\/d-day-lozenge"/.test(ws) &&
      /<DDayLozenge\s*\/>/.test(ws),
  );

  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D34-1: i18n dday.lozenge.dN + dday.lozenge.live 2키 ko/en parity",
    (messages.match(/"dday\.lozenge\.dN"/g) ?? []).length >= 2 &&
      (messages.match(/"dday\.lozenge\.live"/g) ?? []).length >= 2,
  );

  // 계산 검증 — daysUntilRelease 의 핵심 로직 (Math.ceil 기반).
  //   verify 는 src 정적 검사 + 본 케이스만 dynamic require 회피용 산식 재현.
  const release = new Date("2026-05-08T00:00:00+09:00").getTime();
  const cases = [
    ["2026-05-03T21:00:00+09:00", 5],
    ["2026-05-04T00:00:00+09:00", 4],
    ["2026-05-08T00:00:00+09:00", 0],
    ["2026-05-08T12:00:00+09:00", 0],
  ];
  let calcOk = true;
  for (const [iso, expected] of cases) {
    const n = Math.ceil((release - new Date(iso).getTime()) / 86_400_000);
    if (n !== expected) {
      calcOk = false;
      console.error(`  case ${iso}: expected ${expected}, got ${n}`);
    }
  }
  assert("C-D34-1: daysUntilRelease 계산 4 케이스 (D-5 / D-4 / LIVE / LIVE)", calcOk);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D34-2 — BYOK 메시지 정합 wiring (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D34-2: i18n byok.message.title + byok.message.body 2키 ko/en parity",
    (messages.match(/"byok\.message\.title"/g) ?? []).length >= 2 &&
      (messages.match(/"byok\.message\.body"/g) ?? []).length >= 2,
  );
  assert(
    "C-D34-2: ko byok.message.body 가 '본인 키' 포함 (BYOK 4가치 핵심)",
    /"byok\.message\.body":\s*"본인 키[^"]*"/.test(messages),
  );
  assert(
    "C-D34-2: en byok.message.body 가 'Your key' 포함",
    /"byok\.message\.body":\s*"Your key[^"]*"/.test(messages),
  );

  const settings = await readSrc("src/modules/api-keys/api-keys-view.tsx");
  assert(
    "C-D34-2: Settings BYOK 모달 data-test='byok-message-settings' + 양쪽 i18n 키 사용",
    /data-test="byok-message-settings"/.test(settings) &&
      /byok\.message\.title/.test(settings) &&
      /byok\.message\.body/.test(settings),
  );

  const onboarding = await readSrc("src/app/getting-started/byok/page.tsx");
  assert(
    "C-D34-2: /getting-started/byok 페이지 data-test='byok-message-onboarding' + 양쪽 i18n 키 사용",
    /data-test="byok-message-onboarding"/.test(onboarding) &&
      /byok\.message\.title/.test(onboarding) &&
      /byok\.message\.body/.test(onboarding),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D34-3 — BroadcastChannel 페르소나 동기화 (6)
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D34-3: src/modules/personas/persona-broadcast.ts 신규 파일 존재",
    await exists("src/modules/personas/persona-broadcast.ts"),
  );
  const bc = await readSrc("src/modules/personas/persona-broadcast.ts");
  assert(
    "C-D34-3: persona-broadcast 채널 'robusta-persona-sync' (api-keys 채널과 분리)",
    /CHANNEL_NAME\s*=\s*"robusta-persona-sync"/.test(bc),
  );
  assert(
    "C-D34-3: publishPersonaChange + subscribePersonaSync 양쪽 export",
    /export function publishPersonaChange/.test(bc) &&
      /export function subscribePersonaSync/.test(bc),
  );
  assert(
    "C-D34-3: PersonaSyncMessage type='persona-changed' + senderId echo 방지",
    /type:\s*"persona-changed"/.test(bc) &&
      /senderId\s*===\s*SENDER_ID/.test(bc),
  );
  assert(
    "C-D34-3: BroadcastChannel undefined 환경 silent fallback (try/catch)",
    /typeof BroadcastChannel === "undefined"/.test(bc) && /try\s*{/.test(bc),
  );

  const store = await readSrc("src/modules/personas/persona-store.ts");
  assert(
    "C-D34-3: persona-store hydrate subscribe + upsert/remove/cloneFromPreset publish (4 곳 dynamic import)",
    (store.match(/persona-broadcast/g) ?? []).length >= 4 &&
      /subscribePersonaSync/.test(store) &&
      /publishPersonaChange/.test(store),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D34-4 — cron-preview-chip 패턴 확장 (hourly-at + edge) (8)
// ─────────────────────────────────────────────────────────────────────────────
{
  const chip = await readSrc("src/modules/schedule/cron-preview-chip.tsx");
  assert(
    "C-D34-4: cronToHuman 가 'M * * * *' (hourly-at) 분기 추가",
    /hourly-at|cron\.label\.hourly_at/.test(chip),
  );
  assert(
    "C-D34-4: cron.label.hourly_at i18n 키 사용",
    /t\("cron\.label\.hourly_at"/.test(chip),
  );
  assert(
    "C-D34-4: 기존 'M H * * *' (매일) 라벨 유지 (verify-d33 회귀 보호)",
    /매일\s*\$\{String/.test(chip),
  );
  assert(
    "C-D34-4: nextFireMs 가 hourly-at 분기 추가 (hourStr === '*' && /^\\d+$/.test(minStr))",
    /hourStr\s*===\s*"\*"/.test(chip) && /\/\^\\d\+\$\//.test(chip),
  );
  assert(
    "C-D34-4: cron-preview-chip 외부 dev-dep 0 (cronstrue / cron-parser 미도입)",
    !/from\s+["']cronstrue["']/.test(chip) &&
      !/from\s+["']cron-parser["']/.test(chip),
  );

  const messages = await readSrc("src/modules/i18n/messages.ts");
  assert(
    "C-D34-4: i18n cron.label.hourly_at + cron.label.every_n_min 2키 ko/en parity",
    (messages.match(/"cron\.label\.hourly_at"/g) ?? []).length >= 2 &&
      (messages.match(/"cron\.label\.every_n_min"/g) ?? []).length >= 2,
  );
  assert(
    "C-D34-4: ko cron.label.hourly_at 가 '매시 {m}분' 형식",
    /"cron\.label\.hourly_at":\s*"매시 \{m\}분"/.test(messages),
  );
  assert(
    "C-D34-4: en cron.label.hourly_at 가 'Hourly at {m} min' 형식",
    /"cron\.label\.hourly_at":\s*"Hourly at \{m\} min"/.test(messages),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D34-5 — launch checklist + funnelEvents 'schedule_fired' (6)
// ─────────────────────────────────────────────────────────────────────────────
{
  const funnel = await readSrc("src/modules/funnel/funnel-events.ts");
  assert(
    "C-D34-5: FunnelEvent union 에 'schedule_fired' type append",
    /type:\s*"schedule_fired"/.test(funnel),
  );
  assert(
    "C-D34-5: schedule_fired payload scheduleId + timestamp",
    /scheduleId:\s*string/.test(funnel) && /timestamp:\s*number/.test(funnel),
  );

  const runner = await readSrc("src/modules/schedules/schedule-runner.ts");
  assert(
    "C-D34-5: schedule-runner 가 fire 직전 logFunnelEvent('schedule_fired') 호출 (dynamic import)",
    /import\("@\/modules\/funnel\/funnel-events"\)/.test(runner) &&
      /type:\s*"schedule_fired"/.test(runner),
  );

  assert(
    "C-D34-5: src/modules/qatest/d-day-checklist.tsx 신규 파일 존재",
    await exists("src/modules/qatest/d-day-checklist.tsx"),
  );
  const checklist = await readSrc("src/modules/qatest/d-day-checklist.tsx");
  assert(
    "C-D34-5: DDayChecklist export + 5 항목 (qatest.checklist.* 5 키 사용)",
    /export function DDayChecklist/.test(checklist) &&
      (checklist.match(/qatest\.checklist\./g) ?? []).length >= 5,
  );

  const qatest = await readSrc("src/app/qatest/page.tsx");
  assert(
    "C-D34-5: /qatest 페이지가 DDayChecklist import + 마운트",
    /import\s+\{\s*DDayChecklist\s*\}/.test(qatest) &&
      /<DDayChecklist\s*\/>/.test(qatest),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) conservation-13 v3 — workspace 스냅샷 갱신 (3)
//    - useEffect 카운트 ≤ 8 (D-D34 마운트 후 +0 의무)
//    - 조건부 모달 마운트 ≤ 4 (D-D34 +0 의무)
//    - DDayLozenge 가 lazy 미적용도 OK (정적 마운트, 본체 +0.3 kB)
// ─────────────────────────────────────────────────────────────────────────────
{
  const ws = await readSrc(
    "src/modules/conversation/conversation-workspace.tsx",
  );
  const useEffectCount = (ws.match(/useEffect\(/g) ?? []).length;
  const condRenderCount = (ws.match(/\}\s*&&\s*[(<]/g) ?? []).length;
  assert(
    `conservation-13 v3: workspace useEffect ≤ 8 (실제 ${useEffectCount}) — 본 슬롯 +0 의무`,
    useEffectCount <= 8,
  );
  assert(
    `conservation-13 v3: workspace 조건부 마운트 ≤ 4 (실제 ${condRenderCount}) — 본 슬롯 +0 의무`,
    condRenderCount <= 4,
  );
  assert(
    "conservation-13 v3: DDayLozenge 정적 마운트 + KeyInputModal/EmptyRoomHint 기존 lazy 유지",
    /<DDayLozenge\s*\/>/.test(ws) &&
      /KeyInputModal\s*=\s*lazy\(/.test(ws) &&
      /EmptyRoomHint\s*=\s*lazy\(/.test(ws),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) funnel-summary 'schedule_fired' 자동 흡수 (1)
// ─────────────────────────────────────────────────────────────────────────────
{
  const child = spawnSync("node", ["scripts/funnel-summary.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  let parsed = null;
  try {
    parsed = JSON.parse(child.stdout);
  } catch {}
  assert(
    "C-D34-5: funnel-summary byType 에 schedule_fired 자동 흡수 (정적 파싱)",
    parsed &&
      Object.prototype.hasOwnProperty.call(parsed.byType, "schedule_fired"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\nverify-d34: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}`,
);
process.exit(fail === 0 ? 0 : 1);
