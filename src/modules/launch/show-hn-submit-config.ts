/**
 * show-hn-submit-config.ts
 *   - C-D55-3 (D-1 13시 슬롯, 2026-05-07) — Tori spec C-D55-3 (B-D55-1 / B-D52-4 §11 카피 final lock 흡수).
 *
 * Why: Show HN submit 22:00 KST 정각 URL/title/body 1.0 final lock.
 *   - 5/7 22:00 KST = 5/7 09:00 ET (HN 목요일 골든타임).
 *   - i18n 변동 0 락 정합 — 본 모듈 단독 상수 (MESSAGES 영향 0, parity 301 유지).
 *   - length ratio 0.4 SoT (D-D53-자-2 → §7 정식 승격) 의무.
 *   - KQ_23 fallback 정합 (Vercel preview URL — Roy 액션 5/7 22:00 KST 직전까지).
 *
 * 자율 정정 (D-55-자):
 *   - D-55-자-1: 명세 ManualRunButton 위치 'src/modules/launch/manual-run-button.tsx' 추정 →
 *                실 'src/modules/schedule/manual-run-button.tsx' (schedule 모듈 단일 책임).
 *                CSS는 launch 사이클 phase 기반이므로 명세 그대로 launch 모듈 유지 (C-D55-5).
 *   - D-55-자-2: ManualRunButton phase prop 부재 (state: idle|running|queued만) — A-D54-자-2 패턴 정합.
 *                기존 컴포넌트 변경 0 + CSS 파일 + globals.css 1줄 OCP append만. wiring D+1 자율 슬롯 큐.
 *   - D-55-자-3: SHOW_HN_SUBMIT_CONFIG 의 title/body 데이터 — i18n MESSAGES 변동 0 락 의무 →
 *                본 모듈 단독 상수 채택 (외부 HN submit 전용, 인앱 i18n 와 분리).
 *
 * 정책 (length ratio 0.4 SoT):
 *   - titleKo ≤ 60 chars (HN limit 80 + 한국어 압축).
 *   - titleEn ≤ 80 chars (HN limit).
 *   - bodyKo / bodyEn ≤ 800 chars.
 *   - length ratio: |titleKo.length - titleEn.length| / max(titleKo.length, titleEn.length) ≤ 0.4.
 *   - 이모지 0 (HN 정책).
 *   - "Show HN: " prefix 의무 (en).
 *
 * 보존 13 영향: 0 (신규 모듈, 보존 13 미포함).
 */

export interface ShowHnSubmitConfig {
  releaseBaseUrl: string;
  releaseFallbackUrl: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
}

const TITLE_KO =
  "Show HN: Robusta — BYOK 다자(多者) AI 라운드테이블, 통찰을 길어 올리는 회의실";

const TITLE_EN =
  "Show HN: Robusta — BYOK roundtable to brainstorm with multiple AIs at once";

const BODY_KO = [
  "Robusta는 AI들과의 회의실입니다. 한 번에 한 AI 에게 묻는 게 아니라, Claude·Gemini·ChatGPT·Grok·DeepSeek 다섯 모델을 한 방에 모아 같이 브레인스토밍합니다. 출력은 답이 아니라 — 여러 관점의 충돌·보완에서 길어 올리는 통찰입니다.",
  "BYOK by design. API 키는 사용자 브라우저 IndexedDB 에만 저장 — 서버 미저장. 추론에서 우리는 0원 받습니다. 같은 저자의 오픈소스 Blend 와 BYOK · Tailwind/React 인프라를 80% 공유하지만, 대화 모델은 1:1 이 아닌 N:N — 사용자가 진행자, AI 가 참여자.",
  "랜딩 페이지의 키워드 칩 클릭 → 5턴 대화 → 무료 회의록(.md) 다운로드. 페르소나 · R&R · 스케줄 자율 발언까지 — 회의실 흐름 그대로. 피드백 환영합니다.",
].join("\n\n");

const BODY_EN = [
  "Robusta is a roundtable for AIs. Instead of picking one model and asking, you put Claude, Gemini, ChatGPT, Grok and DeepSeek in one room and brainstorm together. The output isn't an answer — it's the insight that surfaces when multiple perspectives clash and complement.",
  "BYOK by design. API keys live only in the user's browser (IndexedDB), never on our server, and we charge zero for inference. We share ~80% of our infra (BYOK, Tailwind/React) with our open-source Blend project, but the conversation model is N:N rather than 1:1 — the human facilitates, the AIs participate.",
  "Click a keyword chip on the landing page, run a 5-turn meeting, download the free minutes (.md). Personas, R&R and scheduled autonomous turns are all there. Feedback welcome.",
].join("\n\n");

export const SHOW_HN_SUBMIT_CONFIG: ShowHnSubmitConfig = {
  releaseBaseUrl: "https://robusta.ai4min.com",
  releaseFallbackUrl: "https://robusta-staging.vercel.app",
  titleKo: TITLE_KO,
  titleEn: TITLE_EN,
  bodyKo: BODY_KO,
  bodyEn: BODY_EN,
};

/**
 * resolveReleaseUrl — KQ_23 fallback 정합.
 *   - kq23Resolved=true → robusta.ai4min.com 본 도메인 반환.
 *   - kq23Resolved=false → Vercel preview URL fallback (잡음 0 의무).
 *   - now 인자는 시점 audit 용 (URL 결정에는 영향 0, 로깅/추적 정합).
 */
export function resolveReleaseUrl(
  now: string,
  baseUrl: string,
  fallbackUrl: string,
  kq23Resolved: boolean,
): string {
  void now;
  return kq23Resolved ? baseUrl : fallbackUrl;
}
