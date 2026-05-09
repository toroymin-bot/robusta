# LIVE-MONITORING-SOP

> **위상:** D-Day 이후 LIVE phase 모니터링 단일 진실 원천 (SoT).
> Tori spec C-D67-3 (§20.5.3) — D+1 13:30 KST §7 등록 v8.
>
> **roundtrip 제약 (§15/§18 보정 패턴):** 표는 H2 직속 top-level only. list 내부 nested table 금지.

---

## T+19h Show HN smoke

| window | start | end | owner | evidence |
| --- | --- | --- | --- | --- |
| T+19h | 2026-05-08T17:00:00+09:00 | 2026-05-08T17:30:00+09:00 | 똘이 | docs/showhn-T+19h-*.md |

---

## T+35h handoff

| window | start | end | owner | evidence |
| --- | --- | --- | --- | --- |
| T+35h | 2026-05-09T09:00:00+09:00 | 2026-05-09T10:30:00+09:00 | 똘이 | Task_2026-05-09 §17 |

---

## T+37h cadence

| window | start | end | owner | evidence |
| --- | --- | --- | --- | --- |
| T+37h | 2026-05-09T13:00:00+09:00 | 2026-05-09T14:30:00+09:00 | 똘이 | Task_2026-05-09 §20 |

---

## T+48h capture

| window | start | end | owner | evidence |
| --- | --- | --- | --- | --- |
| T+48h | 2026-05-09T22:00:00+09:00 | 2026-05-09T22:15:00+09:00 | 똘이 | showhn-T+48h-YYYYMMDDTHHMM-KST.png |

---

## T+60h health

| window | start | end | owner | evidence |
| --- | --- | --- | --- | --- |
| T+60h | 2026-05-10T10:00:00+09:00 | 2026-05-10T10:30:00+09:00 | 꼬미 | scripts/check-live-plus-60h.mjs 출력 |

---

> **변경 이력**
>
> - 2026-05-09 꼬미 §8 (C-D67-3 구현) — 신규 등록. H1 1개 + H2 5개 + 각 H2 표 1개 (window/start/end/owner/evidence 컬럼 5종 lock).
