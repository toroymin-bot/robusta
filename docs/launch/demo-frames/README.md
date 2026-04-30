# 데모 프레임 + GIF

꼬미 자동 생성. 2026-04-30 12:07 KST.

## 메인 산출물

**[`robusta-demo-30s.gif`](./robusta-demo-30s.gif)** — 720×349, 30초, 153KB. X(Twitter) 트윗 첨부용.

## 프레임 시퀀스 (각 5초, 총 30초)

| # | 파일 | 보여주는 것 |
|---|---|---|
| 01 | [01-sample-top.png](./01-sample-top.png) | `/sample` 페이지 상단 — Roy/Tori/Komi 3자 대화 시작 (4턴) |
| 02 | [02-sample-bottom.png](./02-sample-bottom.png) | `/sample` 하단 — 6턴 완료 + "내 키로 시작하기" CTA 노출 |
| 03 | [03-main-conversation.png](./03-main-conversation.png) | `/` 라이브 대화 본체 — 꼬미·로이 진짜 대화 (DAY 5 · LIVE) |
| 04 | [04-main-top.png](./04-main-top.png) | `/` 헤더 + 참여자 패널(비판자/꼬미/로이/똘이) + BYOK 키 마스크 |
| 05 | [05-qatest-idle.png](./05-qatest-idle.png) | `/qatest` Trial Mode — 키 로드됨 + Run ping 버튼 대기 |
| 06 | [06-qatest-ok.png](./06-qatest-ok.png) | `/qatest` 200 OK — claude-haiku-4-5 echo + $0.000003 비용 |

## 생성 방법 (재현)

1. Chrome MCP로 4 페이지 navigate + html2canvas 캡처
2. ~/Downloads에 저장 → docs/launch/demo-frames로 복사
3. ffmpeg로 GIF 합성:
   ```bash
   ffmpeg -y -framerate 1/5 -pattern_type glob -i '0*.png' \
     -vf "scale=720:-1:flags=lanczos,palettegen=stats_mode=diff" /tmp/palette.png
   ffmpeg -y -framerate 1/5 -pattern_type glob -i '0*.png' -i /tmp/palette.png \
     -lavfi "scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a" \
     robusta-demo-30s.gif
   ```

## Roy 발사 절차

1. GitHub에서 [robusta-demo-30s.gif](https://github.com/toroymin-bot/robusta/blob/main/docs/launch/demo-frames/robusta-demo-30s.gif?raw=true) 다운로드 (Raw 버튼)
2. X에 [`../x-tweet-2026-04-30.md`](../x-tweet-2026-04-30.md) 본문 + GIF 첨부 발사
3. 채팅에 "트윗 발사함 + URL" → 똘이 24h 응답률 측정 슬롯 진입
