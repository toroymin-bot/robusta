# OCP-APPEND-SPEC

> C-D75-3 (D+3 07시 §4 슬롯, 2026-05-11) — Tori spec C-D75-3 (Task_2026-05-11 §3.6).
> 본 문서 = `check-ocp-append.mjs` SoT. H2 정확히 8개 lock (추가/삭제 금지, OCP append-only).
>
> **사실 정정 인용 (KQ_28-Roy-Echo-2 CLOSED 사유 lock):** 2026-05-10 §X·§8·§6 슬롯의
> "이중 미진입" 가설은 무효화됨. git commit log 4건(218c884 / 5a97f17 / 3e85cd0)이 정상
> 진입 정황. 단일 원인은 **OCP append 절차 1단계 누락** (꼬미 측 책임).

## 1. 컨셉

꼬미/똘이 슬롯 종료 후 산출물의 정합성을 보장하기 위한 4단계 게이트 검증 SoT.

슬롯 종료 4단계:

1. `verify` — verify:all PASS (또는 본 슬롯 verify:dN PASS)
2. `commit` — git commit 1건 이상
3. `push` — git push origin main
4. `OCP append` — Confluence Task_YYYY-MM-DD 페이지에 슬롯 결과 등록 (본체 1bit 수정 0)

본 SoT는 단계 4(OCP append) 누락만을 검출한다. 단계 1∼3은 git/CI 측에서 가드.

KQ_28 재발 방지 본체. 시스템 fault 신호가 아닌 절차 누락을 절차 자동화로 차단한다.

## 2. 4단계 정의

| 단계 | 의무 산출물 | 통과 기준 |
| --- | --- | --- |
| 1. verify | verify:all 8/8 (또는 verify:dN PASS) | exit code 0 |
| 2. commit | git commit 1건 이상 with 슬롯 ID + KST 시각 | git log --since=slot_iso 결과 ≥ 1 |
| 3. push | git push origin main | `git ls-remote origin` 정합 |
| 4. OCP append | Confluence Task_YYYY-MM-DD 본 슬롯 v_n+1 OCP append | page version 갱신 + lastModified ≤ commit_iso + 30min |

4단계 모두 통과 시점이 슬롯 종료 인정 기준. 누락 1건이라도 발생하면 차기 슬롯에서 회복 의무.

## 3. commit 메시지 컨벤션

본 슬롯 commit (꼬미 §2 f9732b4 1:1 미러):

```
komi: <YYYY-MM-DD HH:MM KST> §<N> <한 줄 요약>
```

* 시각 = KST 정시 + 분 (예: `2026-05-11 03:30 KST`).
* 슬롯 ID = §<N>은 본 페이지의 §0 슬롯 인덱스 참조.
* 한 줄 요약 = 본 슬롯의 단일 책임 압축 (verify/lock/echo 등 키워드 + 사실 정정 시 인용).

다중 commit 허용 — 단 최후 commit이 4단계 종료 신호로 간주된다.

## 4. Confluence version 메타 매칭 룰

`commit_iso` 이후 `appendWindowMin`(기본 30분) 내에 Task_YYYY-MM-DD 페이지의
`page_last_modified_iso`가 갱신되어야 한다.

매칭 룰:

* `pageMs - commitMs ≤ appendWindowMin × 60_000` → 통과
* page version 메타가 갱신되지 않은 경우 → `page_last_modified_iso = null` 로 기록 → 자동 missed
* page version 갱신은 본체 1bit 수정 없이 OCP append 만으로 트리거 (OCP §3.4)

## 5. 누락 검출 룰

`check-ocp-append.mjs` 로직:

```
for each entry in entries:
  commitMs = Date.parse(entry.commit_iso)
  pageMs   = Date.parse(entry.page_last_modified_iso) // null/NaN 허용
  window   = entry.append_window_min × 60_000        // default 30min
  if !isFinite(pageMs) or (pageMs - commitMs) > window:
    missed.push({ slot_who, slot_iso, commit_sha, commit_iso, last_page_modified })
```

분석 윈도우: `since`(default `now - 7d`) ≤ slot_iso ≤ `until`(default `now`).
동일 슬롯 다중 entry → 첫 entry만 count. 미래 슬롯 (slot_iso > until) → 분석 제외.

## 6. 누락률 % 정의

```
missRatePercent = entries.length === 0
  ? null
  : Math.round((missed.length / entries.length) * 1000) / 10
```

소수점 1자리 round. 정상 = 0.0%. 빈 분석 = null.

## 7. 알람 정책

| missRatePercent | 알람 단계 | 사후 조치 |
| --- | --- | --- |
| 0.0% | 정상 | echo 1줄 (차기 슬롯 인계 메모) |
| 0.0% < x ≤ 50% | KQ echo 1줄 (차기 똘이 슬롯) | 차기 똘이 슬롯에서 사유 확인 + 회복 큐 |
| > 50% | KQ 신규 + 빨강 호출 후보 | KQ_28-Roy-Echo-N 발동 검토 (자가 보정 실패 시) |

빨강 호출은 자가 보정 실패 시에만 발동. 단발 누락은 자가 보정 룰(슬롯 종료 4단계 의무)로 차단.

## 8. 검증 게이트

`verify-d75.mjs` 8/8 게이트 정합 (L-D75-3 정합):

```
node scripts/check-ocp-append.mjs --validate-schema
```

JSONL 스키마 8 필드 lock (추가/삭제 금지):

1. `commit_sha`
2. `commit_msg`
3. `commit_iso`
4. `page_id`
5. `page_last_modified_iso`
6. `append_window_min`
7. `slot_who`
8. `slot_iso`

분석 윈도우 default 7d, append 윈도우 default 30min. KST 고정 +09:00 (DST 0).

본 문서 변경 = OCP 정합 (append-only, H2 8개 정확 lock — 추가/삭제 금지).
