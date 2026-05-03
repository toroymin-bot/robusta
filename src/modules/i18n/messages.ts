/**
 * messages.ts — F-copy-1 (Day 4, 2026-04-29) 한/영 카피 동기화.
 *   명세 Komi_Spec_Day4_Persona_2026-04-29 §6 표 기반 22+ 키.
 *
 * D-9.3 다국어 라우팅(P1)이 들어오면 useLocale 훅이 URL 첫 세그먼트로 결정.
 *   현재(D4 P0)는 'ko' default + 'en' 파일만 박아둠 — 호출자는 t(key)로 ko 값을 받음.
 *
 * 카피 변수: {name}, {from}, {to} 등은 호출자가 string.replace 처리.
 *   복잡한 ICU 포맷이 필요하면 D-9.3에서 라이브러리 검토 (formatjs/lingui — 의존성 비용 trade-off).
 */

export type Locale = "ko" | "en";

export const MESSAGES = {
  ko: {
    // 헤더
    "header.title": "Robusta — Day 4 · 인격",
    "header.keys": "⚙ 키",

    // 참여자 카드
    "card.persona": "⚙ 인격 설정",

    // 모달
    "modal.title.ai": "인격 / R&R 설정",
    "modal.title.human": "참여자 정보",
    "modal.field.name": "이름 (1~30자)",
    "modal.field.role": "역할 (선택, 40자 이내)",
    "modal.field.systemPrompt": "인격 프롬프트 (선택, 1500자 이내)",
    "modal.field.model": "모델",
    "modal.action.save": "저장",
    "modal.action.cancel": "취소",
    "modal.err.nameEmpty": "이름은 비워둘 수 없습니다.",
    "modal.err.nameLength": "이름은 1~30자 사이.",
    "modal.err.roleLength": "역할은 40자 이내.",
    "modal.err.systemPromptLength": "인격 프롬프트는 1500자 이내.",
    "modal.hint.humanOnly": "인격 프롬프트는 AI 참여자에만 적용됩니다.",

    // 토스트
    "toast.persona.saved": "{name} 저장됨",
    "toast.fallback": "{from} 미사용 → {to} 폴백",
    "toast.error.network": "네트워크 오류 — 재시도하세요",
    // C-D23-2 (D6 23시, 2026-05-01) — F-22 컨텍스트 슬라이서 자동 압축 알림.
    "toast.context.compacted": "이전 대화 {original}건을 자동으로 {shrunk}건으로 요약했어요",
    // D-10.2 (Day 5, F-D4-1) BYOK 키 ping 결과 카피 3종
    "toast.byok.verified": "API 키 확인 완료",
    "toast.byok.unauthorized": "API 키 인증 실패 — 키 확인 필요",
    "toast.byok.checkLater": "키 저장됨 — 인증 확인은 첫 호출 시",
    // D-10.3 (Day 5) 5xx 백오프 한계 도달
    "toast.error.retryExhausted": "재시도 한도 초과 — 잠시 후 다시 시도하세요",
    // D-11.3 (Day 6, 2026-04-28) BYOK 모달 인라인 키 발급 가이드 (모든 키 0건 시 노출)
    "byok.guide.headline": "API 키가 없으세요?",
    "byok.guide.body": "Anthropic Console에서 무료로 발급받을 수 있습니다.",
    "byok.guide.cta": "발급받기",
    // D-11.4 (Day 6) BYOK 모달 마이크로 인터랙션 4상태
    "byok.modal.verifying": "키 확인 중…",
    "byok.modal.unauthorized": "인증 실패 — 키를 다시 확인하세요",
    // D-12.2 (Day 6) BYOK 키 만료 자동 감지 + recheck
    "toast.byok.maybeExpired": "키 만료 가능성 — 재확인 권장",
    "action.recheck": "재확인",
    // D-12.3 (Day 6) 네트워크 회복 자동 재개
    "toast.network.restored": "네트워크 복구됨",
    "action.retryAll": "모두 재전송",

    // 버튼
    "action.nextTurn": "▶ 다음 발언",
    "action.retry": "↻ 재전송",
    "action.stop": "⏹ 정지",
    // D-10.4 (Day 5, F-D4-4) 토스트 액션 라벨
    "action.openKeys": "키 다시 열기",

    // 입력바
    "input.placeholder": "메시지를 입력하세요…",

    // D-13 (Day 7, 2026-04-29) 페르소나 프리셋 카탈로그
    "persona.picker.title": "참여자 추가",
    "persona.picker.toggleAi": "AI",
    "persona.picker.toggleHuman": "인간",
    "persona.picker.customCta": "직접 만들기",
    "persona.preset.director": "너는 디렉터다. 비즈니스·디자인·우선순위 결정자. 옵션 5개·점수표·추천 1개 형식. 추측 금지, 안정성 > 혁신, 한 번에 하나씩.",
    "persona.preset.engineer": "너는 엔지니어다. 코드 작성·검증·머지. grep으로 사실 확인 후 답한다. 추측 시 '추정' 명시. 빌드/타입 0에러를 게이트로 둔다.",
    // D-15.1 (Day 9, 2026-04-28) C-D9-1: 인사·스몰토크는 비판 대상에서 제외 — Critic 페르소나가 첫 turn 인사("안녕") 메시지에 200 OK로 응답하지 않고 ⚠ 에러 반환하던 라이브 회귀(B-1) fix.
    //   ~~"너는 비판자다. 약점·실패 시나리오·반증·리스크를 우선 기록한다. 동의는 마지막. 칭찬 금지. 출처 또는 근거 없으면 비판하지 마라."~~ (D-13.1)
    "persona.preset.critic": "너는 비판자다. 약점·실패·반증·리스크를 우선 기록한다. 동의는 마지막. 칭찬 금지. 비판할 때는 근거 없으면 비판하지 마라. 단, 인사·스몰토크는 비판 없이 자연스럽게 답한다.",
    "persona.preset.optimist": "너는 낙관론자다. 가능성·기회·확장 시나리오를 기록한다. 단, 거짓 희망 금지. 데이터 기반 낙관만 허용.",
    "persona.preset.researcher": "너는 리서처다. 사실·출처·인용 우선. 모르면 '확인 필요'로 표시. 1차 자료 > 요약. 추측은 별도 섹션으로 격리.",
    "persona.preset.humanDefault": "",
    "persona.error.nameRequired": "이름을 한국어 또는 영어 중 하나 박아주세요.",
    "persona.error.participantLimit": "참여자는 최대 4명, 인간 2명·AI 3명까지 박힙니다.",
    "persona.toast.saved": "페르소나 등록됐습니다.",
    // D-14.2 (Day 8, 2026-04-28) 참여자 제한 토스트 3종 — 카드 disabled 클릭 시 1회 노출
    "toast.participant.limit.total": "참여자는 최대 4명까지 추가할 수 있어요.",
    "toast.participant.limit.ai": "AI는 최대 3명까지 추가할 수 있어요.",
    "toast.participant.limit.human": "인간은 최대 2명까지 추가할 수 있어요.",
    // D-14.1 (Day 8) PersonaEditModal lazy 로드 실패 (오프라인) 토스트
    "persona.edit.offline": "오프라인이라 편집 화면을 불러올 수 없어요.",
    // D-15.1 (Day 9, 2026-04-28) F-D9-1: 비판자 에러 폴백 안내 카피 — 사용자에게 raw 에러 대신 부드러운 cation 톤 기록한다.
    "toast.critic.softFallback": "⚠ 비판자가 잠시 답을 정리 중입니다. 재전송해보세요.",
    // D-15.2 (Day 9) C-D9-2: 헤더 발언 모드 라벨 — turnMode 3종에 1:1 매핑 (subscribe로 즉시 갱신).
    "header.mode.manual": "Manual",
    "header.mode.roundRobin": "Round-robin",
    "header.mode.trigger": "Scheduled",
    // D-D10-5 (Day 9, 2026-04-28, B12 채택분) C-D10-5: 4번째 모드 'AI-Auto' — AI-AI 자율 발언.
    "header.mode.aiAuto": "AI-Auto",
    // D-D11-1 (Day 10, 2026-04-29, B14) C-D11-1: AI-Auto 트리거 풀 토스트 6종.
    //   인간/탭이탈/완료/스킵/BYOK부재/AI<2명 상태 전이를 사용자에게 1회 안내.
    "autoLoop.paused.human": "AI-Auto 일시정지됨. ▶ 클릭으로 재개.",
    "autoLoop.paused.hidden": "탭 비활성으로 AI-Auto 일시정지.",
    "autoLoop.completed": "{turns}턴 완료. ▶ 다시 시작.",
    "autoLoop.skipped": "{count}건 스킵됨 (탭 비활성). ▶ 재개.",
    "autoLoop.byokMissing": "BYOK 키 없음. AI-Auto 중지됨.",
    "autoLoop.noSpeaker": "AI 2명 이상 필요. AI-Auto 중지됨.",
    // D-D11-2 (Day 11, 2026-04-29, B19) C-D11-2: AutoLoopHeader 컨트롤 카피 6종.
    //   region/start/pause/interval/maxTurns/progress — 헤더 ▶/⏸/카운터/셀렉트 라벨 + a11y.
    "autoLoop.header.region": "AI-Auto 컨트롤",
    "autoLoop.header.start": "AI-Auto 시작",
    "autoLoop.header.pause": "AI-Auto 일시정지",
    "autoLoop.header.interval": "간격",
    "autoLoop.header.maxTurns": "최대 턴",
    "autoLoop.header.progress": "턴",
    // C-D22-1 (D6 19시 슬롯, 2026-05-01) F-24 Export 메뉴 — SideSheet 하단 "도구" 그룹.
    //   KQ_15 답변 (자율): 헤더 4도구 + 토큰 카운터로 포화 → 사이드 시트 하단 도구 그룹에 등록.
    "export.menu.title": "내보내기",
    "export.menu.section": "도구",
    "export.menu.markdown": "Markdown",
    "export.menu.json": "JSON",
    "export.menu.aria": "현재 룸 내보내기",
    "export.toast.success": "{format} 파일을 내려받았습니다.",
    "export.toast.failure": "내보내기 실패 — 잠시 후 다시 시도하세요.",
    "export.disabled.empty": "비어 있는 룸은 내보낼 수 없어요.",
    // C-D22-2 (D6 19시 슬롯, 2026-05-01) D-22 hueToShape — 색맹 동반 도형 라벨 합성.
    //   참여자 카드의 aria-label 에 "{name} (참여자, {shape})" 형태로 합성.
    "participants.shape.aria": "{name} (참여자, {shape})",
    // C-D24-1·2 (D6 03시 슬롯, 2026-05-02) — F-54 hueToBaseName 합성 + KQ_17 (a) 색명 라벨.
    "participants.shapeColor.aria": "{name} (참여자, {shape}, {color})",
    "personaCard.colorDot.tooltip": "참여자 색: {color}",
    // C-D24-3 (D6 03시 슬롯, 2026-05-02) — Spec 003 통찰 강조 푸터 (F-51 수동 마크).
    "insight.kind.newView": "다른 시각",
    "insight.kind.counter": "반대 근거",
    "insight.kind.augment": "보완",
    "insight.markButton.tooltip": "통찰로 마크",
    "insight.unmark.toast": "마크가 해제되었습니다",
    "insight.unmark.action": "되돌리기",
    // C-D25-1 (D6 07시 슬롯, 2026-05-02) — B-56/F-56/D-56 자동 마크 v0 라벨.
    //   markedBy='auto' 시 사용자 마크와 시각 분리 + sr-only / 툴팁 라벨.
    "insight.auto.label": "AI 추정",
    // C-D24-4 (D6 03시 슬롯, 2026-05-02) — 인사이트 라이브러리 사이드 시트 v0.
    "insightLibrary.title": "인사이트",
    "insightLibrary.empty": "아직 캡처된 통찰이 없습니다.",
    "insightLibrary.entry.button": "인사이트 라이브러리 열기",
    "insightLibrary.entry.label": "💡 인사이트 ({count})",
    "insightLibrary.capture.guide": "메시지 푸터에서 통찰 후보를 마크하세요.",
    // C-D29-2 (D-5 03시 슬롯, 2026-05-03) — 다중 발화자 통찰 푸터 (Spec 003 폴리시 본체).
    "insight.footer.label": "통찰 {count}",
    "insight.footer.panel.title": "다중 발화자 통찰 ({count})",
    "insight.footer.panel.aria": "메시지 통찰 패널",
    "insight.footer.speaker.deleted": "(삭제됨)",
    "insight.multi.kind.agreement": "합의",
    "insight.multi.kind.disagreement": "반박",
    "insight.multi.kind.complement": "보완",
    "insight.multi.kind.blindspot": "사각지대",
    // C-D27-1 (D6 15시 슬롯, 2026-05-02) — KQ_21 (c) 채택분.
    //   catalog 5 namespace (persona.catalog.* / persona.picker.tab.* / scenario.* /
    //   pdfExport.* / devMode.*) 본 파일에서 분리 → messages-catalog-ko.ts (lazy chunk).
    //   메인 번들 −2 kB → 168 정식 HARD GATE 복귀. 호출자는 catalog-i18n.ts 의 tc() 사용.
    // C-D30-1 (D-5 07시 슬롯, 2026-05-03) — BYOK 비용 cap 위젯/배지 6키 (B-D30-2 + D-D30-1).
    "cost.cap.title": "BYOK 일일 비용 한도",
    "cost.cap.subtitle":
      "당신의 키, 당신의 한도. Robusta는 일일 $1 안전망만 제공합니다.",
    "cost.cap.current": "{current} / {cap}",
    "cost.cap.reset": "자정 {time} KST 리셋",
    "cost.cap.tooltip": "비용 한도 {pct}% 사용",
    "cost.cap.warn": "비용 한도 {pct}% 도달 — 자정 리셋까지 잠시 대기 권장",
    // C-D31-1 (D-5 11시 슬롯, 2026-05-03) — 스케줄 modal save toast (F-D31-1).
    "schedule.save.ok": "스케줄 저장됨",
    "schedule.save.fail": "스케줄 저장 실패. 다시 시도하세요.",
    // C-D31-4 (D-5 11시 슬롯, 2026-05-03) — /schedules 페이지 라우트 (F-D31-2 / D-D31-1).
    "schedules.page.title": "스케줄",
    "schedules.empty.headline": "AI들과의 자율 대화를 예약하세요",
    "schedules.cta.new": "+ 새 스케줄",
    // C-D31-5 (D-5 11시 슬롯, 2026-05-03) — KeyPingWidget (F-D31-5).
    "keyping.label": "BYOK 키 상태",
    "keyping.status.ok": "확인됨",
    "keyping.status.fail": "실패",
    "keyping.action.reping": "재확인",
    // C-D32-3 (D-5 15시 슬롯, 2026-05-03) — Spec 005 MCP 골격 (F-D32-3).
    "mcp.section.title": "MCP",
    "mcp.section.placeholder": "MCP 통합 — Phase 2 예정",
    // C-D32-4 (D-5 15시 슬롯, 2026-05-03) — BYOK KeyInputModal (F-D32-4).
    "keymodal.title": "API 키 입력",
    "keymodal.guide": "Anthropic Console에서 키 발급",
    "keymodal.action.save": "저장 후 검증",
    "keymodal.toggle.show": "보기",
    "keymodal.toggle.hide": "숨기기",
    // C-D32-5 (D-5 15시 슬롯, 2026-05-03) — CronPreviewChip (F-D32-5 / D-D32-4).
    "cronpreview.next": "다음 실행",
    "cronpreview.invalid": "사용자 정의 (검증 필요)",
    "cronpreview.tz": "(Asia/Seoul)",
    // C-D33-1 (D-5 19시 슬롯, 2026-05-03) — KeyInputModal 진입점 hook (F-D33-1).
    "keymodal.trigger.entry": "API 키를 먼저 등록하세요",
    "keymodal.trigger.401": "키 인증 실패 — 키를 다시 등록하세요",
    // C-D33-4 (D-5 19시 슬롯, 2026-05-03) — Spec 005 MCP D-4 진입 chip (F-D33-4).
    "mcp.section.phase2.label": "MCP — D-4 (5/4) 활성 예정",
    // C-D33-5 (D-5 19시 슬롯, 2026-05-03) — Hero sub + 빈 방 hint pill (B-D33-4 + D-D33-5 / F-D33-5).
    "hero.sub": "내가 못 본 시야 발견",
    "room.empty.hint": "두 AI에게 같은 질문을 해보세요",
  },
  en: {
    "header.title": "Robusta — Day 4 · Persona",
    "header.keys": "⚙ Keys",

    "card.persona": "⚙ Persona",

    "modal.title.ai": "Persona / R&R",
    "modal.title.human": "Participant",
    "modal.field.name": "Name (1–30 chars)",
    "modal.field.role": "Role (optional, ≤40 chars)",
    "modal.field.systemPrompt": "Persona prompt (optional, ≤1500 chars)",
    "modal.field.model": "Model",
    "modal.action.save": "Save",
    "modal.action.cancel": "Cancel",
    "modal.err.nameEmpty": "Name cannot be empty.",
    "modal.err.nameLength": "Name must be 1–30 chars.",
    "modal.err.roleLength": "Role must be ≤40 chars.",
    "modal.err.systemPromptLength": "Persona prompt must be ≤1500 chars.",
    "modal.hint.humanOnly": "Persona prompt applies to AI participants only.",

    "toast.persona.saved": "{name} saved",
    "toast.fallback": "{from} unavailable → fell back to {to}",
    "toast.error.network": "Network error — please retry",
    // C-D23-2 (D6 23:00 KST, 2026-05-01) — F-22 context slicer auto-compaction notice.
    "toast.context.compacted": "Auto-summarised {original} earlier messages into {shrunk}",
    "toast.byok.verified": "API key verified",
    "toast.byok.unauthorized": "Unauthorized — please check the key",
    "toast.byok.checkLater": "Key saved — auth will be checked on first use",
    "toast.error.retryExhausted": "Retry limit exceeded — please try again later",
    "byok.guide.headline": "Don't have an API key?",
    "byok.guide.body": "Get one free at the Anthropic Console.",
    "byok.guide.cta": "Get the key",
    "byok.modal.verifying": "Verifying…",
    "byok.modal.unauthorized": "Unauthorized — please re-check the key",
    "toast.byok.maybeExpired": "Key may have expired — recheck recommended",
    "action.recheck": "Recheck",
    "toast.network.restored": "Network restored",
    "action.retryAll": "Retry all",

    "action.nextTurn": "▶ Next turn",
    "action.retry": "↻ Retry",
    "action.stop": "⏹ Stop",
    "action.openKeys": "Reopen keys",

    "input.placeholder": "Type a message…",

    // D-13 (Day 7, 2026-04-29) Persona preset catalog
    "persona.picker.title": "Add participant",
    "persona.picker.toggleAi": "AI",
    "persona.picker.toggleHuman": "Human",
    "persona.picker.customCta": "Build your own",
    "persona.preset.director": "You are the Director. Owner of business, design, and priority calls. Always: 5 options, scored, 1 pick. No guessing. Stability > novelty. One thing at a time.",
    "persona.preset.engineer": "You are the Engineer. Write, verify, merge code. Confirm facts with grep before answering. Mark unknowns 'assumption'. Gate on 0 build/type errors.",
    // D-15.1 (Day 9) C-D9-1 mirror — see KO comment.
    "persona.preset.critic": "You are the Critic. Surface weaknesses, failures, counterevidence, risks first. Agreement last. No praise. Critique only with evidence. Greetings and small-talk get natural replies, no critique.",
    "persona.preset.optimist": "You are the Optimist. Highlight possibilities, opportunities, expansion paths. No false hope — only data-grounded optimism.",
    "persona.preset.researcher": "You are the Researcher. Facts, sources, citations first. Tag unknowns 'needs check'. Primary sources > summaries. Isolate guesses in their own section.",
    "persona.preset.humanDefault": "",
    "persona.error.nameRequired": "Please set the name in Korean or English.",
    "persona.error.participantLimit": "Up to 4 participants — 2 humans, 3 AIs.",
    "persona.toast.saved": "Persona saved.",
    // D-14.2 (Day 8) participant limit toasts (one-shot per picker session)
    "toast.participant.limit.total": "You can add up to 4 participants.",
    "toast.participant.limit.ai": "You can add up to 3 AI participants.",
    "toast.participant.limit.human": "You can add up to 2 human participants.",
    // D-14.1 (Day 8) PersonaEditModal lazy load offline failure
    "persona.edit.offline": "You're offline — edit dialog can't load.",
    // D-15.1 (Day 9, 2026-04-28) F-D9-1: Critic error soft fallback copy.
    "toast.critic.softFallback": "⚠ The Critic is still gathering its thoughts. Try resending.",
    // D-15.2 (Day 9) C-D9-2: header turn mode labels (1:1 with TurnMode enum).
    "header.mode.manual": "Manual",
    "header.mode.roundRobin": "Round-robin",
    "header.mode.trigger": "Scheduled",
    // D-D10-5 (Day 9, 2026-04-28) C-D10-5: 4th mode AI-Auto — AI-AI autonomous speech.
    "header.mode.aiAuto": "AI-Auto",
    // D-D11-1 (Day 10, 2026-04-29) C-D11-1: AI-Auto trigger pool toasts (6 keys).
    "autoLoop.paused.human": "AI-Auto paused. Click ▶ to resume.",
    "autoLoop.paused.hidden": "AI-Auto paused while tab inactive.",
    "autoLoop.completed": "{turns} turns done. ▶ Restart.",
    "autoLoop.skipped": "{count} ticks skipped. ▶ Resume.",
    "autoLoop.byokMissing": "BYOK key missing. AI-Auto stopped.",
    "autoLoop.noSpeaker": "Need 2+ AIs. AI-Auto stopped.",
    // D-D11-2 (Day 11, 2026-04-29) C-D11-2: AutoLoopHeader controls — KO mirror.
    "autoLoop.header.region": "AI-Auto controls",
    "autoLoop.header.start": "Start AI-Auto",
    "autoLoop.header.pause": "Pause AI-Auto",
    "autoLoop.header.interval": "Interval",
    "autoLoop.header.maxTurns": "Max turns",
    "autoLoop.header.progress": "turns",
    // C-D22-1 (D6 19시 슬롯, 2026-05-01) F-24 Export menu — KO mirror.
    "export.menu.title": "Export",
    "export.menu.section": "Tools",
    "export.menu.markdown": "Markdown",
    "export.menu.json": "JSON",
    "export.menu.aria": "Export current room",
    "export.toast.success": "Downloaded {format} file.",
    "export.toast.failure": "Export failed — please try again.",
    "export.disabled.empty": "Empty room cannot be exported.",
    // C-D22-2 (D6 19시 슬롯, 2026-05-01) D-22 hueToShape — KO mirror.
    "participants.shape.aria": "{name} (participant, {shape})",
    // C-D24-1·2 (D6 03시 슬롯, 2026-05-02) — F-54 hueToBaseName + KQ_17 (a) — KO mirror.
    "participants.shapeColor.aria": "{name} (participant, {shape}, {color})",
    "personaCard.colorDot.tooltip": "Participant color: {color}",
    // C-D24-3 (D6 03시 슬롯, 2026-05-02) — Insight footer (manual mark) — KO mirror.
    "insight.kind.newView": "Different view",
    "insight.kind.counter": "Counter argument",
    "insight.kind.augment": "Augment",
    "insight.markButton.tooltip": "Mark as insight",
    "insight.unmark.toast": "Mark cleared",
    "insight.unmark.action": "Undo",
    // C-D25-1 (D6 07시 슬롯, 2026-05-02) — auto-mark v0 label (en parity).
    "insight.auto.label": "AI inferred",
    // C-D24-4 (D6 03시 슬롯, 2026-05-02) — Insight library side sheet v0 — KO mirror.
    "insightLibrary.title": "Insights",
    "insightLibrary.empty": "No insights captured yet.",
    "insightLibrary.entry.button": "Open insight library",
    "insightLibrary.entry.label": "💡 Insights ({count})",
    "insightLibrary.capture.guide": "Mark insight candidates from the message footer.",
    // C-D29-2 (D-5 03시 슬롯, 2026-05-03) — Multi-speaker insight footer (Spec 003 evolved).
    "insight.footer.label": "Insights {count}",
    "insight.footer.panel.title": "Multi-speaker insights ({count})",
    "insight.footer.panel.aria": "Message insight panel",
    "insight.footer.speaker.deleted": "(deleted)",
    "insight.multi.kind.agreement": "Agreement",
    "insight.multi.kind.disagreement": "Disagreement",
    "insight.multi.kind.complement": "Complement",
    "insight.multi.kind.blindspot": "Blindspot",
    // C-D27-1 (D6 15시 슬롯, 2026-05-02) — catalog 5 namespace 분리 (en parity, messages-catalog-en.ts).
    // C-D30-1 (D-5 07시 슬롯, 2026-05-03) — BYOK cost cap widget/badge 6 keys (en parity).
    "cost.cap.title": "BYOK daily cost cap",
    "cost.cap.subtitle":
      "Your key, your cap. Robusta only provides a $1 daily safety net.",
    "cost.cap.current": "{current} / {cap}",
    "cost.cap.reset": "Resets at {time} KST (midnight UTC)",
    "cost.cap.tooltip": "Cost cap {pct}% used",
    "cost.cap.warn":
      "Cost cap {pct}% reached — consider waiting until reset",
    // C-D31-1 (D-5 11시 슬롯, 2026-05-03) — Schedule modal save toast (en parity).
    "schedule.save.ok": "Schedule saved",
    "schedule.save.fail": "Failed to save schedule. Please retry.",
    // C-D31-4 (D-5 11시 슬롯, 2026-05-03) — /schedules page route (en parity).
    "schedules.page.title": "Schedules",
    "schedules.empty.headline": "Schedule autonomous AI conversations",
    "schedules.cta.new": "+ New schedule",
    // C-D31-5 (D-5 11시 슬롯, 2026-05-03) — KeyPingWidget (en parity).
    "keyping.label": "BYOK key status",
    "keyping.status.ok": "Verified",
    "keyping.status.fail": "Failed",
    "keyping.action.reping": "Re-check",
    // C-D32-3 (D-5 15시 슬롯, 2026-05-03) — Spec 005 MCP scaffold (en parity).
    "mcp.section.title": "MCP",
    "mcp.section.placeholder": "MCP integration — Phase 2 (planned)",
    // C-D32-4 (D-5 15시 슬롯, 2026-05-03) — BYOK KeyInputModal (en parity).
    "keymodal.title": "Enter API key",
    "keymodal.guide": "Get a key from Anthropic Console",
    "keymodal.action.save": "Save & verify",
    "keymodal.toggle.show": "Show",
    "keymodal.toggle.hide": "Hide",
    // C-D32-5 (D-5 15시 슬롯, 2026-05-03) — CronPreviewChip (en parity).
    "cronpreview.next": "Next run",
    "cronpreview.invalid": "Custom (verify)",
    "cronpreview.tz": "(Asia/Seoul)",
    // C-D33-1 (D-5 19시 슬롯, 2026-05-03) — KeyInputModal trigger (en parity).
    "keymodal.trigger.entry": "Please register an API key first",
    "keymodal.trigger.401": "Key authentication failed — please re-register",
    // C-D33-4 (D-5 19시 슬롯, 2026-05-03) — MCP Phase 2 chip (en parity).
    "mcp.section.phase2.label": "MCP — Activates on 5/4",
    // C-D33-5 (D-5 19시 슬롯, 2026-05-03) — Hero sub + empty room hint (en parity).
    "hero.sub": "Find the angles you missed",
    "room.empty.hint": "Ask the same question to two AIs",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)["ko"];

/**
 * 카피 조회. {var} 치환 지원.
 *   D-9.3 라우팅 도입 전: locale 파라미터 미지정 시 'ko' default.
 *   미존재 키는 키 문자열 그대로 반환 (운영 중 문제 가시화).
 */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
  locale: Locale = "ko",
): string {
  const dict = MESSAGES[locale] ?? MESSAGES.ko;
  let out: string = dict[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}
