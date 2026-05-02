/**
 * messages-catalog-ko.ts
 *   - C-D27-1 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-1 (B-66/F-66/D-66) — KQ_21 (c) 채택.
 *
 * Why: messages.ts 메인 번들 −2 kB 회복(168 정식 HARD GATE) — 5 namespace 분리:
 *   persona.catalog.* / persona.picker.tab.* / scenario.* / pdfExport.* / devMode.*
 *
 * ⚠ 가이드라인 (Spec 005~011 동일 패턴 의무화):
 *   본 파일 + en parity = lazy chunk 전용. 메인 번들 모듈(conversation-workspace /
 *   header-cluster 등)에서 본 파일 정적 import 금지. 호출자(아래 6 모듈) 자체가
 *   dynamic import 되거나 lazy 모듈 의존이므로 본 catalog 도 함께 lazy chunk 에 들어감.
 *
 * 호출자(현재):
 *   1. persona-catalog-card.tsx — persona.catalog.*.{name,desc,seedHint}
 *   2. scenario-card.tsx — scenario.*.{title,desc,seed} + scenario.start.button
 *   3. welcome-view.tsx — scenario.welcome.* + scenario.persona.* + scenario.start.button
 *   4. persona-picker-modal.tsx — persona.picker.tab.{catalog,custom}
 *   5. pdf-export-dialog.tsx — pdfExport.*
 *   6. dev-mode-strip.tsx — devMode.autoMark.*
 *
 * 신규 i18n 키 추가 시:
 *   - lazy 모듈 한정 → 본 catalog (ko + en parity 의무)
 *   - 메인 번들 모듈 사용 → messages.ts 본체
 *   parity 미달 시 check-i18n-keys.mjs 가 ASYMMETRIC 경고.
 */

export const MESSAGES_CATALOG_KO = {
  // persona.catalog.* — 5종 × {name,desc,seedHint}
  "persona.catalog.criticalMate.name": "비판적 동료",
  "persona.catalog.optimisticMate.name": "낙관적 동료",
  "persona.catalog.dataMate.name": "데이터 동료",
  "persona.catalog.designer.name": "디자이너",
  "persona.catalog.userAdvocate.name": "사용자 대변자",
  "persona.catalog.criticalMate.desc": "약점과 반대 시각을 짚어줍니다",
  "persona.catalog.criticalMate.seedHint": "이 안의 약점은 뭐예요?",
  "persona.catalog.optimisticMate.desc": "가능성과 강점을 강화합니다",
  "persona.catalog.optimisticMate.seedHint": "이게 잘 풀리면 어떻게 되죠?",
  "persona.catalog.dataMate.desc": "수치와 근거로 검증합니다",
  "persona.catalog.dataMate.seedHint": "이걸 뒷받침할 데이터는요?",
  "persona.catalog.designer.desc": "사용자 경험과 시각으로 봅니다",
  "persona.catalog.designer.seedHint": "사용자는 이걸 어떻게 보게 될까요?",
  "persona.catalog.userAdvocate.desc": "최종 사용자의 입장을 대변합니다",
  "persona.catalog.userAdvocate.seedHint": "실제 사용자라면 뭐라 할까요?",
  // persona.picker.tab.*
  "persona.picker.tab.catalog": "카탈로그",
  "persona.picker.tab.custom": "내 페르소나",
  // scenario.*
  "scenario.decisionReview.title": "의사결정 검토",
  "scenario.decisionReview.desc": "결정 직전 다른 시각 3개 받아보기",
  "scenario.decisionReview.seed": "이 결정에 대해 여러분이라면 어떻게 보겠어요?",
  "scenario.ideaForge.title": "아이디어 발전",
  "scenario.ideaForge.desc": "초기 아이디어를 다각도로 다듬기",
  "scenario.ideaForge.seed":
    "제 초기 아이디어는 이거예요. 어떻게 발전시킬 수 있을까요?",
  "scenario.blindSpot.title": "사각지대 발견",
  "scenario.blindSpot.desc": "내가 놓친 부분을 다른 관점이 짚어주기",
  "scenario.blindSpot.seed": "제가 놓치고 있는 게 있을까요?",
  "scenario.persona.critical": "비판적",
  "scenario.persona.optimistic": "낙관적",
  "scenario.persona.data": "데이터",
  "scenario.persona.designer": "디자이너",
  "scenario.persona.userAdvocate": "사용자",
  "scenario.start.button": "시작하기",
  "scenario.welcome.headline": "AI들과 함께 생각해봐요",
  "scenario.welcome.body": "한 번에 여러 AI와 같이 브레인스토밍해서 통찰을 끌어냅니다.",
  // pdfExport.*
  "pdfExport.menu.label": "PDF로 저장",
  "pdfExport.dialog.title": "PDF로 저장",
  "pdfExport.dialog.option.includeInsights": "통찰 마크 포함",
  "pdfExport.dialog.option.includeSystem": "시스템 메시지 포함",
  "pdfExport.dialog.start": "PDF 생성",
  "pdfExport.dialog.progress.font": "한글 폰트 불러오는 중…",
  "pdfExport.dialog.progress.render": "메시지 그리는 중… {percent}%",
  "pdfExport.dialog.download": "다운로드",
  // devMode.autoMark.*
  "devMode.autoMark.precision": "🤖 auto: P {precision}% / R {recall}% / N {sample}",
  "devMode.autoMark.sampling": "🤖 auto: ({sample}/100 sampling…)",
} as const;
