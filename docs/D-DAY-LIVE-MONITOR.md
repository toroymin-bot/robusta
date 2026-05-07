# D-DAY-LIVE-MONITOR.md

<!--
frontmatter:
  cycle: D-D58
  spec: C-D58-3 (D-Day 03시 슬롯, 2026-05-08)
  type: SoP (Standard Operating Procedure)
  scope: read-only
  phase: live (post-monitor, 5/8 00:30 KST 이후)
  changes: 0 (live phase 변경 0/20 정합 — L-D58-1 락)
-->

> **D-Day live phase 진입 후 첫 24h 운영 SoP (단일 문서).**
> 모든 명령은 read-only 의무. `git push` / `npm publish` / 외부 콘솔 변경 0건.
> 본 문서가 정의되어 있는 8 섹션 외 추가 액션 금지 (L-D58-1 변경 0 락).

---

## 1. phase 정합 확인 명령

`scripts/check-live-phase.mjs` (C-D58-2 ⭐) 가 release-freeze-cutoff.ts SoT 4 phase 분기를 1:1 미러로 검증.

```bash
# 현재 phase JSON 1줄 출력 (exit 0)
node scripts/check-live-phase.mjs

# phase 불일치 시 exit 1 (verify:d58 게이트 d58-1 활용)
node scripts/check-live-phase.mjs --expect=live
```

기대: 5/8 01:00 KST 이후 → `phase=live`, `minutesToNext=0`.

---

## 2. funnelEvents Dexie 첫 데이터 확인

브라우저 DevTools → Application → IndexedDB → robusta DB → `funnelEvents` table.

기대 baseline (5/8 첫 24h, C-D58-4 sim:funnel-day1 결과):

| 지표 | baseline | 허용 이격 |
| --- | --- | --- |
| totalRows / 24h | 360 | ±5% |
| perHour | 15 | ±5% |
| event_type 분포 (byok_register / room_open / persona_call / insight_capture) | 40 / 30 / 20 / 10 % | ±5%p |

5% 이상 이격 시 §3 똘이 05시 슬롯에서 KQ_24 신규 의무.

---

## 3. Hero LIVE 자동 전환 DOM 확인

`HeroAriaLiveSlot` (A-D54-자-1 wrapper) 마운트 정합 read-only 검증.

```bash
# 실 서비스 응답 → Hero LIVE 컴포넌트 마운트 정합
curl -s https://robusta.ai4min.com/ko | grep -E '(data-hero-aria-live|hero-live-banner)' | head -3
```

기대: hero-live-banner / data-hero-aria-live-slot 둘 다 응답 HTML 에 존재.

A-D54-자-2 / A-D54-자-3 / D-55-자-2 wiring 본체는 D+1 자율 큐 (live phase 안정성 최우선).

---

## 4. Show HN 응답 캡쳐 시각 (B-D58-1)

5/7 22:00 KST submit 정각 (KQ_23 echo 38) 이후 24h 동안 3 스냅샷:

| 시각 | 시점 | 캡쳐 대상 |
| --- | --- | --- |
| T+0 | 5/7 22:00 KST | submit URL / title / body 정합 |
| T+12h | 5/8 10:00 KST | upvote 수 / comment 수 / 첫 응답 3건 텍스트 |
| T+24h | 5/8 22:00 KST | EOD 누적 응답 / Roy 코멘트 1줄 |

기록 위치: Confluence Task_2026-05-08 §11 EOD 표 (단일 lock — B-D58-5 정합).
다른 채널 (Telegram / Slack / 외부) 0건 의무.

---

## 5. Roy 일일 리포트 8:45 KST

D-Day 첫 결과 자동 보고 (별도 cron job — 본 SoP 범위 외).

본 슬롯에서는 **read-only 확인만**:
- 5/8 8:45 KST 직후 Telegram 보고 도달 정합
- funnelEvents 첫 9h 누적 ≈ 135 rows (15/h × 9h)
- 168 정식 32 사이클 PASS 정합

미도달 시 §5 똘이 09시 슬롯에서 KQ_25 신규.

---

## 6. 168 정식 HARD GATE shared 103 kB 32 사이클 도전

```bash
# 단일 명령
npm run verify:all

# 기대: 40/40 PASS, 총 시간 < 30초
```

연속 사이클 카운터:
- D-D27 ∼ D-D56 = 31 사이클 (5/7 §12 freeze final)
- D-D58 = 32 사이클 도전 (본 슬롯 §2)
- D-D59∼D-D62 = 33∼36 사이클 (D-Day 5 슬롯)

1건이라도 FAIL 시 사이클 끊김 — Komi_Question 즉시 등록.

---

## 7. emergency bypass 미사용 lock (L-D58-3)

freeze 진입 시점(5/7 23:00 KST) 이후 `RELEASE_FREEZE_OVERRIDE=1` 사용 0건 의무.

```bash
# git log 에서 RELEASE_FREEZE_OVERRIDE 사용 commit 검출
git log --since="2026-05-07T23:00:00+09:00" --oneline --grep="RELEASE_FREEZE_OVERRIDE"

# 기대: 빈 출력 (0 commits)
```

verify:d58 게이트 d58-8 가 본 명령을 spawn 하여 자동 검증.

---

## 8. D+1 (5/9) 09:00 KST 진입 직전 chk

D-Day → D+1 전환 직전 §12 꼬미 23시 슬롯 + §11 똘이 21시 EOD 슬롯에서 통합 검증:

- [ ] Show HN 24h 응답 캡쳐 3 스냅샷 모두 §11 EOD 표 등록 (B-D58-1)
- [ ] funnelEvents 24h 누적 vs sim:funnel-day1 baseline 정합 (F-D58-1, ≤5% 이격)
- [ ] Hero LIVE DOM 마운트 24h 연속 정합 (F-D58-2)
- [ ] tag `release/2026-05-08` GitHub 정합 (F-D58-3)
- [ ] `RELEASE_FREEZE_OVERRIDE` 사용 0건 (L-D58-3 / F-D58-5)
- [ ] i18n MESSAGES 변동 0 (ko=300 / en=300, L-D58-4)
- [ ] 168 정식 HARD GATE 32∼36 사이클 모두 PASS
- [ ] D+1 자율 큐 10건 우선순위 lock (F-D58-4 — 변동 0)
- [ ] D-PLUS-1-RETRO-TEMPLATE.md 변수 자리 채움 준비 (C-D58-5)

위 9 항목 모두 PASS 시 D+1 자율 진입 정합.
