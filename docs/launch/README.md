# Robusta Launch 자료 — 2026-04-30 D5 LIVE

X(Twitter) 트윗 발사용 자료 패키지. 출처: 똘이 D5 슬롯 §23 박힘 + Roy_Request_5 결정.

## 파일

- [`x-tweet-2026-04-30.md`](./x-tweet-2026-04-30.md) — 트윗 본문 + 측정 항목
- [`demo-script-2026-04-30.md`](./demo-script-2026-04-30.md) — 30초 시연 스토리보드 + Roy 직접 녹화 가이드
- [`demo-frames/`](./demo-frames/) — Roy 녹화 결과물 (GIF + 옵션 스크린샷)

## Roy 액션 (10분)

1. Anthropic API 키 1개 확보
2. `demo-script-2026-04-30.md`의 "Roy 직접 녹화 — 30초 GIF 생성 단계" 따라 30초 녹화
3. ffmpeg로 .mov → .gif 변환
4. X에 `x-tweet-2026-04-30.md`의 본문 + .gif 첨부 발사
5. 채팅에 "트윗 발사함 + URL" → 똘이 응답률 측정 슬롯 큐로 진입

## 꼬미 자동화 한계 (정직 박제)

꼬미가 시도했지만 막힘:
- macOS Screen Recording 권한 미부여 (`screencapture` 실패)
- BYOK 진짜 키 보유 X (Sensitive type) → segment ② "키 입력 + ✅ 검증 토스트" 정확히 캡처 X
- segment ③ 라이브 round-robin은 실제 API 호출 필요 (꼬미는 키 X)

→ Roy 직접 녹화가 결과물 정확도 100% 보장.
