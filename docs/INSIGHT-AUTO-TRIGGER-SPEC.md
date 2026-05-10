# INSIGHT-AUTO-TRIGGER-SPEC

> SoT (Single Source of Truth) — Robusta 자동 트리거 흐름 명세 (B-D72-1 ⭐ 본체).
> 작성: 2026-05-10 (D+2 §X 똘이 17시 정시 슬롯, C-D72-3).
> Lock: H2 정확히 8개 — verify-d72 G1 정합. OCP 단조 — H2 추가는 다음 SoT 분리, 본 SoT 8 lock.

## 1. 컨셉

Do §1.1 인용 — "혼자 답을 묻는 게 아니다. 여러 AI를 한 방에 모아 같이 생각한다. 출력은 메시지가 아니라 통찰이다."

본 SoT은 다자간 대화에서 **통찰 정리** 시점을 시스템이 자동 감지하여 사용자에게 CTA를 띄우는 정책을 정의한다. 사용자가 "지금 정리해야 한다"는 인지 부담 없이, 메시지·충돌의 누적이 임계에 도달했을 때 시스템이 신호를 준다.

자동 트리거 = "다자간 충돌 → 통찰" 흐름의 자동화 1차. 사용자 수동 누락 0 보장.

## 2. 트리거 조건

양 조건 AND 결합:

| 변수 | 디폴트 | 설명 |
| --- | --- | --- |
| messageCount | ≥ minMessages (30) | 방 내 메시지 누적 카운트 |
| conflictPairCount | ≥ minConflicts (2) | extractConflictPairs(opts) 결과 pairs.length |

- 메시지 임계 단독으로는 트리거 0 (충돌 없는 단조 대화는 통찰 흐름 부적합).
- 충돌 임계 단독으로는 트리거 0 (메시지 부족 시 통찰 신뢰성 낮음).
- AND 결합으로 거짓양성 최소화.

## 3. 데이터 파이프라인

extract-insight-trigger-state.mjs 스크립트가 단일 진입점.

내부 호출:

| 단계 | 호출 | 출력 |
| --- | --- | --- |
| 1 | extractConflictPairs(opts) (C-D71-2) | { pairs, totalScanned } |
| 2 | messageCount = messages.length | number |
| 3 | shouldTrigger 계산 | boolean (AND 결합) |

read-only — IndexedDB 미접근, 외부 fetch 0건. 호출자가 messages 배열을 직접 인자로 전달 (Dexie 분리).

## 4. 사용자 인터랙션

F-D72-1 게이지 + DG-D72-1 진행 바 + CTA 1탭.

- 우상단 12px 높이 진행 바 (메시지 회색 + 충돌 주황) — DG-D72-1 lock.
- 호버 시 1줄 툴팁: "메시지 25/30 · 충돌 1/2".
- shouldTrigger=true 시 CTA 노출: "통찰 정리 시작". 1탭 시 Receipt 흐름 진입 (B-D70-2 / C-D70-3 정합).

## 5. 거짓양성 방지

| 정책 | 값 | 이유 |
| --- | --- | --- |
| 세션당 자동 트리거 | 최대 1회 | 반복 노출은 사용자 인지 부담 |
| 사용자 dismiss 후 재트리거 | +20 메시지 누적까지 0 | 사용자 의사 존중 |
| 동일 충돌 쌍 재트리거 | 0 (rolling counter) | 동일 신호 반복 방지 |

위 정책은 v1 추정 — LIVE 데이터 검증 후 §5 또는 D+3에서 조정 가능.

## 6. 환경 변수 오버라이드

D-72-자-2 / D-72-자-3 자율 큐 정합. 디폴트 변경 0 — override 만 허용.

| 변수 | 디폴트 | 사용처 |
| --- | --- | --- |
| INSIGHT_TRIGGER_MIN_MESSAGES | 30 | C-D72-2 minMessages 폴백 |
| INSIGHT_TRIGGER_MIN_CONFLICTS | 2 | C-D72-2 minConflicts 폴백 |
| CONFLICT_MAX_LOOKBACK | 5 | C-D71-2 maxLookback 폴백 (정합) |

## 7. 보존 정책

트리거 발화 로그(시각 / shouldTrigger / counts)는 IndexedDB analytics 저장. 사용자 옵트아웃 가능.

- 보존 13 모듈(Storage Dexie v3) 정합 — 신규 store 0, 기존 settings 흐름에 옵트아웃 토글 1건만 OCP append (별 SoT).
- 외부 송신 0건. PII 0.

## 8. 검증 게이트

verify-d72 G3 — 본 SoT 의 H2 정확히 8개 정규식 grep. 1bit 수정 시 즉시 FAIL.

- G1: 본 파일 H2 정확히 8개 (`^## \d+\. ` × 8 + total H2 == 8).
- G3: docs/KQ-CLOSED-LOG.md H2 ≥ 8 (단조 비감소 lock 정합 echo).

본 SoT 변경 시 OCP 정합 의무 — H2 8 lock 사수, 본문 산문은 추가 가능.

### 변경 이력 (Append-only)

| 날짜 | 변경자 | 내용 |
| --- | --- | --- |
| 2026-05-10 | 똘이 (Tori) | C-D72-3 본 SoT 신규. H2 8 lock + B-D72-1/F-D72-1/DG-D72-1 4중 결합 정합. |
