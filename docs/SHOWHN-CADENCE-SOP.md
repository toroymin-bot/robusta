# SHOWHN-CADENCE-SOP

> **위상:** Show HN posting cadence 단일 진실 원천 (SoT).
> Tori spec C-D68-3 (§22.5.3) — D+1 17:30 KST §9 등록 v10.
>
> **roundtrip 제약 (§15/§18 보정 패턴):** 표는 H2 직속 top-level only. list 내부 nested table 금지.

---

## T+0 post

| stage | when | owner | channel | evidence |
| --- | --- | --- | --- | --- |
| T+0 | 2026-05-07T22:00:00+09:00 | 로이 | news.ycombinator.com | docs/showhn-T+0-submit.md |

---

## T+12h follow-up

| stage | when | owner | channel | evidence |
| --- | --- | --- | --- | --- |
| T+12h | 2026-05-08T10:00:00+09:00 | 로이 | news.ycombinator.com 코멘트 | docs/showhn-T+12h-followup.md |

---

## T+24h status

| stage | when | owner | channel | evidence |
| --- | --- | --- | --- | --- |
| T+24h | 2026-05-08T22:00:00+09:00 | 똘이 | docs/showhn-T+24h-*.md | scripts/check-show-hn-t24.mjs 출력 |

---

## T+48h capture

| stage | when | owner | channel | evidence |
| --- | --- | --- | --- | --- |
| T+48h | 2026-05-09T22:00:00+09:00 | 똘이 | docs/showhn-T+48h-capture.md | showhn-T+48h-YYYYMMDDTHHMM-KST.png |

---

## T+72h post-mortem

| stage | when | owner | channel | evidence |
| --- | --- | --- | --- | --- |
| T+72h | 2026-05-10T22:00:00+09:00 | 똘이 | docs/showhn-T+72h-postmortem.md | scripts/check-live-plus-72h.mjs 출력 |

---

> **변경 이력**
>
> - 2026-05-09 꼬미 §10 (C-D68-3 구현) — 신규 등록. H1 1개 + H2 5개 + 각 H2 표 1개 (stage/when/owner/channel/evidence 컬럼 5종 lock, DG-D68-1 정합).
