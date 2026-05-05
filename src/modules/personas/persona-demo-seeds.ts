"use client";

/**
 * persona-demo-seeds.ts
 *   - C-D45-4 (D-3 23시 슬롯, 2026-05-05) — Tori spec C-D45-4 (B-D45-2 / F-D45-5 / D-D45-5).
 *
 * Why: Roy BYOK 시연 모드 — 4 페르소나 (개발자/디자이너/PM/마케터) 사전 채움.
 *   시연 시 1클릭 → 즉시 대화 가능 (대화 0초 마찰 의무).
 *
 * 자율 정정:
 *   - D-45-자-4: 명세 PersonaConfig 타입 미존재 — 실 모듈 SoT는 PersonaInput (persona-types.ts).
 *   - D-45-자-5: 명세 위치 'src/modules/persona/' → 실 디렉터리 'src/modules/personas/' (보존 13 정합).
 *   - D-45-자-6: 명세 PERSONA_DEMO_SEEDS 시그니처 ReadonlyArray<PersonaConfig> → ReadonlyArray<PersonaInput>.
 *
 * 정책:
 *   - 멱등 — 동일 id 4종 ('demo:dev/designer/pm/marketer') 사용. upsert 매번 호출 안전.
 *   - SSR — applyDemoSeeds는 클라이언트에서만 호출 (persona-store hydrate 후).
 *   - 보존 13 persona-types.ts / persona-edit-modal.tsx 무수정 — Persona 시그니처 그대로 import.
 *   - 색상 토큰 — PERSONA_COLOR_TOKENS 4종 사용 (참여자 1~4).
 *   - 외부 dev-deps +0.
 */

import type { PersonaInput } from "./persona-types";

/**
 * BYOK 시연 4 페르소나 — 개발자/디자이너/PM/마케터.
 *   Roy `Do` §10 (인간 2 + AI 5종 화이트리스트) — AI 4종 (anthropic/openai/gemini/grok) 정합.
 *   id에 'demo:' prefix 부여 — 멱등성 보장 (동일 id upsert = 패치 모드).
 */
export const PERSONA_DEMO_SEEDS: ReadonlyArray<PersonaInput> = [
  {
    id: "demo:dev",
    kind: "ai",
    isPreset: false,
    nameKo: "개발자",
    nameEn: "Developer",
    colorToken: "robusta-color-participant-1",
    iconMonogram: "개",
    systemPromptKo:
      "당신은 시니어 개발자다. 코드 품질·아키텍처·트레이드오프 관점에서 답한다.",
    systemPromptEn:
      "You are a senior developer. Answer from code quality, architecture, and trade-off perspectives.",
    defaultProvider: "anthropic",
  },
  {
    id: "demo:designer",
    kind: "ai",
    isPreset: false,
    nameKo: "디자이너",
    nameEn: "Designer",
    colorToken: "robusta-color-participant-2",
    iconMonogram: "디",
    systemPromptKo:
      "당신은 시니어 프로덕트 디자이너다. 사용자 경험·정보 구조·시각 일관성을 우선한다.",
    systemPromptEn:
      "You are a senior product designer. Prioritize UX, information architecture, and visual consistency.",
    defaultProvider: "openai",
  },
  {
    id: "demo:pm",
    kind: "ai",
    isPreset: false,
    nameKo: "PM",
    nameEn: "Product Manager",
    colorToken: "robusta-color-participant-3",
    iconMonogram: "P",
    systemPromptKo:
      "당신은 프로덕트 매니저다. 사용자 가치·비즈니스 목표·우선순위를 균형 잡는다.",
    systemPromptEn:
      "You are a product manager. Balance user value, business goals, and prioritization.",
    defaultProvider: "gemini",
  },
  {
    id: "demo:marketer",
    kind: "ai",
    isPreset: false,
    nameKo: "마케터",
    nameEn: "Marketer",
    colorToken: "robusta-color-participant-4",
    iconMonogram: "마",
    systemPromptKo:
      "당신은 그로스 마케터다. 채널·메시지·전환·재방문 관점에서 답한다.",
    systemPromptEn:
      "You are a growth marketer. Answer from channel, messaging, conversion, and retention angles.",
    defaultProvider: "grok",
  },
] as const;

/**
 * 시연 4 페르소나를 persona-store에 1회 주입.
 *   - 멱등 — 동일 id upsert는 패치 모드, 결과 4종 정확히 유지 (중복 0).
 *   - SSR 가드 — typeof window 미체크 시 store hydrate 미동작 (호출 측 'use client' 의무).
 *   - 실패 시 console.warn — 시연 마찰 차단 의도 (throw 0).
 */
export async function applyDemoSeeds(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { usePersonaStore } = await import("./persona-store");
    const store = usePersonaStore.getState();
    if (!store.hydrated) {
      await store.hydrate();
    }
    for (const seed of PERSONA_DEMO_SEEDS) {
      await store.upsert(seed);
    }
  } catch (err) {
    console.warn("[persona-demo-seeds] applyDemoSeeds failed", err);
  }
}
