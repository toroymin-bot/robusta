# D-Day LIVE 트래픽 첫 5h 정합 검증 SoP (B-D59-1 본체)

> **상태:** SoT lock — 본 SoP는 read-only / append-only. 어떤 src/ 코드 수정도 포함하지 않음.
> **시점:** 2026-05-08 05:00 KST (live phase 진입 후 +5h).
> **자동화:** `scripts/check-live-traffic.mjs` (C-D59-2). 본 문서는 SoP 정합 + 산식 sync 의무 lock.

---

## 1. 목적

D-Day 라이브 트래픽 진입 후 첫 5시간 동안의 정합 검증을 단일 SoT 로 정의한다. 본 검사 통과 시점은 `live` phase 안정성을 1차 확정하는 마일스톤이다.

기준 3개 모두 정합:

* `phase=live` (release-freeze-cutoff.ts SoT 4 phase 분기 결과)
* baseline 360 rows (`sim-funnel-events-day1.mjs` 단일 출력)
* window=5h (since/until KST diff = 5 \* 3600 \* 1000 ms)

---

## 2. 시점 정의 (05:00 KST)

* `since` = 2026-05-08T00:00:00+09:00 — `LIVE_MONITOR_START_KST` 와 동일 (모니터 phase 시작 = live 누적 시작).
* `until` = 2026-05-08T05:00:00+09:00 — live phase +5h 정각.
* phase 전이: 00:00 monitor 진입 → 00:30 live 진입 → 05:00 live +4h30m 누적.
  본 SoP 윈도우는 monitor 30 min + live 4h30m = 5h 정각으로 정의 (monitor 누적도 funnelEvents Dexie 쓰기 동일 경로 — F-D56-1 정합).

---

## 3. read-only 검증 의무

본 슬롯에서는 **Dexie 실 데이터 누적은 client-side** 에서 일어난다. 본 SoP 는 다음 3 정합만 read-only 로 검증:

1. baseline=360 정합 — `node scripts/sim-funnel-events-day1.mjs` 출력 첫 케이스 totalRows=360.
2. window=5h 정합 — since/until KST diff ms == 5 \* 3600 \* 1000.
3. phase=live 정합 — `node scripts/check-live-phase.mjs --expect=live` exit 0.

실 누적 검증(Dexie 24h 사후 read-only)은 D+1 deferral 항목(F-D56-1)이며 본 SoP 범위 외.

---

## 4. baseline 360 rows SoT

`sim-funnel-events-day1.mjs` 의 기본 시뮬레이션 결과는 다음 식으로 산출된다:

```
usersPerHour=5 × eventsPerUser=3 × hours=24 = 360 rows
```

본 360 은 단일 SoT 이며, 변경 시 다음 4 곳 동시 갱신 의무:

* `scripts/sim-funnel-events-day1.mjs` (산식의 진실의 원천)
* `docs/D-DAY-LIVE-5H-CHECKPOINT.md` (본 SoP §4)
* `docs/D-DAY-LIVE-MONITOR.md` (D-Day 24h 누적 표 — C-D58-3)
* `docs/D-PLUS-1-RETRO-TEMPLATE.md` (D+1 회고 누적 표 — C-D58-5)

---

## 5. 실패 시 처리

검증 1건이라도 실패할 경우:

* 즉시 정지. 추가 검사 진행 금지.
* 똘이 슬롯에서 KQ 등록 (`Komi_Question_<번호>`) — Roy 호출 정책에 따른 자율 시도 3회 후 빨간색 호출.
* 다음 꼬미 슬롯 인지 큐에 등록.
* live phase 외 호출(`phase != live`) → check-live-traffic.mjs 가 자체 거부 (exit 1).

---

## 6. 산식 미러 sync 의무

`release-freeze-cutoff.ts` 4 상수(RELEASE_FREEZE_CUTOFF_KST / LIVE_MONITOR_START_KST / LIVE_MONITOR_DURATION_MIN / SUBMIT_DEADLINE_KST) 변경 시 다음 2개 .mjs 동시 갱신 의무 (D-53-자-1 / D-58-자-2 락):

* `scripts/sim-release-freeze.mjs` (C-D56-4 / 4 케이스 산식 미러)
* `scripts/check-live-phase.mjs` (C-D58-2 / `computeLivePhase` 산식 미러)

본 sync 정합은 `verify-d59.mjs` G7 게이트로 자동 회귀 보호된다.

---

## 7. D+1 deferral 항목

다음 4 항목은 본 SoP 범위가 아니며, D+1(2026-05-09 09:00 KST 이후) 자율 슬롯 큐에서 처리:

* funnelEvents Dexie 실 데이터 누적 24h 사후 검증 (F-D56-1)
* post-auth-recover.ts 본 운용 활성 (F-D56-1)
* live phase 진입 후 첫 6h funnelEvents 0건 alert 임계 SoT (F-D59-3)
* BYOK 5-provider 첫 토큰 등록 분포 사후 통계 SoP (B-D59-5)

---

## 8. 변경 이력

* 2026-05-08 / 꼬미 / §4 똘이 §3 D-D59 사이클 C-D59-3 명세 본체 신규 작성. 8 H2 SoT lock 등록.
