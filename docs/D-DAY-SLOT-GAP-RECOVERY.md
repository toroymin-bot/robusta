# D-Day Slot GAP Recovery SoP

C-D62-3 (D-Day 19시 슬롯 §10, 2026-05-08) — Tori spec C-D62-3 (B-D62-1 본체).

본 문서는 D-Day 운영 슬롯 (똘이 1·5·9·13·17·21시 + 꼬미 3·7·11·15·19·23시 / 12 슬롯)
중 OCP append 누락 슬롯이 detect 되었을 때의 회복 절차 SoP 단일 진실(SoT).

---

## 1. 목적 (B-D62-1 본체)

5/8 D-Day §5 똘이 09시 ~ §8 꼬미 15시 4 슬롯 / 9시간 운영 공백 사례
([KQ_24](https://ai4min.atlassian.net/wiki/spaces/Robusta/pages/24576001) child §2)
재발 방지. live phase 안정성 사수 측면에서 코드 변경 0건 / src/ 무손상 결손은
가장 안전한 형태이지만, 운영 메타데이터 기록 결손은 사후 회고 / Roy 일일 리포트
정합성에 직접 영향. 본 SoP는 detect → 회복 → 사후 등록 3단계 의무 정의.

---

## 2. Detect 의무 (C-D62-2 호출 명령)

매 똘이 슬롯 / 꼬미 슬롯 시작 직후 5분 안에 1회 호출 의무.

```bash
node scripts/check-slot-gap.mjs --expect-slots={{EXPECT_SLOTS}} --body-file=/tmp/{{TASK_PAGE_DATE}}.md
```

- `{{EXPECT_SLOTS}}` 산식: 현재 KST 시각 H 기준 `floor((H - 1) / 2) + 1` (D-Day 12 슬롯 기준).
- `--body-file` 미지정 시 `source=UNRESOLVED` exit 0 — CI 시뮬 모드 (read-only ad-hoc).
- ok=false 이고 source=BODY 인 경우 → 첫 산출물로 GAP 회고 §N 의무 (회복 패턴 4종 §3).

호출 결과 JSON 1줄:

```json
{"slotGap":{"ok":false,"expectSlots":9,"foundSlots":[1,2,3,4],"gapSlots":[5,6,7,8],"source":"BODY"}}
```

---

## 3. 회복 패턴 4종

| 패턴 | 적용 조건 | 회복 액션 |
| --- | --- | --- |
| **추인 만회** | 똘이 슬롯 미수신 + 꼬미 자율 정정 추인 큐 존재 | 다음 똘이 슬롯에서 일괄 추인 (사실 확정 누적 +N) |
| **사이클 deferred** | 똘이 슬롯 미수신 → C-D{N}-1∼5 명세 부재 | 다음 꼬미 슬롯 자율 모드 회귀 검증만 + D+1 backlog 미적재(가시 변화 0/20 정합) |
| **캡쳐 만회** | Show HN T+N 캡쳐 누락 (§6 GAP T+12h 사례) | 다음 4-point (T+19h 또는 T+24h) 슬롯 통합 캡쳐 + 누락 4-point는 표 ❌ 표기 |
| **일일 리포트 통합** | 09시 똘이 8:45 KST 리포트 미발행 | D+1 5/9 09:00 KST 정식 출력으로 1회 통합 (Roy shownhScore 입력 단일 채널) |

---

## 4. 정책 락 4건 unchanged 정합

GAP 회복 슬롯에서도 D-Day 정책 락 4건 무손상 의무:

| 락 | 정합 명령 | unchanged 검증 |
| --- | --- | --- |
| L-D{N}-1 변경 0 | `git diff --stat HEAD release/2026-05-08 -- src/` | 빈 출력 의무 |
| L-D{N}-2 verify:all 단조 증가 | `npm run verify:all` | N → N+1 (감소 금지) |
| L-D{N}-3 emergency bypass 미사용 | `git log --since=... --format=%s` + `^[BYPASS]\s` | 0 hits (D-59-자-3 정형 prefix lock 정합) |
| L-D{N}-4 i18n MESSAGES 변동 0 | `npm run check:i18n` | ko=300 / en=300 (D-55-자-3 정합) |

---

## 5. KQ 등록 의무

GAP 발견 시 `Komi_Question_<번호>` 또는 `KQ_<번호>` Confluence Task 페이지 §N 등록 의무.

- 꼬미 측 GAP (자동 trigger 결손, 명세 모호): `Komi_Question_<번호>` 등록 → 다음 똘이 슬롯 답변 의무.
- 운영 측 GAP (똘이 미수신 등 본 작성자 통제 외): `KQ_<번호>` 운영 카테고리 신규 → Roy D+1 09:00 KST 응답 큐.
- 본 사이클 KQ_NEW_ID: `{{KQ_NEW_ID}}`

---

## 6. 5/6 KQ_24 vs 5/8 KQ_24 사례 비교

본 SoP 의 model case 2건. 동명 KQ 번호이지만 패턴 분기 의무 (회복 SoP 분기 명시).

| 차원 | 5/6 KQ_24 사례 | 5/8 KQ_24 사례 |
| --- | --- | --- |
| 패턴 | 사후 등록 패턴 | onboard 부재 패턴 |
| 결손 시점 | 슬롯 본체 commit 후 self-quote 흡수 사후 등록 | 슬롯 dispatcher 자체 미점화 (본 작성자 Web 세션 비활성 가설 유력) |
| 회복 액션 | 다음 슬롯 child 페이지 OCP append 흡수 | 다음 슬롯 본 SoP §3 패턴 4종 적용 + Roy 답변 큐 등록 |
| 영향 (코드) | 0건 (commit body 흡수만) | 0건 (src/ 무손상) |
| 영향 (메타데이터) | 1슬롯 메타 결손 (사후 회복) | 4슬롯 메타 결손 (D-D60~D-D61 사이클 deferred) |
| 사이클 deferred 여부 | 미적용 | 적용 (D-D60 / D-D61 D+1 backlog 미적재) |

---

## 7. self-grep 의무

본 SoP 작성 + 회복 슬롯 산출물 모두 어휘 룰 self-grep 0건 의무
(`scripts/check-vocab.mjs --all` exit 0). 본 도구는 verify:d62 G3 회귀 게이트로 자동 검증.

추가 의무: placeholder 토큰 0건 (D-56-자-0 재발 방지 SoT). 본 SoP 의 변수 자리 `{{NAME}}`
brace pair 외 평문 토큰 0건 송출 의무.

---

## 8. 사후 등록 SoT (KQ_24 5/6 패턴 차용)

본 SoP 적용 후 회복 슬롯 종료 시 Confluence Task 페이지에 다음 4-row 표 OCP append 의무:

| 항목 | 값 |
| --- | --- |
| TASK_PAGE_DATE | `{{TASK_PAGE_DATE}}` |
| GAP_SLOTS | `{{GAP_SLOTS}}` |
| RECOVERY_SLOT | `{{RECOVERY_SLOT}}` |
| COMMIT_HASH | `{{COMMIT_HASH}}` |

본 SoP 자체는 D-D62 사이클 등록 시점부터 SoT lock — 이후 GAP 발생 사이클 (D-D63+, D+N)
모두 본 SoP 패턴 의무 준수. 변경 시 새 H2 섹션 OCP append 의무 (Do 페이지 §3.4 정합).

---

## 9. 변경 이력

- 2026-05-08 19:30 KST — 꼬미 §10 슬롯 (Komi, Code Claude) 신규 작성 v1
  (B-D62-1 본체 / 5/8 §5∼§8 GAP 사례 model case 1건 흡수).
