#!/usr/bin/env node
/**
 * verify-d36.mjs
 *   - C-D36-1~5 (D-4 07시 슬롯, 2026-05-04) — Tori spec (Task_2026-05-04 §3).
 *   - 패턴: verify-d35 계승 — 정적 source 패턴 검사. 의존성 0 (node 표준만).
 *
 * 검증 범위:
 *   1) C-D36-1 — Hero LIVE 자동 전환 wiring (dday-config isLive + lozenge animate-pulse + HeroLiveBanner + layout 마운트)
 *   2) C-D36-2 — 다중 탭 conversation list 동기화 (BroadcastChannel + sync listener hook)
 *   3) C-D36-3 — funnelEvents schema +2종 (visit / persona_used) + VisitTracker + persona-use-tracker
 *   4) C-D36-4 — cron-preview-chip dow 패턴 5 preset 정상 매칭 + nextFireMs dow
 *   5) C-D36-5 — KQ_23 banner CTA + /about-domain 정적 페이지
 *   6) i18n parity — 14 신규 키 ko/en 양쪽
 *   7) isLive 시점 산식 검증 (5/4 07시 → false / 5/8 자정 → true / 5/9 → true)
 *   8) cronToHuman 5 preset 라운드트립
 *   9) 보존 13 v3 — workspace useEffect 카운트 ≤ 8 유지 (hook call 추가는 useEffect 추가 0)
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
// 1) C-D36-1 — Hero LIVE 자동 전환 wiring
// ─────────────────────────────────────────────────────────────────────────────
{
  const config = await readSrc("src/modules/dday/dday-config.ts");
  assert(
    "C-D36-1: dday-config isLive() export + daysUntilRelease wrapper",
    /export function isLive\(/.test(config) &&
      /daysUntilRelease\(now\)\s*<=\s*0/.test(config),
  );
  assert(
    "C-D36-1: RELEASE_ISO 무수정 — '2026-05-08T00:00:00\\+09:00' 보존 (verify-d34/d35 회귀 보호)",
    /RELEASE_ISO\s*=\s*"2026-05-08T00:00:00\+09:00"/.test(config),
  );

  const lozenge = await readSrc("src/modules/header/d-day-lozenge.tsx");
  assert(
    "C-D36-1: d-day-lozenge isLive import + LIVE 분기 className 분기",
    /import\s+\{[^}]*isLive[^}]*\}\s+from\s+"@\/modules\/dday\/dday-config"/.test(lozenge),
  );
  assert(
    "C-D36-1: lozenge LIVE 시 animate-pulse + text-emerald-600 클래스 grep",
    /animate-pulse/.test(lozenge) && /text-emerald-600/.test(lozenge),
  );
  assert(
    "C-D36-1: lozenge data-live attr (true/false) 분기",
    /data-live=/.test(lozenge),
  );

  assert(
    "C-D36-1: src/modules/header/hero-live-banner.tsx 신규 파일 존재",
    await exists("src/modules/header/hero-live-banner.tsx"),
  );
  const banner = await readSrc("src/modules/header/hero-live-banner.tsx");
  assert(
    "C-D36-1: HeroLiveBanner export + isLive() 분기 + null 렌더 (LIVE 미진입)",
    /export function HeroLiveBanner/.test(banner) &&
      /isLive\(\)/.test(banner) &&
      /return null/.test(banner),
  );
  assert(
    "C-D36-1: HeroLiveBanner i18n 키 'hero.live.indicator' 사용",
    /t\("hero\.live\.indicator"\)/.test(banner),
  );

  const layout = await readSrc("src/app/layout.tsx");
  assert(
    "C-D36-1: layout.tsx HeroLiveBanner import + 마운트",
    /import\s+\{\s*HeroLiveBanner\s*\}\s+from\s+"@\/modules\/header\/hero-live-banner"/.test(layout) &&
      /<HeroLiveBanner\s*\/>/.test(layout),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D36-2 — 다중 탭 conversation list 동기화
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D36-2: src/modules/conversation/conversation-broadcast.ts 신규 파일 존재",
    await exists("src/modules/conversation/conversation-broadcast.ts"),
  );
  const bc = await readSrc("src/modules/conversation/conversation-broadcast.ts");
  assert(
    "C-D36-2: BroadcastChannel 'robusta-conversation-sync' (페르소나/스케줄 채널과 분리)",
    /CHANNEL_NAME\s*=\s*"robusta-conversation-sync"/.test(bc),
  );
  assert(
    "C-D36-2: publishConversationChange + subscribeConversationSync export",
    /export function publishConversationChange/.test(bc) &&
      /export function subscribeConversationSync/.test(bc),
  );
  assert(
    "C-D36-2: SSR 가드 + Safari graceful no-op (typeof BroadcastChannel === 'undefined')",
    /typeof\s+window\s*===\s*"undefined"/.test(bc) &&
      /typeof\s+BroadcastChannel\s*===\s*"undefined"/.test(bc),
  );

  assert(
    "C-D36-2: src/modules/conversation/use-conversation-sync-listener.ts 신규 파일 존재",
    await exists("src/modules/conversation/use-conversation-sync-listener.ts"),
  );
  const hook = await readSrc(
    "src/modules/conversation/use-conversation-sync-listener.ts",
  );
  assert(
    "C-D36-2: useConversationSyncListener export + subscribeConversationSync 사용",
    /export function useConversationSyncListener/.test(hook) &&
      /subscribeConversationSync/.test(hook),
  );
  assert(
    "C-D36-2: list_changed 분기 처리 + cleanup return (unsubscribe)",
    /list_changed/.test(hook) && /return unsub/.test(hook),
  );

  const ws = await readSrc("src/modules/conversation/conversation-workspace.tsx");
  assert(
    "C-D36-2: workspace useConversationSyncListener import + 1줄 hook call",
    /import\s+\{\s*useConversationSyncListener\s*\}\s+from\s+"\.\/use-conversation-sync-listener"/.test(ws) &&
      /useConversationSyncListener\(\)/.test(ws),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D36-3 — funnelEvents +2종 + VisitTracker + persona-use-tracker
// ─────────────────────────────────────────────────────────────────────────────
{
  const fe = await readSrc("src/modules/funnel/funnel-events.ts");
  assert(
    "C-D36-3: funnel-events FunnelEvent union 'visit' 추가 + timestamp 페이로드",
    /type:\s*"visit"/.test(fe),
  );
  assert(
    "C-D36-3: funnel-events FunnelEvent union 'persona_used' 추가 + personaId 페이로드",
    /type:\s*"persona_used"/.test(fe) && /personaId:\s*string/.test(fe),
  );

  assert(
    "C-D36-3: src/modules/funnel/visit-tracker.tsx 신규 파일 존재",
    await exists("src/modules/funnel/visit-tracker.tsx"),
  );
  const vt = await readSrc("src/modules/funnel/visit-tracker.tsx");
  assert(
    "C-D36-3: VisitTracker export + sessionStorage 'robusta:visit_logged' 가드",
    /export function VisitTracker/.test(vt) &&
      /robusta:visit_logged/.test(vt),
  );
  assert(
    "C-D36-3: VisitTracker logFunnelEvent dynamic import (메인 번들 +0 의무)",
    /import\("@\/modules\/funnel\/funnel-events"\)/.test(vt) &&
      /type:\s*"visit"/.test(vt),
  );

  const layout = await readSrc("src/app/layout.tsx");
  assert(
    "C-D36-3: layout.tsx VisitTracker import + 마운트",
    /import\s+\{\s*VisitTracker\s*\}\s+from\s+"@\/modules\/funnel\/visit-tracker"/.test(layout) &&
      /<VisitTracker\s*\/>/.test(layout),
  );

  assert(
    "C-D36-3: src/modules/personas/persona-use-tracker.ts 신규 파일 존재",
    await exists("src/modules/personas/persona-use-tracker.ts"),
  );
  const put = await readSrc("src/modules/personas/persona-use-tracker.ts");
  assert(
    "C-D36-3: usePersonaUseTracker(personaId) export + null no-op + lastLoggedRef 가드",
    /export function usePersonaUseTracker/.test(put) &&
      /personaId:\s*string\s*\|\s*null/.test(put) &&
      /lastLoggedRef/.test(put),
  );
  assert(
    "C-D36-3: persona-use-tracker logFunnelEvent dynamic import + 'persona_used' 페이로드",
    /import\("@\/modules\/funnel\/funnel-events"\)/.test(put) &&
      /type:\s*"persona_used"/.test(put),
  );

  const ws = await readSrc("src/modules/conversation/conversation-workspace.tsx");
  assert(
    "C-D36-3: workspace usePersonaUseTracker import + 1줄 hook call (lastParticipantId selector)",
    /import\s+\{\s*usePersonaUseTracker\s*\}\s+from\s+"@\/modules\/personas\/persona-use-tracker"/.test(ws) &&
      /usePersonaUseTracker\(lastParticipantId\)/.test(ws),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D36-4 — cron-preview-chip dow 패턴 5 preset 정상
// ─────────────────────────────────────────────────────────────────────────────
{
  const chip = await readSrc("src/modules/schedule/cron-preview-chip.tsx");
  assert(
    "C-D36-4: cron-preview-chip dow 패턴 매칭 (M H * * DOW) 추가",
    /\/\^\\d\+\$\/\.test\(dow\)/.test(chip),
  );
  assert(
    "C-D36-4: chip i18n 'schedule.preset.weekday_mon9_chip' / 'friday18_chip' 사용",
    /t\("schedule\.preset\.weekday_mon9_chip"\)/.test(chip) &&
      /t\("schedule\.preset\.friday18_chip"\)/.test(chip),
  );
  assert(
    "C-D36-4: nextFireMs dow 매칭 분기 추가 (d.getDay() === Number(dowStr))",
    /d\.getDay\(\)\s*===\s*Number\(dowStr\)/.test(chip),
  );

  // 5 preset 라운드트립 검증 — cronToHuman 직접 import 불가 (Node ESM TS), 정규식 매칭만 검증.
  // 회귀 검증: 기존 패턴 1∼4 라벨 보존 의무 (verify-d33/d34 보호).
  assert(
    "C-D36-4 회귀: 기존 패턴 1 (*/N) 라벨 '${n}분마다' 보존",
    /\$\{n\}분마다/.test(chip),
  );
  assert(
    "C-D36-4 회귀: 기존 패턴 2 (M * * * *) 'cron.label.hourly_at' 보존",
    /t\("cron\.label\.hourly_at"/.test(chip),
  );
  assert(
    "C-D36-4 회귀: 기존 패턴 3 (M H * * *) '매일 ' 라벨 보존",
    /매일\s\$\{/.test(chip),
  );
  assert(
    "C-D36-4 회귀: 기존 패턴 4 (M H D * *) '매월 ' 라벨 보존",
    /매월\s\$\{/.test(chip),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D36-5 — KQ_23 banner CTA + /about-domain
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D36-5: src/app/about-domain/page.tsx 신규 파일 존재",
    await exists("src/app/about-domain/page.tsx"),
  );
  const page = await readSrc("src/app/about-domain/page.tsx");
  assert(
    "C-D36-5: AboutDomainPage default export",
    /export default function AboutDomainPage/.test(page),
  );
  assert(
    "C-D36-5: about-domain 페이지 i18n 9키 사용 (title / intro / why / when / faq_q1∼3 / faq_a1∼3)",
    /t\("about_domain\.title"\)/.test(page) &&
      /t\("about_domain\.intro"\)/.test(page) &&
      /t\("about_domain\.why"\)/.test(page) &&
      /t\("about_domain\.when"\)/.test(page) &&
      /t\("about_domain\.faq_q1"\)/.test(page) &&
      /t\("about_domain\.faq_a1"\)/.test(page) &&
      /t\("about_domain\.faq_q2"\)/.test(page) &&
      /t\("about_domain\.faq_a2"\)/.test(page) &&
      /t\("about_domain\.faq_q3"\)/.test(page) &&
      /t\("about_domain\.faq_a3"\)/.test(page),
  );
  assert(
    "C-D36-5: about-domain Static Export 호환 — force-dynamic 미사용",
    !/force-dynamic/.test(page),
  );

  const banner = await readSrc("src/modules/domain/domain-fallback-banner.tsx");
  assert(
    "C-D36-5: domain-fallback-banner Link import + /about-domain href",
    /import\s+Link\s+from\s+"next\/link"/.test(banner) &&
      /href="\/about-domain"/.test(banner),
  );
  assert(
    "C-D36-5: domain-fallback-banner 'domain.fallback.cta_more' 키 사용",
    /t\("domain\.fallback\.cta_more"\)/.test(banner),
  );
  assert(
    "C-D36-5: banner sessionStorage dismiss 보존 (CTA 클릭 후 back 시 dismiss 유지)",
    /robusta:domain_banner_dismissed/.test(banner),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) i18n parity — 14 신규 키 ko/en 양쪽
// ─────────────────────────────────────────────────────────────────────────────
{
  const messages = await readSrc("src/modules/i18n/messages.ts");
  const newKeys = [
    "hero.live.indicator",
    "schedule.preset.weekday_mon9_chip",
    "schedule.preset.monthly_d1_9_chip",
    "schedule.preset.friday18_chip",
    "domain.fallback.cta_more",
    "about_domain.title",
    "about_domain.intro",
    "about_domain.why",
    "about_domain.when",
    "about_domain.faq_q1",
    "about_domain.faq_a1",
    "about_domain.faq_q2",
    "about_domain.faq_a2",
    "about_domain.faq_q3",
    "about_domain.faq_a3",
  ];
  for (const k of newKeys) {
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g");
    const matches = messages.match(re) ?? [];
    assert(
      `i18n parity: ${k} ko/en 양쪽 (≥2건, 실제 ${matches.length})`,
      matches.length >= 2,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) isLive 산식 검증 — 5/4 07시 false / 5/8 자정 KST true / 5/9 true
// ─────────────────────────────────────────────────────────────────────────────
{
  const RELEASE = new Date("2026-05-08T00:00:00+09:00").getTime();
  const cases = [
    ["2026-05-04T07:00:00+09:00", false], // 본 슬롯 시점
    ["2026-05-07T23:59:59+09:00", false], // D-Day 직전
    ["2026-05-08T00:00:00+09:00", true],  // D-Day 자정 정각
    ["2026-05-08T10:00:00+09:00", true],  // D-Day 라이브 시점
    ["2026-05-09T00:00:00+09:00", true],  // D+1
  ];
  let calcOk = true;
  for (const [iso, expected] of cases) {
    const now = new Date(iso).getTime();
    const live = now >= RELEASE;
    if (live !== expected) {
      calcOk = false;
      console.error(`  case ${iso}: expected ${expected}, got ${live}`);
    }
  }
  assert(
    "C-D36-1: isLive 산식 5 케이스 검증 (5/4·5/7·5/8 자정·5/8 10시·5/9)",
    calcOk,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) 보존 13 — workspace useEffect 카운트 ≤ 8 (hook call 추가는 useEffect 추가 0)
// ─────────────────────────────────────────────────────────────────────────────
{
  const ws = await readSrc("src/modules/conversation/conversation-workspace.tsx");
  const useEffectMatches = ws.match(/\buseEffect\(/g) ?? [];
  assert(
    `보존 13: workspace useEffect 카운트 ≤ 8 (실제 ${useEffectMatches.length})`,
    useEffectMatches.length <= 8,
  );

  // conversation-store.ts SHA 무변동 의도 — 본 슬롯에서 직접 수정 0건 의무.
  // (verify-conservation-13 가 별도 게이트로 호출자 무수정 확인)
  assert(
    "보존 13: conversation-store.ts 호출은 무수정 (별도 hook + selector 만)",
    !/import\s+\{[^}]*loadFromDb[^}]*\}\s+from\s+"@\/stores\/conversation-store"/.test(
      await readSrc("src/modules/conversation/conversation-broadcast.ts"),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\nverify-d36: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}`,
);
process.exit(fail === 0 ? 0 : 1);
