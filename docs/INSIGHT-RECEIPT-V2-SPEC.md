# INSIGHT-RECEIPT-V2-SPEC

> 본 파일 = C-D73-3 (D+2 23시 §6 슬롯, 2026-05-10) — B-D73-1 ⭐ 본체 SoT 명세.
> Robusta 통찰 흐름 종착점 (B-D70-2 v1 Receipt → B-D73-1 v2 머지). Do §1.1 "다자간 → 통찰" 직결.
> OCP append-only — H2 정확히 8개 lock (verify-d73 G1 정합). 1bit 수정 시 G1 회귀 발생.

## 1. 컨셉

Robusta 통찰 흐름의 종착점. v1 Receipt(B-D70-2)는 자동 후보 한 흐름만 다뤘으나, v2는 명시 캡처 흐름과 결합한다. 사용자 핀(F-D70-2)과 자동 트리거(C-D72-2 임계 충족)가 같은 Receipt 한 장에 모인다. Robusta 컨셉(다자간 대화 → 통찰)의 "통찰" 출력이 단일 단위로 정의된다.

| 차원 | v1 Receipt (B-D70-2) | v2 Receipt (B-D73-1) |
| --- | --- | --- |
| 입력 흐름 | 자동 후보 only | 자동 후보 ∪ 명시 핀 |
| 진입점 | 세션 종료 시 | 자동 트리거 충족 또는 사용자 핀 |
| 신뢰도 | score 임계 (≥3) | score 임계 + pin score=5 |
| 종착점 | 단일 카드 | DG-D73-1 모달 3 섹션 |

## 2. 진입

사용자 명시(F-D70-2 핀) + 자동 트리거(C-D72-2 임계 충족) 양 경로 정합. 어느 경로든 같은 Receipt JSON을 생성한다.

| 진입 경로 | 트리거 조건 | source 라벨 | score |
| --- | --- | --- | --- |
| 명시 핀 | 사용자가 메시지 핀 클릭 | `pin` | 5 (사용자 명시 신성) |
| 자동 트리거 | 메시지 ≥30 AND 충돌 쌍 ≥2 | `auto` | 0∼5 (휴리스틱) |

## 3. 머지 로직

`extractInsightCandidates(C-D70-2)` ∪ `userPins` → dedup(messageId) → pin 우선. 동일 messageId가 양 경로에 존재하면 pin 항목이 사수된다 (score=5 보존).

```
1) autoItems  = extractInsightCandidates(opts).candidates → source='auto'
2) pinItems   = userPins.lookup(messages).map → source='pin', score=5
3) merged     = Map<messageId, item>; pin 먼저 set, auto 후 미존재만 set
4) items      = Array.from(merged.values())
5) dedupCount = pinCount + autoCount - mergedCount
```

## 4. 카테고리

의사결정 / 아이디어 / 사각지대 / 충돌. C-D71-2 conflict pairs를 4번째 카테고리로 추가 (B-D70-3 시나리오 정합 + D-D71 Insight Library 확장).

| 카테고리 | 진입 휴리스틱 | 대표 예 |
| --- | --- | --- |
| 의사결정 | text에 "결정"/"선택" + 숫자 포함 | "A로 결정. 비용 30%↓" |
| 아이디어 | length≥200 + 3-speaker rotation | 확장된 아이디어 핑퐁 |
| 사각지대 | qa-pair (직전 '?' + length≥100) | "내가 놓친 거 없나?" 응답 |
| 충돌 | C-D71-2 conflict pair 멤버 | "하지만/반면/그러나/however/but" |

## 5. 사용자 인터랙션

DG-D73-1 모달 3 섹션 (통찰 / 요약 / 다음 행동) 1탭 진입. 사용자는 모달 안에서 항목별 핀 추가·해제, 카테고리 필터, 다음 행동 메모를 입력한다.

| 섹션 | 컨텐츠 | 사용자 액션 |
| --- | --- | --- |
| 통찰 | items 카테고리별 리스트 | 핀 토글, 항목 펼침 |
| 요약 | triggerState 바 + mergedCount 배지 | 클릭 시 진단 토글 |
| 다음 행동 | 자유 입력 텍스트 영역 | 저장 (Insight Library 호환) |

## 6. 거짓양성 방지

자동 트리거는 세션당 1회 + dismiss 후 +20 메시지 누적 (C-D72-3 §5 정합 echo). 사용자 핀은 무제한 (사용자 의지 반영). 머지 결과 빈 items도 정상 종료 (`stats` 모두 0).

| 방지 메커니즘 | 적용 대상 | 트리거 |
| --- | --- | --- |
| 세션당 1회 | 자동 트리거 | shouldTrigger=true 1회 발화 후 잠금 |
| +20 누적 후 재발화 | 자동 트리거 (dismiss 후) | dismiss 시점부터 +20 메시지 |
| 무제한 | 사용자 핀 | 핀 클릭 즉시 |

## 7. 보존 정책

Receipt JSON은 IndexedDB에 저장 (INSIGHT-LIBRARY-SPEC C-D71-3 스키마 호환). 사용자 수동 삭제 + 30일 옵션 (D-D71 정합). 외부 fetch 0건 / Dexie v3 사수.

```
IndexedDB.insight_receipts {
  id          string PK
  roomId      string
  receipt     json (mergeInsightReceipt 결과)
  createdAt   ISO 8601
  expiresAt   ISO 8601 | null  -- 30일 옵션 시 createdAt+30d
}
```

## 8. 검증 게이트

verify-d73 G1 (본 파일 H2 정확히 8개 grep) + G3 (KQ-CLOSED-LOG H2 ≥ 8 단조 비감소 + KQ_28 등재 정합) — 1bit 수정 0. C-D73-2 merge-insight-receipt.mjs 6/6 PASS (G6) + tests/merge-insight-receipt.test.mjs 정합.

| 게이트 | 검증 |
| --- | --- |
| G1 | 본 파일 `^## \d+\. ` grep 정확히 8건 |
| G3 | docs/KQ-CLOSED-LOG.md H2 ≥ 8 + KQ_28 등재 |
| G6 | tests/merge-insight-receipt.test.mjs 6/6 PASS |
