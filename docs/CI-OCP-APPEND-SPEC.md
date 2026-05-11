# CI-OCP-APPEND-SPEC

> C-D76-3 (D+3 15시 §8 슬롯, 2026-05-11) — Tori spec C-D76-3 (Task_2026-05-11 §5.6).
> 본 문서 = `.github/workflows/check-ocp-append.yml` SoT. H2 정확히 8개 lock (추가/삭제 금지, OCP append-only).
>
> **자가 보정 → 코드 강제 승급 사유 (KQ_28-Roy-Echo-3 가설 β 무력화 1줄 인용):**
> "자가 보정 메커니즘 lock 실패 — §4 부재 사실 가설 β(OCP append 절차만 누락) 확정 후
> 4단계 룰 절차 자동화만으로는 재발 불가 — CI 단계에서 강제 차단" (Task_2026-05-11 §5.1).

## 1. 컨셉

자가 보정 4단계 룰 (verify → commit → push → OCP append) 중 단계 4(OCP append) 누락을
**GitHub Actions에서 코드로 강제 차단**한다.

D-D75 본체 `check-ocp-append.mjs`는 로컬/슬롯에서 사후 분석만 가능 — 누락 자체를 막지 못한다.
D-D76 본체 워크플로는 main 브랜치 push 직후 30분 sleep 후 Confluence Task 페이지 version
증가를 확인 — 증가 0건 시 GitHub Actions 실패로 push 자체를 사후 차단 신호로 노출한다.

**컨셉 압축:** OCP append 누락 = CI 실패. 시스템 fault 가설 폐기 + 절차 fault만 lock.

## 2. GitHub Actions trigger

* `on: push: branches: [main]` — main 브랜치 push 직후 자동 실행.
* commit 메시지 prefix 필터: `komi:` 또는 `tori:` 로 시작하는 commit만 워크플로 실행.
  * `chore:` / `docs:` / `ci:` 등 다른 prefix는 skip (job-level `if:` 조건).
  * 슬롯 종료 4단계 의무는 꼬미/똘이 슬롯 commit에만 부과 — 일반 정비 commit은 OCP append 의무 0.
* `pull_request` trigger 0 — push 후 사후 검증 모델 (verify-gate.yml과 동일 패턴).
* `workflow_dispatch` 미사용 — 정시 자동 실행만 정합 (수동 실행 = 절차 무력화 가능성).

## 3. Confluence REST API scope

* GitHub Secret `CONFLUENCE_TOKEN` = Atlassian API token.
* scope: **`read:page:confluence` 한정** — write scope 0.
* 본 워크플로는 read-only — Confluence write 권한 0 (L-D76-3 정책 락 정합).
* 워크플로 YAML 본문에 `write:comment:confluence` / `write:page:confluence` /
  `write:jira-work` 토큰 grep 0건 의무.

## 4. token 보관 룰

* GitHub Secret `CONFLUENCE_TOKEN` — 발급자: 로이 (Atlassian Admin 권한 보유, D-76-자-1).
* 만료 주기: 90일 (Atlassian default).
* 만료 14일 전 재발급 alert — KQ_29 신규 등록 트리거.
* 토큰 만료 시 워크플로 401 → exit 1 + 차기 똘이 슬롯 KQ_29 발화.
* secrets에서만 참조 (env 노출 0 — `${{ secrets.CONFLUENCE_TOKEN }}` 표현식 외 평문 0).

## 5. version 비교 룰

* 단계 4(OCP append) 검출 산식: `POST_VERSION > PRE_VERSION`.
* PRE_VERSION: push 직후 즉시 Confluence Task 페이지 version 조회 baseline.
* POST_VERSION: sleep 30분 후 동일 페이지 version 재조회.
* `POST > PRE` 시 PASS (OCP append 정상 진입).
* `POST == PRE` 시 FAIL (exit 1, OCP append 누락 신호).
* page ID 동적 조회: `Task_$(TZ='Asia/Seoul' date +%Y-%m-%d)` 검색 1 hop (D-76-자-2).
* version 메타 = `/wiki/api/v2/pages/$PAGE_ID` JSON `.version.number` 정수.

## 6. sleep 30분

* 슬롯 종료 4단계 마감 기한 = commit 후 30분.
* 30분 = OCP-APPEND-SPEC §4 `appendWindowMin` 기본값과 1:1 정합.
* tolerance: GitHub Actions runner 트리거 지연 ≈ 30s — sleep 30분 + 트리거 1∼2분 누적 허용.
* sleep 정확성: `run: sleep 1800` (1800초 = 30분).
* timeout-minutes: 45 — sleep 30분 + 트리거/API 호출 여유 15분.

## 7. 실패 시 exit 1

* 워크플로 실패 = GitHub Actions UI에 적색 표시 + 차기 슬롯 진입자에게 시각 알람.
* 차기 똘이 슬롯에서 KQ_29 신규 발화 의무 (workflow 실패 = 시스템 절차 fault 신호).
* 빨강 호출 1건 발화 의무 (자가 보정 메커니즘 lock 실패 시그널 — Task §5.1 KQ_28-Roy-Echo-3 echo).
* 워크플로 자체 commit (.github/workflows/ 변경)은 prefix 필터로 skip — 무한 루프 회피.

## 8. 검증 게이트

* `npm run verify:d76` — 본 워크플로 YAML 구조 lock (8/8 게이트):
  1. C-D76-1 존재 + ESM import 무에러
  2. C-D76-2 존재 + YAML parse 무에러 + `on.push.branches==['main']` + `steps[2].name=='Sleep 30 minutes'`
  3. C-D76-3 존재 + H2 정확히 8개
  4. C-D76-4 존재 + ESM import 무에러 + 3/3 PASS
  5. L-D76-1 정책 락 (보존 13 침범 0)
  6. L-D76-2 정책 락 (어휘 룰 self-grep 0건)
  7. L-D76-3 정책 락 (Confluence write 0 — workflow YAML write 토큰 0건)
  8. L-D76-4 정책 락 (verify:all 단조 lock + 168 정식 사이클 단조)
* L-D76-3 정합 reuse: 본 docs/CI-OCP-APPEND-SPEC.md SoT lock + workflow YAML 1:1 미러.
