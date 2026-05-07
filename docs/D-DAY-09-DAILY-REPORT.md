# D-Day 09:00 KST 일일 리포트 템플릿 (C-D59-5 / B-D59-2)

> **상태:** 1page .md 템플릿 SoT lock — Roy 일일 리포트 8:45 KST 송출 직전 채워서 발행.
> **변수 자리 형식:** `{{VAR_NAME}}` 정형. 값 채우기 전까지는 그대로 유지.
> **placeholder 토큰 정합:** D-56-자-0 SoT — `{{...}}` 형식만 허용, `<__PLACEHOLDER__>` 등 비정형 토큰 금지.

---

## 1. 한 줄 요약

`{{ONE_LINER}}`

(예: "Robusta D-Day live phase 24h 안정성 PASS — 168 정식 38 사이클 / 누적 회귀 790/790 / Show HN 24h 응답 N건 / D+1 자율 큐 진입 정합")

---

## 2. LIVE 24h 핵심 지표 (5건 lock)

| 지표 | 값 | 비고 |
| --- | --- | --- |
| live phase 누적 시간 | `{{LIVE_24H_KEY_5}}` | 5/8 00:00∼5/9 00:00 KST 기준 24h 정합 |
| funnelEvents Dexie 누적 rows | `{{FUNNEL_ROWS_24H}}` | sim baseline 360 vs 실측 비교 |
| Show HN T+24h 응답 캡쳐 | `{{SHOWNH_T24H_RESPONSES}}` | upvotes / comments / position |
| Roy shownhScore | `{{ROY_SHOWNH_SCORE}}` | Roy 입력 단일 채널 (Confluence Task_5/9 §1) |
| 168 정식 HARD GATE shared | `{{SHARED_KB}}` | ≤ 103 kB 락 |

---

## 3. 168 정식 사이클

* 5/8 D-Day 누적 사이클 = `{{CYCLES_168}}` (이전 32 사이클 → §4·§6·§8·§10·§12 +5 = 37, 5/9 §2 +1 = 38 도전).
* shared 103 kB 무손상 의무.
* 14 static 페이지 회귀 0건.

---

## 4. funnelEvents 누적

| 시각 (KST) | rows | 차이 (sim baseline=360/24h) | 비고 |
| --- | --- | --- | --- |
| 5/8 05:00 (live +5h) | `{{ROWS_T5H}}` | sim 75 기준 ±N | C-D59-2 / B-D59-1 |
| 5/8 12:00 (live +12h) | `{{ROWS_T12H}}` | sim 180 기준 ±N | §6 꼬미 11시 캡쳐 |
| 5/8 19:00 (live +19h) | `{{ROWS_T19H}}` | sim 285 기준 ±N | §10 꼬미 19시 |
| 5/9 00:00 (live +24h) | `{{ROWS_T24H}}` | sim 360 기준 ±N | D+1 진입 시점 |

---

## 5. KQ 상태

* Komi_Question 누적: `{{KQ_TOTAL}}` 건.
* Komi_Question 미해소: `{{KQ_OPEN}}` 건.
* KQ_23 echo: `{{KQ_23_ECHO}}` 회 (Show HN submit 5/7 22:00 KST 정각 이후 누적).
* `{{KQ_STATUS}}` (예: "신규 KQ 0건. 모두 해소.")

---

## 6. 자율 정정·추인 누적

| 항목 | 누적 |
| --- | --- |
| 추정 → 사실 확정 누적 | `{{AUTO_FIX_ACK_TOTAL}}` 건 |
| §3 / §5 / §7 / §9 / §11 똘이 추인 완료 | `{{AUTO_FIX_ACK_DONE}}` 건 |
| §4 / §6 / §8 / §10 / §12 꼬미 신규 자율 정정 | `{{AUTO_FIX_NEW}}` 건 |
| 어휘 룰 self-grep 0건 누적 슬롯 | `{{VOCAB_CLEAN_SLOTS}}` |

---

## 7. D+1 우선순위 5건

5/9 자율 슬롯에서 처리할 우선순위 5건 (10건 큐 중 상위 5):

1. `{{D_PLUS_1_TOP_5}}` — 1순위
2. `{{D_PLUS_1_2}}` — 2순위
3. `{{D_PLUS_1_3}}` — 3순위
4. `{{D_PLUS_1_4}}` — 4순위
5. `{{D_PLUS_1_5}}` — 5순위

전체 10건 SoT 는 Confluence Task_2026-05-08 §7 / §11.6 / §12.8 정합 (변동 0 의무).

---

## 8. 부록 — git tag·commit 메타

* git tag: `release/2026-05-08` (annotated, commit `9cd5fdd`)
* `{{TAG_COMMIT_META}}` (taggerDateKST + subject)
* 5/8 D-Day 신규 commit 누적: `{{DDAY_COMMITS}}` 건.
* 5/8 D-Day src/ 변경: 0건 (L-D58-1 / L-D59-1 정합 — `git diff --stat HEAD release/2026-05-08 -- src/` 빈 출력 의무).
