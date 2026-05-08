# D-Day +19h Checkpoint SoT

C-D62-5 (D-Day 19시 슬롯 §10, 2026-05-08) — Tori spec C-D62-5 (B-D62-2 / D-D62-2 본체).

본 문서는 D-Day 5/8 17:00 KST 정각 (Show HN submit T+19h 시점, live phase 진입 +17h)
정합 검증 SoT 단일 진실. 8 H2 섹션 의무 + ≥5 변수 자리 정형성.

본 문서는 §9 똘이 17시 슬롯에서 정의된 SoP 본체 — §10 꼬미 19시 슬롯에서 신규 등록.

---

## 1. 목적 (LIVE +19h 정합 검증)

D-Day live phase 진입 후 19시간 경과 시점 정합 검증.

- D-Day phase: live (`check-live-phase.mjs --expect=live` exit 0 의무).
- D+1 5/9 09:00 KST 까지 잔여 시간: 약 14h.
- 본 시점은 Show HN T+19h 4-point 캡쳐 의무 (B-D62-2 SoT lock).
- 168 정식 HARD GATE shared 103 kB 무손상 + 누적 회귀 모든 게이트 PASS 의무.

---

## 2. Show HN T+19h 캡쳐 데이터 4-row 표

본 표는 Confluence Task §11.5 표 SoT 미러. Roy 입력 의무 (자동 fetch 권한 부재).

| 항목 | 값 |
| --- | --- |
| score | `{{SHOW_HN_SCORE_T19}}` |
| comments | `{{SHOW_HN_COMMENTS_T19}}` |
| position (Show HN front) | `{{SHOW_HN_POSITION_T19}}` |
| capture timestamp | `{{SHOW_HN_CAPTURE_TS_T19}}` |

---

## 3. funnelEvents +19h 누적 sim 360 baseline 대비 표

D-D58 sim-funnel-events-day1.mjs 24h baseline 360 rows 기준 +19h 누적 비례.

| 항목 | sim 비례값 (+19h) | 실 누적값 |
| --- | --- | --- |
| total rows | 285 (= 360 × 19/24) | `{{FUNNEL_ROWS_T19}}` |
| byok_register (40%) | 114 | `{{FUNNEL_BYOK_REGISTER_T19}}` |
| room_open (30%) | 85.5 | `{{FUNNEL_ROOM_OPEN_T19}}` |
| persona_call (20%) | 57 | `{{FUNNEL_PERSONA_CALL_T19}}` |
| insight_capture (10%) | 28.5 | `{{FUNNEL_INSIGHT_CAPTURE_T19}}` |

실 누적값 입력은 D+1 5/9 deferral (F-D56-1 funnelEvents Dexie 누적 24h 사후 검증).

---

## 4. 168 정식 사이클 진척

`168 정식 HARD GATE shared 103 kB 14 static 페이지 무손상` 사이클 카운트.

- D-Day 5/8 §4 (07시) 종료 시점: 33 사이클.
- D-Day 5/8 §8 (15시) 자율 모드: 34 사이클 (변동 0 / 빌드 산출물 동일).
- D-Day 5/8 §10 (19시) 도전: `{{ONESIXTYEIGHT_CYCLE}}` 사이클.
- D+1 5/9 09:00 KST 까지 잔여 슬롯: §11 (21시) + §12 (23시) 2 슬롯 + D+1 자율 큐.

---

## 5. verify:all 게이트 진척

- D-Day 5/8 §4 (07시) 종료: 41/41 PASS.
- D-Day 5/8 §8 (15시) 자율 모드: 41/41 PASS (변동 0).
- D-Day 5/8 §10 (19시) 도전: `{{VERIFY_ALL_COUNT}}` (41 → 42 단조 증가 의무, L-D62-2 정합).

---

## 6. git tag 무손상

`release/2026-05-08` annotated tag commit `9cd5fdd` 메타 무손상 의무.

- `node scripts/check-release-tag.mjs` ok=true 의무 (5 게이트 PASS).
- `git for-each-ref refs/tags/release/2026-05-08 --format=%(objectname) %(taggername)` 출력 0 변동.

---

## 7. KQ 신규/echo 상태

| KQ | 상태 | 비고 |
| --- | --- | --- |
| KQ_23 | echo 50번째+ | Roy shownhScore 입력 SoP 동일 채널. T+19h 데이터 입력 의무. |
| KQ_24 | 신규 (§9 등록) | §5∼§8 슬롯 자동 trigger 결손 원인 — Roy 답변 큐 D+1 09:00 KST. |

---

## 8. 다음 4-point T+24h 진입 의무

| 4-point | 시각 KST | 슬롯 | 상태 |
| --- | --- | --- | --- |
| T+0 | 5/7 22:00 | 5/7 §11/§12 | 완료 (Roy 입력 SoT) |
| T+12h | 5/8 10:00 | §6 꼬미 11시 | ❌ 누락 (KQ_24 직접 영향) |
| T+19h | 5/8 17:00 | 본 §9 똘이 17시 (data Roy 입력 큐) | 🟡 의무 진행 |
| T+24h | 5/8 22:00 | §11 똘이 21시 EOD | 예정 |

`{{NEXT_4POINT_LABEL}}` = T+24h. 진입 직전 검증: `node scripts/check-show-hn-window.mjs
--submit-kst=2026-05-07T22:00:00+09:00 --now=<T+24h ISO>` window=T+24h 의무.

---

## 9. 변경 이력

- 2026-05-08 19:30 KST — 꼬미 §10 슬롯 (Komi, Code Claude) 신규 작성 v1
  (C-D62-5 본체 / B-D62-2 SoT lock).
