#!/usr/bin/env bash
# pre-commit-freeze.sh
#   - C-D52-4 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-4 (B-D52-1 본체).
#
# Why: 5/7 23:00 KST hard cutoff release freeze 자동 차단.
#   B-D51-4 정책 락 강제력 강화 — pre-commit hook 단계에서 commit 차단.
#   RELEASE_FREEZE_OVERRIDE=1 env 시 emergency bypass.
#
# 자율 정정:
#   - D-52-자-5: 명세는 husky 또는 scripts/hooks/ 경로 자율 결정 권한 부여 (§ 11 추정 3).
#                실 husky 미사용 (.husky 디렉토리 부재 + package.json devDeps에 husky 없음).
#                scripts/hooks/pre-commit-freeze.sh 채택 — Roy 또는 자동 wiring으로 .git/hooks/pre-commit
#                심볼릭 링크 또는 수동 호출 가능.
#   - D-52-자-6: 명세 추정 1 NOW_ISO env 미명시 — 테스트 가능성 위해 NOW_ISO_OVERRIDE env 추가.
#                production 호출 시 NOW_ISO_OVERRIDE 미설정 → TZ='Asia/Seoul' date -Iseconds 사용.
#
# 정책:
#   - FREEZE_ISO = 2026-05-07T23:00:00+09:00 (Release D-Day 5/8 진입 직전 1h cutoff).
#   - NOW_ISO_OVERRIDE 설정 시 테스트 시점 주입.
#   - RELEASE_FREEZE_OVERRIDE=1 설정 시 emergency bypass (exit 0).
#   - NOW > FREEZE 시 stderr 메시지 + exit 1.
#   - NOW ≤ FREEZE 시 exit 0.
#
# 외부 dev-deps +0 (bash + GNU coreutils).

set -e

FREEZE_ISO="2026-05-07T23:00:00+09:00"

# 자율 정정 D-52-자-6: NOW_ISO_OVERRIDE 테스트 주입 지원.
if [ -n "$NOW_ISO_OVERRIDE" ]; then
  NOW_ISO="$NOW_ISO_OVERRIDE"
else
  # KST 강제 — TZ 미설정 환경에서도 일관된 결과.
  NOW_ISO=$(TZ='Asia/Seoul' date -Iseconds 2>/dev/null || TZ='Asia/Seoul' date '+%Y-%m-%dT%H:%M:%S+09:00')
fi

# RELEASE_FREEZE_OVERRIDE=1 → emergency bypass.
if [ "$RELEASE_FREEZE_OVERRIDE" = "1" ]; then
  echo "[pre-commit-freeze] RELEASE_FREEZE_OVERRIDE=1 — emergency bypass (now=$NOW_ISO)" >&2
  exit 0
fi

# 문자열 비교 (ISO 8601 정렬 가능).
if [ "$NOW_ISO" \> "$FREEZE_ISO" ]; then
  echo "[pre-commit-freeze] RELEASE FREEZE active." >&2
  echo "  now=$NOW_ISO" >&2
  echo "  freeze=$FREEZE_ISO" >&2
  echo "  Set RELEASE_FREEZE_OVERRIDE=1 to bypass (emergency only)." >&2
  exit 1
fi

exit 0
