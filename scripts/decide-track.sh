#!/usr/bin/env bash
# scripts/decide-track.sh — D-11.0 KEY 분기 결정 (Komi_Spec_Day6_LiveVerify §1)
# stdout: "[track] A" 또는 "[track] B (사유: ...)"
# 사용:
#   ./scripts/decide-track.sh
#   TRACK=$(./scripts/decide-track.sh | awk '/\[track\]/ { print $2 }')
# 규칙:
#   1) ANTHROPIC_API_KEY가 환경에 있고 비어있지 않으면 → A
#   2) 비어있거나 없으면 → 30초 가용 키 탐지 (추정 24·25 검증)
#   3) 발급 불가/30초 막힘 → B
# 비용: 신규 키 발급 시도 X (Do §공통.8 — 로이 카드 영향 X 한도).

set -u

emit_track_a() {
  printf '[track] A\n'
  exit 0
}

emit_track_b() {
  local reason="$1"
  printf '[track] B (사유: %s)\n' "$reason"
  exit 0
}

# 1. 환경변수 직접 확인. printenv는 빈 문자열도 0바이트로 출력.
KEY_BYTES=$(printenv ANTHROPIC_API_KEY 2>/dev/null | tr -d '\r\n' | wc -c | tr -d ' ')
if [ -n "${KEY_BYTES:-}" ] && [ "${KEY_BYTES}" -gt 10 ]; then
  emit_track_a
fi

# 2. 30초 자율 탐지 — 자격증명 파일 grep (꼬미 자체 환경만, 신규 발급 X).
if [ -f "$HOME/.anthropic/credentials" ]; then
  if grep -qE '^[[:space:]]*(api[_-]?key|key)[[:space:]]*[:=][[:space:]]*sk-ant-' "$HOME/.anthropic/credentials" 2>/dev/null; then
    emit_track_b "credentials 파일 발견했으나 자동 추출 미지원 — 안전상 B로 진입"
  fi
fi

# 3. fallback — KEY 부재 (가장 흔한 경로).
emit_track_b "KEY_ABSENT"
