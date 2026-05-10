# INSIGHT-LIBRARY-SPEC

> **이 문서의 위상.** Insight Library 단일 진실 원천 (SoT). C-D71-3 (§6.5) 본체 lock.
>
> **OCP 정합.** H2 정확히 8개 lock — verify:d71 G1 정규식 정합 의무. H2 추가/삭제 시 본 문서 v_n+1 마이그레이션 Spec 별도 등록.

## 1. 컨셉

Robusta의 컨셉은 "AI들과의 다자간 대화로 통찰을 끌어내는 도구" (Do §1.1). Insight Library는 사용자가 모든 방에서 캡처한 통찰을 사용자별 단일 영구 저장소에 누적하는 자산화 흐름이다. F-D70-2 Capture 의 자연스러운 종착지이며, B-D70-2 Receipt 와 결합해 회의 → 카드 → 라이브러리의 3단 통찰 흐름을 완성한다.

## 2. 진입

| 진입 경로 | 조건 | 자동/수동 |
| --- | --- | --- |
| Capture 수동 핀 | F-D70-2 핀 버튼 클릭 | 수동 |
| Receipt 자동 적재 | B-D70-2 세션 종료 시 발행된 카드 전부 | 자동 |
| 사용자 직접 추가 | 라이브러리 페이지에서 "통찰 추가" 메뉴 | 수동 |

## 3. 저장 모델

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | string | 통찰 고유 식별자 (msg id 기반 또는 UUID) |
| roomId | string | 발생 방 식별자 |
| score | number | extract-insight-candidates 점수 (0∼5) |
| text | string | 메시지 텍스트 발췌 |
| speakerId | string | 발화자 식별자 (페르소나/AI/인간) |
| ts | string | ISO 8601 시각 |
| category | string | 의사결정 / 아이디어 / 사각지대 / 기타 |
| tags | string[] | 사용자 자유 입력 태그 |

## 4. 카테고리

| 카테고리 | 매칭 규칙 | B-D70-3 시나리오 정합 |
| --- | --- | --- |
| 의사결정 | reasons에 'contradicts' + 'contains-number' | "이 결정 어떻게 생각해?" |
| 아이디어 | reasons에 'length>=200' + '3-speaker-rotation' | "거친 아이디어 던짐" |
| 사각지대 | reasons에 'qa-pair' + 'contradicts' | "내가 놓친 거 없나?" |
| 기타 | 위 3개 미해당, score ≥ minScore | 잔여 |

## 5. 검색

| 검색 차원 | 입력 | 매칭 |
| --- | --- | --- |
| 키워드 | text 부분 일치 (대소문자 무시) | text.includes(query) |
| 카테고리 | 4종 enum 필터 | category === filter |
| 날짜 범위 | from / to ISO | ts ∈ [from, to] |
| 발화자 | speakerId enum | speakerId === filter |

F-D71-1 Re-surface 는 본 검색 위에 유사도 layer 1개 추가 (별도 Spec).

## 6. 동기화

| 모드 | 기본 | 비고 |
| --- | --- | --- |
| 로컬 우선 | 활성 | IndexedDB (Dexie v3 storage 모듈 wrap, 보존 13 정합) |
| 클라우드 백업 | 비활성 (옵션) | 사용자 수동 활성 시 BYOK 토큰으로 사용자 본인 저장소만 |
| 외부 전송 | 0 | BYOK 원칙 — 사용자 키 외부 송신 금지 |

## 7. 보존 정책

| 항목 | 정책 |
| --- | --- |
| 저장 위치 | IndexedDB (Dexie v3 storage 모듈 wrap, 보존 13 정합) |
| 보존 기간 | 사용자 수동 삭제 시까지 영속 |
| 자동 만료 | 옵션 30일 (사용자 명시 활성 시만) |
| 마이그레이션 | Dexie v3 → v4 시 별도 Spec 필요 (Do §3.6 정합) |

## 8. 검증 게이트

| 게이트 | 검증 |
| --- | --- |
| verify:d71 G1 | 본 문서 H2 정확히 8개 (^## \d+\. grep == 8) |
| verify:d71 G6 | extract-conflict-pairs 테스트 6/6 PASS |
| 보존 정합 | src/ 변경 0 lock 사수 (L-D71-1 자동 보장) |
| 어휘 룰 | 본 문서 자체 self-grep 4종 금지어 0건 (CLAUDE.md 정합) |

---

_C-D71-3 작성: 똘이 (Tori, Web Claude) §6.5 본체 lock · 꼬미 (Komi, Code Claude) §4 D+2 19시 자율 진입 슬롯 1:1 구현 · 2026-05-10 15:10 KST · OCP H2 8개 lock 정합._
