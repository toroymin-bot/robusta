/**
 * persona-types.ts — D-13.0 (Day 7, 2026-04-29) 페르소나 카탈로그 타입.
 *
 * 페르소나 = 참여자(Participant)에 1:1 또는 1:N으로 박힐 수 있는 인격/R&R 단위.
 * 프리셋(isPreset=true)은 시드된 6종으로 불변, 사용자가 cloneFromPreset으로 복제 후 편집.
 * Roy `Do` 메모 #10 (인간 2 + AI 5종) 충족.
 */

/** 페르소나 종류. AI는 LLM에 system prompt로 주입, 인간은 자유 발언(prompt 비어있음). */
export type PersonaKind = "human" | "ai";

/** AI 프로바이더 — Roy `Do` #10에 명시된 5종 화이트리스트. */
export const PERSONA_PROVIDERS = [
  "anthropic",
  "openai",
  "gemini",
  "grok",
  "deepseek",
] as const;
export type PersonaProvider = (typeof PERSONA_PROVIDERS)[number];

/**
 * 페르소나 1단위.
 *   id: 프리셋은 'preset:director' 형태, 커스텀은 ULID/UUID.
 *   colorToken: CSS 변수 이름 (예: 'robusta-color-participant-1') — 'var(--' prefix 제외, 호출 측에서 합성.
 *   iconMonogram: 1~2자 모노그램 (32×32 px 카드용). 빈 문자열은 nameKo[0] 또는 nameEn[0]로 fallback.
 *   defaultProvider: kind='ai'에서만 의미. 'human'은 항상 undefined.
 */
export interface Persona {
  id: string;
  kind: PersonaKind;
  isPreset: boolean;
  nameKo: string;
  nameEn: string;
  colorToken: string;
  iconMonogram: string;
  systemPromptKo: string;
  systemPromptEn: string;
  defaultProvider?: PersonaProvider;
  createdAt: number;
  updatedAt: number;
}

/** upsert 입력 — id는 신규 시 자동 생성, 기존 시 패치 대상. */
export type PersonaInput = Omit<Persona, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

/** 검증 상수 — UI/store 양측에서 공유. */
export const PERSONA_NAME_MAX = 32;
export const PERSONA_ICON_MAX = 2;
export const PERSONA_PROMPT_MAX = 500;

/**
 * 사용 가능한 colorToken 7종 (D-13.6 globals.css와 동기화).
 * preset-catalog · PersonaEditModal swatch · self-check가 같이 참조.
 */
export const PERSONA_COLOR_TOKENS = [
  "robusta-color-participant-1",
  "robusta-color-participant-2",
  "robusta-color-participant-3",
  "robusta-color-participant-4",
  "robusta-color-participant-5",
  "robusta-color-participant-human-1",
  "robusta-color-participant-human-2",
] as const;
export type PersonaColorToken = (typeof PERSONA_COLOR_TOKENS)[number];

/** 'foo-bar' 토큰 → 'var(--foo-bar)' CSS 표현. */
export function colorTokenToCssVar(token: string): string {
  return `var(--${token})`;
}

/** preset 불변 위반 시 throw하는 에러 (호출자가 instanceof로 분기 가능). */
export class PresetImmutableError extends Error {
  constructor(action: "remove" | "upsert", presetId: string) {
    super(`preset_immutable: ${action} on ${presetId}`);
    this.name = "PresetImmutableError";
  }
}

/* -------------------------------------------------------------------------
 * D-14.3 (Day 8, 2026-04-28) Persona ↔ Participant 변환 헬퍼.
 *
 * 명세 §3: PersonaModal과 PersonaEditModal을 잡스식 일원화. PersonaEditModal이
 * Persona 필드(nameKo/En, colorToken, iconMonogram, systemPromptKo/En, defaultProvider)
 * 만 노출하므로, Participant(name, role, color, model, systemPrompt)와 매핑이 필요하다.
 *
 * 변환은 _lossy_:
 *   - participant.role / model 은 모달에서 편집 X (prev 값 보존).
 *   - participant.color (CSS var 문자열) → colorToken 역변환은 휴리스틱.
 *
 * 외부 caller (shim, participants-panel)가 사용한다.
 * ------------------------------------------------------------------------- */

import type { Participant } from "@/modules/participants/participant-types";

/** D-14.3: kind에 따른 fallback colorToken. swatch 풀의 첫 항목. */
const FALLBACK_COLOR_TOKEN_BY_KIND: Record<PersonaKind, PersonaColorToken> = {
  ai: "robusta-color-participant-1",
  human: "robusta-color-participant-human-1",
};

/**
 * D-14.3 'var(--token-name)' 형식의 색을 token 이름으로 역변환.
 *   매칭 실패 시 kind별 fallback 토큰 반환.
 */
export function colorCssVarToToken(
  cssVar: string | undefined,
  kind: PersonaKind,
): PersonaColorToken {
  if (typeof cssVar !== "string") return FALLBACK_COLOR_TOKEN_BY_KIND[kind];
  const match = cssVar.match(/^var\(--([\w-]+)\)$/);
  if (!match) return FALLBACK_COLOR_TOKEN_BY_KIND[kind];
  const candidate = match[1] as PersonaColorToken;
  if ((PERSONA_COLOR_TOKENS as readonly string[]).includes(candidate)) {
    return candidate;
  }
  return FALLBACK_COLOR_TOKEN_BY_KIND[kind];
}

/**
 * D-14.3 Participant → PersonaInput.
 *   PersonaEditModal initial로 박는다 (편집 모드 표시용).
 *   - nameKo ← participant.name (단일 언어 → 한국어 슬롯)
 *   - nameEn ← '' (Participant에 영문 이름 없음 — 사용자가 채울 수 있음)
 *   - iconMonogram ← name 첫 글자
 *   - colorToken ← color CSS var 역변환 (실패 시 fallback)
 *   - systemPromptKo ← participant.systemPrompt
 *   - defaultProvider ← AI 기본 'anthropic' (모델→프로바이더 매핑은 D9 P1).
 */
export function participantToPersonaInput(p: Participant): PersonaInput {
  const firstChar = (p.name?.[0] ?? "?").slice(0, PERSONA_ICON_MAX);
  return {
    kind: p.kind,
    isPreset: false,
    nameKo: p.name,
    nameEn: "",
    colorToken: colorCssVarToToken(p.color, p.kind),
    iconMonogram: firstChar,
    systemPromptKo: p.systemPrompt ?? "",
    systemPromptEn: "",
    defaultProvider: p.kind === "ai" ? "anthropic" : undefined,
  };
}

/**
 * D-14.3 PersonaInput → Participant patch.
 *   기존 prev에 input의 편집 가능 필드만 덮어쓴다.
 *   role/model은 PersonaEditModal에서 편집 X — prev 값 보존.
 */
export function personaInputToParticipant(
  prev: Participant,
  input: PersonaInput,
): Participant {
  return {
    ...prev,
    name: input.nameKo.trim() || input.nameEn.trim() || prev.name,
    color: colorTokenToCssVar(input.colorToken),
    // AI에서만 systemPrompt 박음 (PersonaModal 기존 동작과 동일).
    systemPrompt:
      prev.kind === "ai" ? input.systemPromptKo : prev.systemPrompt,
  };
}
