# Robusta 30초 시연 스크립트 — 2026-04-30 D5 LIVE

출처: 똘이 D5 LIVE 슬롯 §23 박힘
대상: X(Twitter) 트윗 첨부 + 향후 랜딩 페이지 hero
형식: 30초 GIF (또는 영상). 1280×720 권장. 음성 없음 (X 자동 재생 환경).

## 타임라인 (4 segment, 30초 총)

| Time | Segment | URL | 액션 |
|---|---|---|---|
| **0~5s** | ① 정적 미리보기 | `/sample` | Roy + Tori + Komi 3자 대화 6턴을 위→아래 천천히 스크롤. 각 발언자 색 코드(Roy 회색 / Tori 노랑 / Komi 핑크) 명확히. |
| **5~12s** | ② BYOK 진입 | `/` | 헤더 ⚙ Keys 클릭 → 모달 오픈 → 키 입력 (시연용 마스크: `sk-ant-***...***1AAA`) → ✅ 검증 토스트 → 모달 닫기 → Participants 패널에서 Sonnet 4.6 추가 + Haiku 4.5 추가. |
| **12~22s** | ③ 라이브 대화 | `/` | 메시지 입력창에 "안녕, 셋이 자기소개해 줘" 타이핑 → 전송. AI1(Sonnet) 스트리밍 응답 → AI2(Haiku) round-robin 자동 회전 응답. caret 깜빡임 + 토큰 메타 노출. |
| **22~30s** | ④ 영구화 + 모드 라벨 | `/` | F5 새로고침 → IndexedDB 자동 복원 (메시지 그대로 남음) → 헤더 라벨 "Day 5 · Live" 노출 → 모드 토글 라벨이 "Round-robin" 활성 색 강조. |

## 스크린샷 작성 가이드 (Roy 직접 녹화 시)

- **녹화 도구**: macOS QuickTime Player (Cmd+Shift+5 → 화면 일부 녹화) → ffmpeg로 GIF 변환
  ```
  ffmpeg -i robusta-demo.mov -vf "fps=12,scale=720:-1:flags=lanczos,palettegen" /tmp/palette.png
  ffmpeg -i robusta-demo.mov -i /tmp/palette.png -filter_complex "fps=12,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse" docs/launch/demo-frames/robusta-demo-30s.gif
  ```
- **창 크기**: 1280×720 (YouTube 16:9, X에서도 잘 보임)
- **다크모드 vs 라이트**: 라이트 추천 (Robusta 토큰 #FFFCEB 노란빛 배경이 시그니처)
- **마우스 커서**: 보이게 (사용자 액션 명확)
- **속도**: 자연스러운 인간 속도. 2x 빠르게 X (잡스 원칙 — 천천히 본질만)

## 꼬미 자동 생성 GIF — 보류 (macOS 권한 이슈)

⚠ **꼬미 자동 영상/GIF 생성 시도 결과: 실패**.
- `screencapture` 명령에 macOS Screen Recording 권한 미부여 → `could not create image from display`
- Chrome MCP의 screenshot은 tool result로 이미지 받지만 디스크에 직접 쓰기 X
- 권한 부여해도 BYOK 진짜 키는 Sensitive type이라 꼬미 접근 X — 라이브 대화 segment 부정확

**결정**: R5 데모 영상은 Roy 본인이 직접 녹화. 꼬미는 텍스트 + 스토리보드 + 가이드까지 박고 종료.

## Roy 직접 녹화 — 30초 GIF 생성 단계 (10분)

### 사전 준비 (1회만)
1. **Anthropic API 키 1개 확보** (이미 보유 중인 키 사용 또는 신규)
2. **Chrome 시크릿 창** 열기 (이전 IndexedDB 영향 차단)
3. **macOS QuickTime Player** 또는 `Cmd+Shift+5` 화면 녹화 도구 열기

### 녹화 (30초)
1. Chrome 시크릿 창에서 https://robusta-tau.vercel.app/sample 열기, 1280×720 정도로 창 크기 조정
2. `Cmd+Shift+5` → "선택한 부분 녹화" → Chrome 콘텐츠 영역 선택 → "녹화"
3. 다음 시퀀스를 30초 안에:
   - **0~5s**: `/sample` 페이지 천천히 위→아래 스크롤 (대화 6턴 노출)
   - **5~12s**: 좌상단 "← 홈으로" 클릭 → `/` 도착 → 우상단 ⚙ Keys 클릭 → 모달에서 Anthropic 키 붙여넣기 → ✅ 검증 → Save → 모달 닫기 → Participants 패널에서 + 버튼 → Sonnet 4.6 추가, + 한 번 더 → Haiku 4.5 추가
   - **12~22s**: 메시지 입력창에 "안녕, 셋이 자기소개해 줘" 타이핑 → Enter → AI1 스트리밍 응답 → AI2 자동 회전 응답
   - **22~30s**: F5 또는 Cmd+R → 새로고침 → 메시지 그대로 복원 → 헤더 "Day 5 · Live" 라벨 노출
4. 녹화 정지 (메뉴바 아이콘 또는 Cmd+Ctrl+Esc)
5. `.mov` 파일 저장됨 (기본 ~/Desktop)

### MOV → GIF 변환
```bash
brew install ffmpeg  # 1회만
cd ~/Desktop
ffmpeg -i robusta-demo.mov -vf "fps=12,scale=720:-1:flags=lanczos,palettegen" /tmp/palette.png
ffmpeg -i robusta-demo.mov -i /tmp/palette.png -filter_complex "fps=12,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse" \
  ~/Library/CloudStorage/OneDrive-MIN/Apps/Robusta/docs/launch/demo-frames/robusta-demo-30s.gif
```

### 검증
- 파일 크기 ≤ 5MB (X 첨부 한도)
- 30초 ± 2초
- 라이트 모드 (Robusta 노란빛 배경)
- 마우스 커서 보이게
- 자연 속도 (2x 빠르게 X)

### X 트윗 발사 (`docs/launch/x-tweet-2026-04-30.md` 텍스트 + 위 GIF 첨부)
1. https://x.com 로그인
2. "What's happening?" → 트윗 본문 붙여넣기
3. "미디어 추가" → `robusta-demo-30s.gif` 업로드
4. "게시"
5. 발사 후 채팅에 "트윗 발사함 + URL" 한마디 → 똘이 24h 응답률 측정 슬롯 큐

### Screen Recording 권한 (꼬미가 향후 자동 녹화하려면 — 옵션)
시스템 설정 → 개인정보 보호 및 보안 → **화면 기록** → ✅ Terminal (또는 Claude Code 앱). 부여하면 향후 꼬미가 자동 캡처 가능.
