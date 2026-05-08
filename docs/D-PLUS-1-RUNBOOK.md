# D+1 Runbook (Live Phase +25h ∼ +49h)

> **Why:** D-Day(2026-05-08) Show HN submit 직후 24h 운영 SoP 본체. D+1 자율 큐 C-D57-4 등록 본체로 §2 꼬미 03시 슬롯에서 락. 본 문서는 D+1 12 슬롯 (똘이 6 + 꼬미 6) 운영 SoT.
>
> **Source of Truth:** `docs/D-PLUS-1-RUNBOOK.md` 본 파일. 모든 슬롯 의무는 본 문서 § 인덱스 참조.

## 1. D+1 phase 정의

* **시각:** 2026-05-09 01:00 KST (live +25h) ∼ 2026-05-10 00:30 KST (live +49h).
* **사이클 도전:** 168 정식 HARD GATE shared 103 kB — 36∼41 사이클 (12 슬롯 × 1 pass 기준 / §12 미확인 시 추인 포함).
* **누적 회귀 누적:** D+1 진입 시점 822/822 (D-D63 §11 EOD 기준) → D+1 종료 시점 누적 산출 의무.
* **변수 자리 1:** `{{D_PLUS_1_HANDOFF_REPORT}}` — §5 09:00 KST handoff 슬롯 3줄 보고 docs path.

## 2. 12 슬롯 인덱스 (똘이 6 + 꼬미 6)

| 슬롯 | 주체 | 시각 KST | 핵심 임무 |
| --- | --- | --- | --- |
| §1 | 똘이 01시 | 01:00∼02:30 | D-D64 사이클 20건 + C-D64-1∼5 명세 + L-D64 lock |
| §2 | 꼬미 03시 | 03:00∼04:30 | C-D64-1∼5 PASS + verify-d64 + 168 정식 36 |
| §3 | 똘이 05시 | 05:00∼06:30 | 꼬미 §2 추인 + D-D65 |
| §4 | 꼬미 07시 | 07:00∼08:30 | C-D65-1∼5 PASS + 168 정식 37 |
| §5 | 똘이 09시 (handoff) | 09:00∼10:30 | **3줄 보고 + Roy shownhScore + KQ_24/25 응답 + Show HN T+35h** |
| §6 | 꼬미 11시 | 11:00∼12:30 | C-D66-1∼5 PASS + 168 정식 38 |
| §7 | 똘이 13시 | 13:00∼14:30 | 꼬미 §6 추인 + D-D67 |
| §8 | 꼬미 15시 | 15:00∼16:30 | C-D67-1∼5 PASS + 168 정식 39 |
| §9 | 똘이 17시 | 17:00∼18:30 | 꼬미 §8 추인 + D-D68 |
| §10 | 꼬미 19시 | 19:00∼20:30 | C-D68-1∼5 PASS + 168 정식 40 |
| §11 | 똘이 21시 (EOD) | 21:00∼22:30 | Show HN T+48h 캡쳐 + D+2 자율 큐 인계 |
| §12 | 꼬미 23시 | 23:00∼00:30 | verify:all final + 168 정식 41 |

## 3. §5 09:00 KST handoff 슬롯 4건 의무

* **3줄 보고:** `{{D_PLUS_1_HANDOFF_REPORT}}` 파일에 정확히 3줄 (`^.+$` non-blank).
* **Roy shownhScore:** `docs/SHOW-HN-T35-2026-05-09.md` 4-row table (header + 1 data row × 4 col).
* **KQ_24 응답:** `## KQ_24` 헤딩 + 본문 ≥1 라인.
* **KQ_25 응답:** `## KQ_25` 헤딩 + 본문 ≥1 라인.
* **자동 검증:** `node scripts/check-d-plus-1-handoff.mjs --slot-kst=2026-05-09T09:00:00+09:00 --report-path=... --kq-list=24,25 --show-hn-data-path=...` → ok=true.
* **변수 자리 2:** `{{KQ_24_RESPONSE}}` — KQ_24 응답 본문.
* **변수 자리 3:** `{{KQ_25_RESPONSE}}` — KQ_25 응답 본문.
* **변수 자리 4:** `{{SHOW_HN_T35_DATA}}` — Show HN T+35h 4-row table.

## 4. §11 21:00 KST EOD 슬롯 의무

* **Show HN T+48h 캡쳐:** `node scripts/check-show-hn-t48.mjs --submit=2026-05-07T22:00:00+09:00 --data-path=docs/SHOW-HN-T48-2026-05-09.md` → ok=true.
* **D+1 통합 검증:** verify:all 게이트 PASS + 168 정식 누적 사이클 + 누적 회귀 산출.
* **D+2 자율 큐 인계:** `Task_2026-05-10` 생성 + 자율 큐 SoT 정합.
* **변수 자리 5:** `{{SHOW_HN_T48_DATA}}` — Show HN T+48h 4-row table.

## 5. KQ_24 / KQ_25 응답 처리 절차

* **KQ_24 (운영→Roy):** 5/8 §5∼§8 자동 trigger 결손 원인 + 회복 정책 의사결정.
* **KQ_25 (운영→Roy):** 5/8 §12 꼬미 23시 미확인 원인 + KQ_24와 합산 분석.
* **응답 docs:** `docs/KQ_24-RESPONSE-20260509.md`, `docs/KQ_25-RESPONSE-20260509.md` (또는 handoff 보고서 통합).
* **§5 09시 슬롯 lock:** Roy 응답 미수신 시 §7 13시 슬롯에서 deferred 처리 + KQ_NN echo 카운트 +1.

## 6. 자율 정정 추인 절차 (꼬미 자율 모드)

* **5/8 GAP 패턴 회복:** 꼬미 자율 모드 진입 시 D-58∼D-60 §5∼§8 GAP fallback 의무.
* **추인 큐:** 다음 똘이 슬롯에서 D-XX-자-N 라벨 추가 + 자율 정정 누적 카운트.
* **권한 한계:** src/ 1bit 수정 권한은 기존 자율 큐 lock 정합 시점에만 (L-D64-1 정합).

## 7. verify:all 게이트 단조 증가 의무

* **D+1 진입:** 43건 (verify:d63 OCP append 후).
* **D+1 종료:** 43∼49건 도전 (꼬미 §2/§4/§6/§8/§10/§12 × 1건씩).
* **OCP append 정합:** 게이트 삭제 0건 / 신규 1건씩만 OCP append.

## 8. 168 정식 HARD GATE shared 103 kB 사이클 변동

* **D+1 진입:** 35 사이클 (§12 미확인 시 추인).
* **D+1 종료:** 36∼41 사이클 도전 (꼬미 §2/§4/§6/§8/§10/§12 × 1 사이클).
* **무손상 의무:** shared 103 kB / 12 static 페이지 무손상.

## 9. release/2026-05-08 git tag 1bit 수정 금지 정책

* **D+1∼D+7:** annotated tag `release/2026-05-08` (commit 9cd5fdd prefix) 1bit 수정 금지.
* **검증:** `git tag -v release/2026-05-08` + `git rev-list -n 1 release/2026-05-08` 정합.
* **위반 시:** 즉시 KQ 신규 등록 + 다음 똘이 슬롯 추인 큐.

## 10. D+2 진입 정합 + Show HN T+72h SoP 락

* **D+2 진입 시점:** 2026-05-10 01:00 KST (live +49h).
* **Show HN T+72h:** 2026-05-10 22:00 KST 캡쳐 의무 — `docs/SHOW-HN-T72-2026-05-10.md`.
* **자율 큐 인계:** D+1 §11 EOD 슬롯에서 D+2 자율 큐 SoT 정합 후 `Task_2026-05-10` 생성.
* **D+2 §1 진입:** 똘이 01:00 KST 슬롯 — D+1 §11 EOD 결과 추인 + D-D69 사이클 등록.
