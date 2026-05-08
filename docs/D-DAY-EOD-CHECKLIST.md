# D-DAY-EOD-CHECKLIST (C-D63-3 / B-D63-1 본체 SoP)

> Tori spec C-D63-3 (2026-05-08 §11 EOD 슬롯 등록).  
> 9 H2 섹션 / 변수 자리 5건 / read-only 의무 / D+1 진입 직전 핸드오프 표준.

본 SoP 는 D-Day 21:00 KST EOD 슬롯에서 한 번 호출. 결과는 다음 §12 꼬미 23시 슬롯과
§17.10 D+1 자율 큐 핸드오프에 반영. 실 데이터 4-row(score / comments / position /
capture_ts) 입력은 `{{TASK_PAGE_DATE}}` Confluence Task §17.8 표 SoT lock.

---

## 1. EOD 시각 (21:00 KST) + phase=`live` +21h

- **시점:** D-Day(`{{TASK_PAGE_DATE}}`) 21:00 KST. live phase +21h (`{{LIVE_PHASE_HOURS}}`).
- **다음 단계:** §12 꼬미 23시(+23h) → §13 5/9 01:00 KST handoff → §17 5/9 09:00 KST 일일 리포트.
- **`check:live-phase` 호출 의무:** `npm run check:live-phase -- --expect=live` → exit 0.
- **read-only 의무:** Confluence Task / GitHub commits / git tag 무손상.

## 2. 회귀 검증 의무

- `npm run verify:all` → `{{VERIFY_ALL_RANGE}}` 단조 증가 (감소 금지).
- 168 정식 HARD GATE shared 103 kB → `{{HARD_GATE_CYCLE_RANGE}}` 단조 증가.
- 누적 회귀: `npm run check:eod-summary -- --regress-start=... --regress-end=...` → ok=true.
- check:vocab + check:i18n parity → 0건 / ko=300 / en=300 무손상.
- D-Day commit 4건 + tag `release/2026-05-08` 무손상 (annotated, commit 9cd5fdd prefix).

## 3. Show HN T+24h 캡쳐 (5/8 22:00 KST) — 4-row 데이터 입력 SoT

- **시점:** `{{TASK_PAGE_DATE}}` 22:00 KST ±15분 (live phase +22h).
- **데이터:** 4-row (score / comments / position / capture_ts).
- **호출 명령:** `npm run check:show-hn-t24 -- --submit=2026-05-07T22:00:00+09:00 --now=$(date -u +%FT%TZ)`.
- **read-only 의무:** 외부 Hacker News API fetch 0건. Roy 또는 EOD 후속 슬롯 입력.
- **저장 위치:** Confluence Task §17.8 표 (단일 SoT lock).

## 4. KQ 응답 큐 인지 (KQ_23 / KQ_24)

- **KQ_23 echo:** Show HN submit + 누적 echo 카운트 (현 EOD 시점 기준).
- **KQ_24 (운영→Roy):** §5/§6/§7 자동 trigger 결손. D+1 5/9 09:00 KST 일일 리포트 슬롯 응답 의무.
- **신규 KQ:** EOD 시점 모호점 발견 시 Confluence Task §17.x Komi_Question 등록.

## 5. D+1 자율 큐 10건 lock (변동 0 의무)

- D-55-자-2 / A-D54-자-2 / A-D54-자-3 / F-D56-1 (post-auth-recover) / F-D56-1 (funnelEvents 24h).
- C-D57-1 / C-D57-2 / C-D57-3 / C-D57-4 / C-D57-5.
- **lock 의무:** 본 EOD 슬롯 시점 변동 0. D+1 진입 직전 재정합 검증.

## 6. 다음 슬롯 (꼬미 §12 23시) 핸드오프 의무

- **명세 큐:** `{{COMMIT_LIST}}` D-Day commit 무손상 + C-D63-1∼5 신규 5건 처리.
- **OCP append 의무:** `scripts/verify-all.mjs` + `package.json` 1건씩만 (verify:d63).
- **168 정식 35 사이클 도전:** HARD GATE shared 103 kB 무손상.
- **추인 큐 0건:** §11 EOD 슬롯에서 D-62-자-1 추인 처리 완료.

## 7. 누락 슬롯 사실 기록 (§5/§6/§7 GAP)

- **사실:** §5/§7(똘이 09시/13시) + §6(꼬미 11시) 자동 trigger 결손.
- **코드 영향:** 0건 (src/ 무손상 / verify:all 단조 증가 무손상).
- **보정:** §8 자율 모드 PASS + §9 D-D62 cycle 정상 등록.
- **사후 분석:** D+1 09:00 KST KQ_24 응답 슬롯 — Roy 운영 메타데이터 점검.

## 8. EOD 통합 통계 표 SoT

| 지표 | D-Day 시작 | D-Day EOD | 증감 |
| --- | --- | --- | --- |
| verify:all | 39 | `{{VERIFY_ALL_RANGE}}` (의무) | 단조 증가 |
| 168 정식 사이클 | 31 | `{{HARD_GATE_CYCLE_RANGE}}` (의무) | 단조 증가 |
| 누적 회귀 | 759 | `{{REGRESS_TOTAL_FINAL}}` | ≥0 의무 |
| commit 수 | 0 | `{{COMMIT_LIST}}` 길이 | ≥0 |
| src/ 변경 | 0 | 0 | 0 의무 |

## 9. EOD 산출 요약

- §10 PASS 인지 + 자율 정정 추인 처리 + §12 꼬미 처리 큐 명세 본체 박힘.
- D-Day EOD 통합 통계 단조 증가 무손상.
- Show HN T+24h(5/8 22:00 KST) 캡쳐 SoP — 4-row 데이터 입력 의무.
- KQ_23 echo / KQ_24 운영→Roy 응답 큐 D+1 deferral.
- D+1 자율 큐 10건 최종 lock (변동 0).
- 가시 변화 0/20 — live phase EOD 안정성 사수.

---

> **변수 자리 5건 (verify:d63 G4 검증):** `{{TASK_PAGE_DATE}}`, `{{LIVE_PHASE_HOURS}}`,
> `{{COMMIT_LIST}}`, `{{VERIFY_ALL_RANGE}}`, `{{HARD_GATE_CYCLE_RANGE}}`.
