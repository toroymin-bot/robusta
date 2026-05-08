# Insight Pin Spec — UI-only MVP

> **C-D65-3 (D+1 07시 §4 슬롯, 2026-05-09)** — F-D65-2 + DG-D65-2 본체 명세 lock.
>
> 영속화 본체는 **D-D66+ 별도 Spec으로 분리**. 본 명세는 **IndexedDB schema 변경 0 / src/ 변경 0 의무**.
> 본 명세는 명세 본체 lock만 담당하며, 코드 추가는 D-D66+ Spec 진입 전까지 0건.

---

## 1. 컨셉

메시지에 통찰 마크를 부여하여 Robusta `§ 1.1` 컨셉을 가시화한다.

* 출력은 메시지가 아니라 **통찰**이다.
* 사용자가 통찰이라 판단한 시점을 명시적으로 표시한다.
* 핀은 사용자 판단 단발성 — AI 자동 핀 부여는 비범위.
* 핀은 인메모리 (영속화는 D-D66+).

## 2. UI 위치

메시지 카드 우측 상단 ⭐ 토글 아이콘.

* 데스크톱: 호버 시 노출 (`opacity-0 group-hover:opacity-100`).
* 모바일: long-press alt — 카드 길게 누름 시 핀 토글.
* 메시지 카드의 다른 액션과 명확히 분리 (호명 / 복사 / 응답 버튼 등과 독립 슬롯).

## 3. 토큰

핀 활성 시 메시지 카드에 다음 토큰을 적용:

* `border-l-4` — 좌측 4px 보더.
* `border-amber-500` — Tailwind 표준 amber 500 색.
* `pl-2` — 좌측 padding 2 (보더 옆 텍스트 여백).
* `data-type="insight-pin"` — 데이터 속성 (CSS 클래스 아닌 data attr 우선, Confluence Do § 4.1 정합).

활성 토글 자체:

* 비활성 ⭐ 윤곽 (`text-neutral-400`).
* 활성 ⭐ 채움 (`text-amber-500 fill-amber-500`).

## 4. 인터랙션

* **클릭/탭** → 인메모리 토글, 즉시 시각 반영.
* **영속화 0** — 새로고침 시 핀 상태 휘발 (D-D66+ Spec 책임).
* 동일 메시지 다중 핀 = 최종 토글 상태 1개.
* 핀 토글 시 어떤 네트워크 요청도 발생하지 않음.

## 5. a11y

* `role="button"` — 토글 버튼 식별.
* `aria-pressed` — `true` (핀 활성) / `false` (비활성).
* `aria-label` — 한국어 `통찰 핀` / 영어 `insight pin` (i18n § 6 정합).
* 키보드 포커스 가능 (`tabIndex=0`), Enter/Space 로 토글.
* `prefers-reduced-motion` 지원 — 토글 시 transition 0.

## 6. i18n

D-D66+ 진입 시 추가될 키 (현재 ko=300 / en=300 변동 0):

| 키 | ko | en |
| --- | --- | --- |
| `insightPin` | `통찰 핀` | `Insight pin` |

본 명세 단계에서는 **MESSAGES 변동 0** — D-D66+ 적용까지 키 등록 보류 (L-D65-4 정책 락 정합).

## 7. 비범위

* 영속화 (IndexedDB / localStorage 등) — **D-D66+ 별도 Spec**.
* 필터링 (핀 모음만 보기 등) — 비범위.
* 검색 인덱스 — 비범위.
* 외부 공유 (URL / snapshot 등) — F-D65-1 별도.
* AI 자동 핀 부여 — 비범위.
* 핀 카운터 / 통계 — 비범위.

## 8. 검증

* 본 명세는 명세 본체 lock만 담당, 코드 추가 0건.
* `verify-d65 G1` 텍스트 검증 게이트로 본 H2 8개 정합 검증 — 8개 미만 시 G1 FAIL.
* 어휘 룰 self-grep — 위반 패턴 0건 의무.
* `check:i18n` parity ko/en 변동 0 의무 (L-D65-4 락).
* `git diff --stat HEAD release/2026-05-08 -- src/` 빈 출력 의무 (L-D65-1 락).

---

_작성: 꼬미 (Komi, Code Claude Opus 4.7) · 2026-05-09 07:30 KST §4 슬롯 C-D65-3 본체 lock._
