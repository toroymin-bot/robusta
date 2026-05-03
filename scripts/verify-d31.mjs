#!/usr/bin/env node
/**
 * verify-d31.mjs
 *   - C-D31-1~5 (D-5 11시 슬롯, 2026-05-03) — Tori spec (Task_2026-05-03 §5).
 *   - 패턴: verify-d30 계승 — 정적 source 패턴 검사. 168 정식 HARD GATE 는 verify-d27 담당.
 *
 * 검증 범위 (총 27 assertion, 명세 §7 verify 케이스 5+5+5+6+6 매핑):
 *   1) C-D31-1 — schedule-modal save → bridge.persistRule + Toast 연동 (5)
 *   2) C-D31-2 — conversation-store 두 done 분기 parseMessageInsights wiring (5)
 *   3) C-D31-3 — message-bubble insights ≥1 조건부 마운트 (5)
 *   4) C-D31-4 — /schedules 페이지 라우트 + 빈 상태 + FAB (6)
 *   5) C-D31-5 — KeyPingWidget 신규 + i18n 4키 (6)
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
// 1) C-D31-1 — schedule-modal → bridge.persistRule + Toast (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const modal = await readSrc("src/modules/schedule/schedule-modal.tsx");
  assert(
    "C-D31-1: schedule-modal 이 schedule-store-bridge persistRule import",
    /from\s+"@\/modules\/schedules\/schedule-store-bridge"/.test(modal) &&
      /\bpersistRule\b/.test(modal),
  );
  assert(
    "C-D31-1: schedule-modal 이 useToastStore + t() import (Toast 결과 알림)",
    /from\s+"@\/modules\/ui\/toast"/.test(modal) &&
      /useToastStore/.test(modal) &&
      /from\s+"@\/modules\/i18n\/messages"/.test(modal),
  );
  assert(
    "C-D31-1: onAdd wrapper 가 add 전 id 스냅샷 + addRule 후 새 rule 식별 (race-safe)",
    /beforeIds\s*=\s*new Set\(/.test(modal) &&
      /\.find\(\s*\(r\)\s*=>\s*!beforeIds\.has\(r\.id\)\s*\)/.test(modal),
  );
  assert(
    "C-D31-1: persistRule 성공 → Toast info 'schedule.save.ok'",
    /tone:\s*"info"[\s\S]*?schedule\.save\.ok/.test(modal),
  );
  assert(
    "C-D31-1: persistRule 실패 → Toast error 'schedule.save.fail'",
    /tone:\s*"error"[\s\S]*?schedule\.save\.fail/.test(modal),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D31-2 — conversation-store done parseMessageInsights wiring (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const store = await readSrc("src/stores/conversation-store.ts");
  assert(
    "C-D31-2: conversation-store 가 parseMessageInsights import",
    /import\s*{[\s\S]*?parseMessageInsights[\s\S]*?}\s*from\s*"@\/modules\/conversation\/conversation-api"/.test(
      store,
    ),
  );
  // retry 경로
  assert(
    "C-D31-2: retry done 분기에 parseMessageInsights(accumulated, plan.speaker.id) 호출",
    /parseMessageInsights\(accumulated,\s*plan\.speaker\.id\)/.test(store),
  );
  // autoLoop 경로
  assert(
    "C-D31-2: AutoLoop done 분기에 parseMessageInsights(accumulated, speaker.id) 호출",
    /parseMessageInsights\(accumulated,\s*speaker\.id\)/.test(store),
  );
  // cleanText 적용
  assert(
    "C-D31-2: updateMessage content 가 parsed.cleanText 로 교체 (둘 다)",
    /content:\s*parsedRetry\.cleanText/.test(store) &&
      /content:\s*parsedAuto\.cleanText/.test(store),
  );
  // insights 부착 (조건부 spread)
  assert(
    "C-D31-2: insights 1건 이상이면 message.insights 부착 (조건부 spread)",
    /parsedRetry\.insights\.length\s*>\s*0[\s\S]*?insights:\s*parsedRetry\.insights/.test(
      store,
    ) &&
      /parsedAuto\.insights\.length\s*>\s*0[\s\S]*?insights:\s*parsedAuto\.insights/.test(
        store,
      ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D31-3 — message-bubble insights ≥1 조건부 마운트 (5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const bubble = await readSrc("src/modules/conversation/message-bubble.tsx");
  assert(
    "C-D31-3: message-bubble 이 MultiSpeakerInsightFooter dynamic import (lazy chunk)",
    /MultiSpeakerInsightFooter\s*=\s*dynamic\(/.test(bubble) &&
      /insight-footer/.test(bubble),
  );
  assert(
    "C-D31-3: message.status === 'done' 조건부 렌더 (streaming/error/aborted 미마운트)",
    /message\.status\s*===\s*"done"[\s\S]*?MultiSpeakerInsightFooter/.test(
      bubble,
    ),
  );
  assert(
    "C-D31-3: message.insights 길이 1건 이상 조건부 (빈 배열 / undefined 미마운트)",
    /message\.insights[\s\S]*?\.length\s*>\s*0[\s\S]*?MultiSpeakerInsightFooter/.test(
      bubble,
    ),
  );
  assert(
    "C-D31-3: insights prop 으로 message.insights 전달 (배열 직접 패스스루)",
    /insights=\{message\.insights\}/.test(bubble),
  );
  assert(
    "C-D31-3: messageId prop 으로 message.id 전달 (다중 메시지 다중 footer 식별자)",
    /messageId=\{message\.id\}/.test(bubble),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D31-4 — /schedules 페이지 라우트 + 빈 상태 + FAB (6)
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D31-4: src/app/schedules/page.tsx 신규 파일 존재",
    await exists("src/app/schedules/page.tsx"),
  );
  const page = await readSrc("src/app/schedules/page.tsx");
  assert(
    "C-D31-4: page 가 default export SchedulesPage 함수",
    /export\s+default\s+function\s+SchedulesPage/.test(page),
  );
  assert(
    "C-D31-4: bridge.loadRules 호출 + ScheduleModal lazy 마운트",
    /loadRules\(\)/.test(page) &&
      /ScheduleModal\s*=\s*dynamic\(/.test(page),
  );
  assert(
    "C-D31-4: CostCapWidget lazy 마운트 (헤더 BYOK 비용 cap 가시화)",
    /CostCapWidget\s*=\s*dynamic\(/.test(page),
  );
  assert(
    "C-D31-4: 빈 상태 (D-D31-1 c) — 일러스트 + headline + CTA",
    /data-test="schedules-empty"/.test(page) &&
      /schedules\.empty\.headline/.test(page),
  );
  assert(
    "C-D31-4: FAB '+ 새 스케줄' → modal open (data-test=schedules-fab-new)",
    /data-test="schedules-fab-new"/.test(page) &&
      /setModalOpen\(true\)/.test(page) &&
      /schedules\.cta\.new/.test(page),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D31-5 — KeyPingWidget 신규 + i18n 4키 (6)
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D31-5: src/modules/api-keys/key-ping-widget.tsx 신규 파일 존재",
    await exists("src/modules/api-keys/key-ping-widget.tsx"),
  );
  const widget = await readSrc("src/modules/api-keys/key-ping-widget.tsx");
  assert(
    "C-D31-5: KeyPingWidget export + KeyPingStatus 타입 export",
    /export\s+function\s+KeyPingWidget/.test(widget) &&
      /export\s+type\s+KeyPingStatus\s*=\s*"ok"\s*\|\s*"fail"\s*\|\s*"unknown"/.test(
        widget,
      ),
  );
  assert(
    "C-D31-5: 3 상태 dot 색 매핑 (ok=green-500 / fail=red-500 / unknown=gray-400)",
    /#22C55E/.test(widget) &&
      /#EF4444/.test(widget) &&
      /#9CA3AF/.test(widget),
  );
  assert(
    "C-D31-5: 재확인 버튼 onRePing 호출 + pending 동안 disabled",
    /props\.onRePing\(\)/.test(widget) && /disabled=\{pending\}/.test(widget),
  );
  assert(
    "C-D31-5: lastPingedAt 미정 시 '—' fallback (toLocaleString ko-KR Asia/Seoul)",
    /toLocaleString\("ko-KR"/.test(widget) &&
      /timeZone:\s*"Asia\/Seoul"/.test(widget) &&
      /"—"/.test(widget),
  );
  // i18n 4키 ko + en parity
  const messages = await readSrc("src/modules/i18n/messages.ts");
  const koHas =
    /"keyping\.label":\s*"BYOK 키 상태"/.test(messages) &&
    /"keyping\.status\.ok":\s*"확인됨"/.test(messages) &&
    /"keyping\.status\.fail":\s*"실패"/.test(messages) &&
    /"keyping\.action\.reping":\s*"재확인"/.test(messages);
  const enHas =
    /"keyping\.label":\s*"BYOK key status"/.test(messages) &&
    /"keyping\.status\.ok":\s*"Verified"/.test(messages) &&
    /"keyping\.status\.fail":\s*"Failed"/.test(messages) &&
    /"keyping\.action\.reping":\s*"Re-check"/.test(messages);
  assert(
    "C-D31-5: i18n 4키 (keyping.label/status.ok/status.fail/action.reping) ko/en parity",
    koHas && enHas,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\nverify-d31: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
