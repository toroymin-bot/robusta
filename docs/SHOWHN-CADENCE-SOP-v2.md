# SHOWHN-CADENCE-SOP v2

> **위상:** Show HN posting cadence v2 단일 진실 원천 (SoT) — 168h 완성.
> Tori spec C-D69-3 (§24.6.3) — D+1 23시 §12 등록 v12.
>
> **lock 정합:** v1(C-D68-3) H2 5건(T+0/12h/24h/48h/72h)과 v2 H2 8건의 첫 5개 H2 명칭 backward-compatible. 본 v2는 T+96h / T+120h / T+168h 추가 H2 3건 OCP append.
>
> **컬럼 5종 lock (DG-D69-2 정합):** `ts_iso`, `comment_count`, `upvote`, `dwell_ms_p50`, `unique_users` — 단일 행 카드 디자인. 5칸 외 추가/삭제 시 verify-d69 G1 FAIL.
>
> **roundtrip 제약 (§15/§18 보정 패턴):** 표는 H2 직속 top-level only. list 내부 nested table 금지.

---

## T+0

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

## T+12h

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

## T+24h

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

## T+48h

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

## T+72h

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

## T+96h

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

## T+120h

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

## T+168h

| ts_iso | comment_count | upvote | dwell_ms_p50 | unique_users |
| --- | --- | --- | --- | --- |
| (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) | (운영자 입력) |

---

> **변경 이력**
>
> - 2026-05-09 꼬미 §12 (C-D69-3 구현) — 신규 v2 등록. H1 1개 + H2 8개(T+0/12h/24h/48h/72h/96h/120h/168h) + 각 H2 표 1개 (`ts_iso`/`comment_count`/`upvote`/`dwell_ms_p50`/`unique_users` 컬럼 5종 lock, DG-D69-2 정합). v1 본체 1bit 수정 0 — backward-compatible.
