#!/usr/bin/env node
/**
 * verify-all.mjs
 *   - D-Day(2026-05-08) 사전/사후 통합 검증 게이트 — 한 명령으로 모든 회귀 + 정적 게이트 일괄 실행.
 *   - 의존성 0 (node 표준만). dev-deps 추가 0.
 *
 * 실행 게이트 (순차):
 *   1) check:vocab        — 어휘 룰 (저급어 0건)
 *   2) check:i18n         — i18n parity ko/en
 *   3) check:mcp:budget   — Spec 005 MCP chunkSize ≤ 18 kB (호출자 부재 시 skip-pass)
 *   4) verify:conservation-13 — 보존 13 v3 (conversation-store.ts SHA 무변동)
 *   5) verify:d27 ~ verify:d37 — 사이클별 회귀 게이트 11건 (C-D37-5: 15 게이트)
 *
 * 종료 코드:
 *   - 모두 PASS → exit 0
 *   - 1건이라도 FAIL → exit 1
 *
 * 사용:
 *   $ npm run verify:all
 *   $ node scripts/verify-all.mjs
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const gates = [
  { id: "check:vocab", cmd: "node", args: ["scripts/check-vocab.mjs", "--all"] },
  { id: "check:i18n", cmd: "node", args: ["scripts/check-i18n-keys.mjs"] },
  { id: "check:mcp:budget", cmd: "node", args: ["scripts/check-mcp-budget.mjs"] },
  { id: "verify:conservation-13", cmd: "node", args: ["scripts/verify-conservation-13.mjs"] },
  { id: "verify:d27", cmd: "node", args: ["scripts/verify-d27.mjs"] },
  { id: "verify:d28", cmd: "node", args: ["scripts/verify-d28.mjs"] },
  { id: "verify:d29", cmd: "node", args: ["scripts/verify-d29.mjs"] },
  { id: "verify:d30", cmd: "node", args: ["scripts/verify-d30.mjs"] },
  { id: "verify:d31", cmd: "node", args: ["scripts/verify-d31.mjs"] },
  { id: "verify:d32", cmd: "node", args: ["scripts/verify-d32.mjs"] },
  { id: "verify:d33", cmd: "node", args: ["scripts/verify-d33.mjs"] },
  { id: "verify:d34", cmd: "node", args: ["scripts/verify-d34.mjs"] },
  { id: "verify:d35", cmd: "node", args: ["scripts/verify-d35.mjs"] },
  { id: "verify:d36", cmd: "node", args: ["scripts/verify-d36.mjs"] },
  { id: "verify:d37", cmd: "node", args: ["scripts/verify-d37.mjs"] },
  { id: "verify:d38", cmd: "node", args: ["scripts/verify-d38.mjs"] },
  { id: "verify:d39", cmd: "node", args: ["scripts/verify-d39.mjs"] },
  { id: "verify:d40", cmd: "node", args: ["scripts/verify-d40.mjs"] },
  { id: "verify:d40-auto", cmd: "node", args: ["scripts/verify-d40-auto.mjs"] },
  { id: "verify:d42", cmd: "node", args: ["scripts/verify-d42.mjs"] },
  { id: "verify:d43", cmd: "node", args: ["scripts/verify-d43.mjs"] },
  { id: "verify:d44", cmd: "node", args: ["scripts/verify-d44.mjs"] },
  { id: "verify:d45", cmd: "node", args: ["scripts/verify-d45.mjs"] },
  // C-D46-2/3/5 (D-2 03시, 2026-05-06) — verify:all 26→29 자동 흡수.
  // sim:kq23-dismiss는 verify:d46 안에서 호출 (별도 sim:* 카테고리, verify:all 직접 미흡수).
  { id: "verify:shownh-copy", cmd: "node", args: ["scripts/verify-shownh-copy.mjs"] },
  { id: "verify:md-download-bom", cmd: "node", args: ["scripts/verify-md-download-bom.mjs"] },
  { id: "verify:d46", cmd: "node", args: ["scripts/verify-d46.mjs"] },
  { id: "verify:byok-ping", cmd: "node", args: ["scripts/verify-byok-ping.mjs"] },
  // C-D47-1/3/4/5 (D-2 07시, 2026-05-06) — verify:all 29→30 자동 흡수 (verify:d47).
  // sim:byok-demo / sim:rollback-decision / sim:domain-detect는 verify:d47 안에서 호출.
  { id: "verify:d47", cmd: "node", args: ["scripts/verify-d47.mjs"] },
  // C-D48-1∼5 (D-2 11시, 2026-05-06) — verify:all 30→31 자동 흡수 (verify:d48).
  // sim:byok-demo-extended / verify:byok-demo-card는 verify:d48 안에서 호출 (별도 흡수 미필요).
  { id: "verify:d48", cmd: "node", args: ["scripts/verify-d48.mjs"] },
  // 자율 D-49-자-1 (D-2 15시, 2026-05-06) — verify:all 31→32 자동 흡수 (verify:d49).
  // verify:byok-demo-card 5→7 게이트 확장 — verify:d49 내부 호출, 별도 흡수 미필요.
  { id: "verify:d49", cmd: "node", args: ["scripts/verify-d49.mjs"] },
  // 자율 D-50-자-1 (D-2 19시, 2026-05-06) — verify:all 32→33 자동 흡수 (verify:d50-auto).
  // sim:byok-window-boundary는 verify:d50-auto 내부 호출 (별도 흡수 미필요).
  // BYOK 시연(16:00 KST) 종료 후 T+3h09m 시점 — 윈도우 경계 회귀 가드만 추가, 코드 0 수정.
  { id: "verify:d50-auto", cmd: "node", args: ["scripts/verify-d50-auto.mjs"] },
  // C-D51-1∼5 (D-2 23시, 2026-05-06) — verify:all 33→34 자동 흡수 (verify:d51).
  // verify:release-snapshot / verify:d51-hero-dimming / sim:release-snapshot은 verify:d51 내부 호출.
  // B-D51-4 release freeze 5/7 23시 진입 직전 마지막 사이클 — 168 정식 26 사이클 도전.
  { id: "verify:d51", cmd: "node", args: ["scripts/verify-d51.mjs"] },
  // C-D52-1∼5 (D-1 03시, 2026-05-07) — verify:all 34→35 자동 흡수 (verify:d52).
  // sim:use-hero-dimming-opacity / sim:release-snapshot-cron / verify:freeze-hook /
  //   sim:post-auth-recover는 verify:d52 내부 호출 (별도 흡수 미필요).
  // 168 정식 HARD GATE 27 사이클 도전 — D-1 19시간 카운트다운 안정성 사수.
  { id: "verify:d52", cmd: "node", args: ["scripts/verify-d52.mjs"] },
  // C-D53-1∼5 (D-1 07시, 2026-05-07) — verify:all 35→36 자동 흡수 (verify:d53).
  // verify:d53-cron / sim:hero-aria-live-region / sim:kq23-banner-expiry / verify:d53-motion-reduce
  //   는 verify:d53 내부 호출 (별도 흡수 미필요).
  // 168 정식 HARD GATE 28 사이클 도전 — release freeze 5/7 23시 진입 약 16h 전.
  // src/ 변경 최소 — hero-aria-live-region.tsx + kq23-banner-expiry.ts 헬퍼 2건만.
  //   나머지 4 명세 .github/workflows/ + scripts/ + i18n (release freeze 정합 최우선).
  { id: "verify:d53", cmd: "node", args: ["scripts/verify-d53.mjs"] },
  // A-D54-자-1 (D-1 11시, 2026-05-07) — Komi 자율 (§5 명세 미수신).
  //   hero-aria-live-slot 신규 wiring 본체 (C-D52-1 / C-D53-2 D+1 큐 회복) — sibling 마운트만.
  //   hero* 4 (transition/pulse/title-slot/live-banner) 직접 변경 0 — release freeze 정합 최우선.
  //   sim:hero-aria-live-slot은 verify:d54 내부 호출 (별도 흡수 미필요).
  //   168 정식 HARD GATE 29 사이클 도전 — release freeze 5/7 23시 진입 약 11h 30m 전.
  { id: "verify:d54", cmd: "node", args: ["scripts/verify-d54.mjs"] },
  // C-D55-1∼5 (D-1 13시 슬롯 §7 똘이 명세, 2026-05-07) — verify:all 37→38 자동 흡수 (verify:d55).
  //   sim:show-hn-submit은 verify:d55 내부 호출 (별도 흡수 미필요).
  //   168 정식 HARD GATE 30 사이클 도전 — release freeze 5/7 23시 진입 약 9h 30m 전.
  //   show-hn-submit-config.ts (URL/title/body 1.0 final lock, length ratio 0.4 SoT) +
  //   manual-run-button-glow.css (D-D55-3 wiring, hero* 4 직접 변경 0) — release freeze 정합 최우선.
  { id: "verify:d55", cmd: "node", args: ["scripts/verify-d55.mjs"] },
  // C-D56-1∼5 (D-1 19시 슬롯 §9 똘이 명세, 2026-05-07) — verify:all 38→39 자동 흡수 (verify:d56).
  //   sim:show-hn-submit (case 6 OCP append) + sim:release-freeze (4 케이스) 는 verify:d56 내부 호출.
  //   168 정식 HARD GATE 31 사이클 도전 — release freeze 5/7 23시 진입 약 4h 전.
  //   release-freeze-cutoff.ts SoT 단일 (RELEASE_FREEZE_CUTOFF_KST + LIVE_MONITOR_START_KST +
  //   LIVE_MONITOR_DURATION_MIN + SUBMIT_DEADLINE_KST D-56-자-2 신규 통합) — D-1 정책 락 4건 흡수.
  { id: "verify:d56", cmd: "node", args: ["scripts/verify-d56.mjs"] },
  // C-D58-1∼5 (D-Day 03시 슬롯 §2 처리 큐, 2026-05-08) — verify:all 39→40 자동 흡수 (verify:d58).
  //   sim:funnel-day1 + check:live-phase 는 verify:d58 내부 호출 (별도 흡수 미필요).
  //   168 정식 HARD GATE 32 사이클 도전 — D-Day live phase 진입 +3h 시점.
  //   docs/D-DAY-LIVE-MONITOR.md + docs/D-PLUS-1-RETRO-TEMPLATE.md 신규 SoP 2건 +
  //   scripts/check-live-phase.mjs (SoT 1:1 미러) + scripts/sim-funnel-events-day1.mjs +
  //   scripts/verify-d58.mjs 모두 신규 — 기존 파일 수정 0건 (L-D58-1 변경 0 락 정합).
  { id: "verify:d58", cmd: "node", args: ["scripts/verify-d58.mjs"] },
  // C-D59-1∼5 (D-Day 07시 슬롯 §4 처리 큐, 2026-05-08) — verify:all 40→41 자동 흡수 (verify:d59).
  //   check-live-traffic.mjs / check-release-tag.mjs 는 verify:d59 내부 호출 미필요 (read-only 게이트
  //   직접 검증). docs/D-DAY-LIVE-5H-CHECKPOINT.md + docs/D-DAY-09-DAILY-REPORT.md 신규 SoP 2건 +
  //   scripts/verify-d59.mjs + scripts/check-live-traffic.mjs + scripts/check-release-tag.mjs 모두
  //   신규 — 기존 파일 수정 0건 (L-D59-1 변경 0 락 정합 / scripts/verify-all.mjs 본 OCP append 1건만
  //   예외, 기존 40 게이트 변경 0).
  //   168 정식 HARD GATE 33 사이클 도전 — D-Day live phase 진입 +7h 시점.
  //   D-58-자-2 SoT lock 의무 — release-freeze-cutoff.ts 3 상수 ↔ check-live-phase.mjs ↔
  //   sim-release-freeze.mjs 산식 미러 sync 회귀 보호 (verify-d59 G7).
  { id: "verify:d59", cmd: "node", args: ["scripts/verify-d59.mjs"] },
  // C-D62-1∼5 (D-Day 19시 슬롯 §10 처리 큐, 2026-05-08) — verify:all 41→42 자동 흡수 (verify:d62).
  //   scripts/check-slot-gap.mjs + scripts/check-show-hn-window.mjs + docs/D-DAY-SLOT-GAP-RECOVERY.md +
  //   docs/D-DAY-19H-CHECKPOINT.md 모두 신규 — 기존 파일 수정 0건 (L-D62-1 변경 0 락 정합 /
  //   scripts/verify-all.mjs 본 OCP append 1건만 예외, 기존 41 게이트 변경 0).
  //   168 정식 HARD GATE 34 사이클 도전 — D-Day live phase 진입 +18h 시점 §5∼§8 GAP 회복 후.
  //   D-58-자-2 SoT lock 의무 — release-freeze-cutoff.ts 4 상수 ↔ check-live-phase.mjs ↔
  //   sim-release-freeze.mjs ↔ check-show-hn-window.mjs SUBMIT_DEADLINE_KST 미러 sync 회귀 보호
  //   (verify-d62 G6).
  { id: "verify:d62", cmd: "node", args: ["scripts/verify-d62.mjs"] },
  // C-D63-1∼5 (D-Day 21시 EOD §11 슬롯, 2026-05-08) — verify:all 42→43 자동 흡수 (verify:d63).
  //   scripts/check-eod-summary.mjs + scripts/check-show-hn-t24.mjs + docs/D-DAY-EOD-CHECKLIST.md +
  //   docs/D-DAY-INTEGRATED-REPORT.md 모두 신규 — 기존 파일 수정 0건 (L-D63-1 변경 0 락 정합 /
  //   scripts/verify-all.mjs 본 OCP append 1건만 예외, 기존 42 게이트 변경 0).
  //   168 정식 HARD GATE 35 사이클 도전 — D-Day live phase EOD +21h → §12 23시 +23h 시점.
  //   D-58-자-2 SoT lock 의무 — release-freeze-cutoff.ts SUBMIT_DEADLINE_KST ↔
  //   check-show-hn-t24.mjs DEFAULT_SUBMIT_KST 1:1 미러 sync 회귀 보호 (verify-d63 G6).
  { id: "verify:d63", cmd: "node", args: ["scripts/verify-d63.mjs"] },
  // C-D64-1∼5 (D+1 03시 §2 슬롯, 2026-05-09) — verify:all 43→44 자동 흡수 (verify:d64).
  //   scripts/check-d-plus-1-handoff.mjs + scripts/check-show-hn-t48.mjs +
  //   scripts/sim-d-plus-1-handoff.mjs + docs/D-PLUS-1-RUNBOOK.md +
  //   tests/check-d-plus-1-handoff.test.mjs + tests/check-show-hn-t48.test.mjs 모두 신규 —
  //   기존 파일 수정 0건 (L-D64-1 변경 0 락 정합 / scripts/verify-all.mjs 본 OCP append 1건만
  //   예외, 기존 43 게이트 변경 0).
  //   168 정식 HARD GATE 36 사이클 도전 — D+1 live phase +27h 시점.
  //   D_PLUS_1_HANDOFF_KST = '2026-05-09T09:00:00+09:00' 신규 상수 (handoff + sim 1:1 매칭).
  //   D-58-자-2 SoT lock 의무 — release-freeze-cutoff.ts SUBMIT_DEADLINE_KST ↔
  //   check-show-hn-t48.mjs DEFAULT_SUBMIT_KST 1:1 미러 sync 회귀 보호 (verify-d64 G6).
  { id: "verify:d64", cmd: "node", args: ["scripts/verify-d64.mjs"] },
  // C-D65-1∼5 (D+1 07시 §4 슬롯, 2026-05-09) — verify:all 44→45 자동 흡수 (verify:d65).
  //   scripts/check-live-plus-30h.mjs + scripts/check-byok-funnel.mjs +
  //   scripts/sim-live-plus-30h.mjs + docs/INSIGHT-PIN-SPEC.md +
  //   tests/check-live-plus-30h.test.mjs + tests/check-byok-funnel.test.mjs 모두 신규 —
  //   기존 파일 수정 0건 (L-D65-1 변경 0 락 정합 / scripts/verify-all.mjs 본 OCP append 1건만
  //   예외, 기존 44 게이트 변경 0).
  //   168 정식 HARD GATE 37 사이클 도전 — D+1 live phase +31h 시점.
  //   LIVE_PLUS_30H_KST = "2026-05-09T13:00:00+09:00" (5/8 07:00 KST submit 추정 + 30h, 추정값).
  //   D-65-자-1∼5 자율 큐 5건 — env LIVE_PLUS_30H_WINDOW_MIN / env ANALYTICS_PINGS_PATH override /
  //   sid 8자 hex 정규식 / sim totalMs / G8 git 미가용 fallback (모두 backward-compatible).
  { id: "verify:d65", cmd: "node", args: ["scripts/verify-d65.mjs"] },
  // C-D66-1∼5 (D+1 11시 §6 슬롯, 2026-05-09) — verify:all 45→46 자동 흡수 (verify:d66).
  //   check:live-plus-48h / analyze:byok-funnel / sim:live-plus-48h 는 verify:d66 내부 호출
  //   (별도 흡수 미필요, 기존 45 게이트 변경 0).
  //   168 정식 HARD GATE 38 사이클 도전 — D+1 live phase +37h 시점.
  //   LIVE_PLUS_48H_KST = "2026-05-09T22:00:00+09:00" (5/7 22:00 KST submit + 48h, 추정값).
  //   D-66-자-1∼5 자율 큐 5건 — env LIVE_PLUS_48H_WINDOW_MIN / providers unknown 흡수 /
  //   timestamp ISO+09:00 정규식 / sim totalMs / G8 git 미가용 fallback (모두 backward-compatible).
  { id: "verify:d66", cmd: "node", args: ["scripts/verify-d66.mjs"] },
  // C-D67-1∼5 (D+1 15시 §8 슬롯, 2026-05-09) — verify:all 46→47 자동 흡수 (verify:d67).
  //   check:live-plus-60h / analyze:byok-weekly / sim:live-plus-60h 는 verify:d67 내부 호출
  //   (별도 흡수 미필요, 기존 46 게이트 변경 0).
  //   168 정식 HARD GATE 39 사이클 도전 — D+1 live phase +37h cadence 시점.
  //   docs/LIVE-MONITORING-SOP.md SoT 신규 (H2 5개: T+19h/T+35h/T+37h/T+48h/T+60h, owner/evidence lock).
  //   D-67-자-1∼5 자율 큐 5건 — env LIVE_PLUS_60H_WINDOW_MIN / env ANALYTICS_PINGS_PATH override /
  //   LIVE-MONITORING-SOP.md H2 정규식 grep / sim totalMs / G8 git 미가용 fallback (모두 backward-compatible).
  { id: "verify:d67", cmd: "node", args: ["scripts/verify-d67.mjs"] },
  // C-D68-1∼5 (D+1 19시 §10 슬롯, 2026-05-09) — verify:all 47→48 자동 흡수 (verify:d68).
  //   check:live-plus-72h / analyze:byok-cohort / sim:live-plus-72h 는 verify:d68 내부 호출
  //   (별도 흡수 미필요, 기존 47 게이트 변경 0).
  //   168 정식 HARD GATE 40 사이클 도전 — D+1 live phase +41h 시점.
  //   docs/SHOWHN-CADENCE-SOP.md SoT 신규 (H2 5개: T+0/T+12h/T+24h/T+48h/T+72h, stage/owner/channel/evidence lock).
  //   D-68-자-1∼5 자율 큐 5건 — env LIVE_PLUS_72H_WINDOW_MIN / env ANALYTICS_PINGS_PATH override /
  //   SHOWHN-CADENCE-SOP.md H2 정규식 grep / sim totalMs / G8 git 미가용 fallback (모두 backward-compatible).
  { id: "verify:d68", cmd: "node", args: ["scripts/verify-d68.mjs"] },
  // C-D69-1∼5 (D+1 23시 §12 슬롯, 2026-05-09) — verify:all 48→49 자동 흡수 (verify:d69).
  //   check:live-plus-96h / analyze:byok-cohort-retention / sim:live-plus-96h 는 verify:d69 내부 호출
  //   (별도 흡수 미필요, 기존 48 게이트 변경 0).
  //   168 정식 HARD GATE 41 사이클 도전 — D+1 → D+2 전환 슬롯.
  //   docs/SHOWHN-CADENCE-SOP-v2.md SoT 신규 (H2 8개: T+0/T+12h/T+24h/T+48h/T+72h/T+96h/T+120h/T+168h,
  //   컬럼 5종 lock ts_iso/comment_count/upvote/dwell_ms_p50/unique_users, DG-D69-2 정합).
  //   D-69-자-A 자율 정정 권한 행사 1건 — verify-d69 G3 명세 (≥9) ↔ D-D66 G1 lock (정확히 8) 충돌
  //   → (≥8 단조 비감소) backward-compat 보정 (D-D67/D-D68 패턴 미러). F-D69-4 H2 +1 효과 D+2 §1
  //   똘이 추인 큐 deferred. D-69-자-1∼5 모두 본체 §24.6 lock 정합 backward-compat (권한 행사 0).
  { id: "verify:d69", cmd: "node", args: ["scripts/verify-d69.mjs"] },
  // C-D70-1∼5 (D+2 11시 §6 슬롯, 2026-05-10) — verify:all 49→50 자동 흡수 (verify:d70).
  //   check:live-plus-120h / extract:insight-candidates / sim:live-plus-120h 는 verify:d70 내부 호출
  //   (별도 흡수 미필요, 기존 49 게이트 변경 0).
  //   168 정식 HARD GATE 42 사이클 도전 — D+2 LIVE 운영 정합 모니터링 단계.
  //   docs/INSIGHT-RECEIPT-SPEC.md SoT 신규 (H2 정확히 8개: 컨셉/트리거/입력/구조/카드분류/포맷/보존/검증게이트
  //   — B-D70-2 ⭐ Insight Receipt 컨셉 본체).
  //   D-70-자-1∼5 자율 큐 — env LIVE_PLUS_120H_WINDOW_MIN / env INSIGHT_MIN_SCORE override /
  //   INSIGHT-RECEIPT-SPEC.md H2 정규식 grep / sim totalMs / G8 git 미가용 fallback (모두 backward-compatible).
  { id: "verify:d70", cmd: "node", args: ["scripts/verify-d70.mjs"] },
  // C-D71-1∼5 (D+2 19시 §4 슬롯 자율 진입, 2026-05-10) — verify:all 50→51 자동 흡수 (verify:d71).
  //   check:live-plus-144h / extract:conflict-pairs / sim:live-plus-144h 는 verify:d71 내부 호출
  //   (별도 흡수 미필요, 기존 50 게이트 변경 0).
  //   168 정식 HARD GATE 43 사이클 도전 — D+2 LIVE 운영 정합 모니터링 단계.
  //   docs/INSIGHT-LIBRARY-SPEC.md SoT 신규 (H2 정확히 8개: 컨셉/진입/저장모델/카테고리/검색/동기화/보존/검증게이트
  //   — B-D71-1 ⭐ Insight Library 컨셉 본체).
  //   D-71-자-1∼5 자율 큐 — env LIVE_PLUS_144H_WINDOW_MIN / env CONFLICT_MAX_LOOKBACK override /
  //   INSIGHT-LIBRARY-SPEC.md H2 정규식 grep / sim totalMs / G8 git 미가용 fallback (모두 backward-compatible).
  { id: "verify:d71", cmd: "node", args: ["scripts/verify-d71.mjs"] },
  { id: "sim:hero-live", cmd: "node", args: ["scripts/sim-hero-live-transition.mjs"] },
  { id: "dry-run:dday-staging", cmd: "node", args: ["scripts/dry-run-dday-staging.mjs"] },
];

function runGate(gate) {
  return new Promise((resolveGate) => {
    const start = Date.now();
    const child = spawn(gate.cmd, gate.args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      const ms = Date.now() - start;
      resolveGate({ id: gate.id, code: code ?? 1, ms, stdout, stderr });
    });
  });
}

const results = [];
for (const gate of gates) {
  const r = await runGate(gate);
  results.push(r);
  const status = r.code === 0 ? "✓ PASS" : "✗ FAIL";
  const tail = r.stdout.split("\n").filter(Boolean).slice(-1)[0] ?? "";
  console.log(`${status} ${gate.id} (${r.ms} ms) — ${tail.slice(0, 120)}`);
  if (r.code !== 0) {
    console.error(`  stderr: ${r.stderr.slice(0, 400)}`);
  }
}

const failed = results.filter((r) => r.code !== 0);
const totalMs = results.reduce((acc, r) => acc + r.ms, 0);

console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${results.length} · PASS: ${results.length - failed.length} · FAIL: ${failed.length} · 총 시간: ${totalMs} ms`);
console.log("────────────────────────────────────────────────");

if (failed.length > 0) {
  console.error(`\n실패 게이트 ${failed.length}건:`);
  for (const f of failed) {
    console.error(`  - ${f.id} (exit ${f.code})`);
  }
  process.exit(1);
}

console.log("\n✓ verify-all: 모든 게이트 PASS");
process.exit(0);
