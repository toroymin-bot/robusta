# Spec 014 — verify:all D-Day Launch Checklist (단일 명령 통합 게이트)

> **출처:** 꼬미 §6 자율 결정 D-37-자-1 (5/4 11시 슬롯, 98802fd) → 똘이 §7 (5/4 13시 v1, 22839297) C-D37-1 즉시 추인.
> **목표:** D-Day (2026-05-08 10:00 KST) launch 점검을 단일 명령 `npm run verify:all` 로 일괄 실행 — 사람 판단 없이 통과/실패만 확정.

---

## 1. 출처

- **부모 명세:** Confluence Robusta 스페이스 / Task_2026-05-04 §7 (똘이 13시 v1) / C-D37-1 (P0, 최종 추천).
- **꼬미 자율 추인:** §6 (5/4 11시 슬롯) — scripts/verify-all.mjs 통합 게이트 신규 구현 (8.2초, 14 게이트 일괄).
- **꼬미 §8 구현:** §8 (5/4 15시 슬롯) — 본 문서 작성 + Spec 014 launch checklist 정의.
- **상위 컨셉:** Do §3.6 기존 자산 보존 + §6 잡스 원칙 (한 번에 하나, 단순함).

## 2. 단일 명령 사양

```bash
npm run verify:all
```

- **구현:** `scripts/verify-all.mjs` (Node 표준만, 의존성 0).
- **소요 시간:** 약 8.2초 (D-D37 시점, 15 게이트 흡수 후 측정 필요).
- **종료 코드:** 모두 PASS → exit 0 / 1건이라도 FAIL → exit 1 + stderr 상세.
- **사용 시점:** D-1 (5/7) launch 점검 / D-Day (5/8) 사전 검증 / 매 main 푸시 직전.

## 3. 게이트 목록 (D-D37 = 15개)

| # | 게이트 ID | 검증 대상 |
| --- | --- | --- |
| 1 | `check:vocab` | 어휘 룰 — "박다/박았/박음/박제" 신규 파일 안 0건 |
| 2 | `check:i18n` | i18n parity ko/en (모든 키 양 locale 정의) |
| 3 | `check:mcp:budget` | Spec 005 MCP chunkSize ≤ 18 kB (호출자 부재 시 skip-pass) |
| 4 | `verify:conservation-13` | 보존 13 v3 (conversation-store.ts SHA 무변동 + 12 v3 모듈 체크섬) |
| 5–14 | `verify:d27` ∼ `verify:d36` | 사이클별 회귀 게이트 (D-D27 ∼ D-D36, 각 사이클 P0 검증 정합) |
| **15** | **`verify:d37`** | **D-D37 신규 — persona_used 페이로드 확장 (6) + md-mini (12) + persona-hue (4) + Spec 014 (1) = 23/23** |

**자동 흡수 정책:** 신규 사이클 게이트 (D-D38 등) 는 verify-all.mjs `gates` 배열에 `{ id: "verify:dNN", cmd: "node", args: ["scripts/verify-dNN.mjs"] }` 1줄 추가만으로 즉시 통합. 신규 게이트는 verify-all 자체 스펙 무수정.

## 4. 정책 (launch 차단 룰)

1. **게이트 1건이라도 FAIL → launch 중단.** D-Day main 푸시 차단. Roy 알림 의무.
2. **shared First Load JS 103 kB 12 사이클 연속 hard gate** (D-D27 ∼ D-D37). `npm run build` 후 `.next/build-manifest.json` 또는 stdout 파싱으로 검증. 초과 시 즉시 FAIL + diff 표시.
3. **Spec 014 본 문서 부재 시 verify-d37 FAIL.** `specs/spec-014-verify-all-launch-checklist.md` 존재 의무.
4. **D-1 (5/7) launch 점검:** verify:all 1회 + Vercel preview build 1회 + 도메인 fallback 활성 검증 (KQ_23 echo 표준).
5. **D-Day (5/8) 10:00 KST:** verify:all 1회 + Hero D-N → LIVE 자동 전환 ✓ + Show HN submit 동시 진행.

## 5. 자율 정정 (꼬미 §8, D-37-자-1 ∼ 5)

본 명세 구현 시 §6 똘이 §7 명세 경로와 실제 코드 구조 차이 자율 정정:

| ID | 명세 경로 | 자율 정정 (실제 적용) | 사유 |
| --- | --- | --- | --- |
| D-37-자-1 | `docs/specs/spec-014-...md` | `specs/spec-014-...md` | 기존 디렉토리 (spec-005 정합) |
| D-37-자-2 | `src/lib/funnel-events.ts` | `src/modules/funnel/funnel-events.ts` | 보존 자산 위치 (기존) |
| D-37-자-3 | `src/lib/persona-stats.ts` | `src/modules/personas/persona-stats.ts` | 모듈 그룹 정합 |
| D-37-자-4 | `src/lib/md-mini.ts` | `src/modules/conversation/md-mini.ts` | 사용처(message-bubble) 모듈 정합 |
| D-37-자-5 | `src/components/persona-card.tsx` | `src/modules/personas/persona-catalog-card.tsx` | 실제 페르소나 카드 위치 |

> **§9 (똘이 17시) 검수 안건:** 본 자율 정정 5건 모두 추인/취소 결정. 지금까지 보존된 디렉토리 컨벤션 (`src/modules/{group}/*` + `specs/spec-NNN-*.md`) 정합.

## 6. 회귀 보호

- 본 명세는 **문서 1건 + verify-all 게이트 흡수만** — 코드 동작 무영향.
- 보존 13 v3: conversation-store.ts SHA 무변동.
- 외부 dev-deps: +0 (D-D35 SDK 외 일체 금지 정합).
- shared bundle: 영향 0 (런타임 코드 0).

## 7. 검증 명령

```bash
# Spec 014 본 문서 존재 확인
test -f specs/spec-014-verify-all-launch-checklist.md && echo OK

# 단일 명령 통합 게이트 실행
npm run verify:all
# → 15 게이트 모두 PASS 시 exit 0

# 168 정식 HARD GATE — shared 103 kB 12 사이클 연속
npm run build
# → "First Load JS shared by all" 라인 ≤ 103 kB
```

---

_작성: 꼬미 (Komi, Code Claude Opus 4.7) · 2026-05-04 15:20 KST · §8 (5/4 15시 슬롯) C-D37-1 / 똘이 §7 명세 즉시 추인 + 자율 정정 5건 명시._
