/**
 * messages-catalog-en.ts
 *   - C-D27-1 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-1 — ko parity.
 *
 * 가이드라인 — messages-catalog-ko.ts 헤더 주석 참조.
 * parity 의무: 본 파일과 messages-catalog-ko.ts 키 집합 100% 일치.
 *   check-i18n-keys.mjs catalog parity 게이트가 ko↔en 동등성 강제.
 */

export const MESSAGES_CATALOG_EN = {
  // persona.catalog.*
  "persona.catalog.criticalMate.name": "Critical Mate",
  "persona.catalog.optimisticMate.name": "Optimistic Mate",
  "persona.catalog.dataMate.name": "Data Mate",
  "persona.catalog.designer.name": "Designer",
  "persona.catalog.userAdvocate.name": "User Advocate",
  "persona.catalog.criticalMate.desc": "Spots weaknesses and counterpoints",
  "persona.catalog.criticalMate.seedHint": "What are the weak points here?",
  "persona.catalog.optimisticMate.desc":
    "Reinforces possibilities and strengths",
  "persona.catalog.optimisticMate.seedHint": "What if this goes really well?",
  "persona.catalog.dataMate.desc": "Validates with numbers and evidence",
  "persona.catalog.dataMate.seedHint": "What data backs this up?",
  "persona.catalog.designer.desc": "Sees through user experience and visuals",
  "persona.catalog.designer.seedHint": "How will users see this?",
  "persona.catalog.userAdvocate.desc": "Speaks for the end user",
  "persona.catalog.userAdvocate.seedHint": "What would a real user say?",
  // persona.picker.tab.*
  "persona.picker.tab.catalog": "Catalog",
  "persona.picker.tab.custom": "My personas",
  // scenario.*
  "scenario.decisionReview.title": "Decision Review",
  "scenario.decisionReview.desc": "Get 3 different views before deciding",
  "scenario.decisionReview.seed":
    "How would each of you see this decision?",
  "scenario.ideaForge.title": "Idea Forge",
  "scenario.ideaForge.desc": "Refine an early idea from multiple angles",
  "scenario.ideaForge.seed":
    "Here's my early idea. How can we refine it?",
  "scenario.blindSpot.title": "Blind Spot",
  "scenario.blindSpot.desc": "Have other perspectives spot what you miss",
  "scenario.blindSpot.seed": "Is there something I'm missing?",
  "scenario.persona.critical": "Critical",
  "scenario.persona.optimistic": "Optimistic",
  "scenario.persona.data": "Data",
  "scenario.persona.designer": "Designer",
  "scenario.persona.userAdvocate": "User",
  "scenario.start.button": "Start",
  "scenario.welcome.headline": "Think together with AIs",
  "scenario.welcome.body":
    "Brainstorm with multiple AIs at once and surface insight.",
  // pdfExport.*
  "pdfExport.menu.label": "Save as PDF",
  "pdfExport.dialog.title": "Save as PDF",
  "pdfExport.dialog.option.includeInsights": "Include insight marks",
  "pdfExport.dialog.option.includeSystem": "Include system messages",
  "pdfExport.dialog.start": "Generate PDF",
  "pdfExport.dialog.progress.font": "Loading Korean font…",
  "pdfExport.dialog.progress.render": "Rendering messages… {percent}%",
  "pdfExport.dialog.download": "Download",
  // devMode.autoMark.*
  "devMode.autoMark.precision":
    "🤖 auto: P {precision}% / R {recall}% / N {sample}",
  "devMode.autoMark.sampling": "🤖 auto: ({sample}/100 sampling…)",
} as const;
