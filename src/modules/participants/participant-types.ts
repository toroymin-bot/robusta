export type ParticipantKind = "human" | "ai";

// D-9.2 (Day 4, 2026-04-29): role 필드 추가 — 인격/R&R 모달의 'role'(역할 한 줄, 0~40자, 선택).
//   AI/Human 공통 노출. systemPrompt 는 AI 전용 (composer 'customAppend').
export interface Participant {
  id: string;
  kind: ParticipantKind;
  name: string;
  color: string;
  /** D-9.2 신규 — 역할(0~40자), AI/Human 공통, 선택. */
  role?: string;
  model?: string;
  systemPrompt?: string;
}

export type ParticipantInput = Omit<Participant, "id" | "color"> & {
  color?: string;
};

/** D-9.2 명세 §3 — 이름 길이 검증 상수. */
export const PARTICIPANT_NAME_MIN = 1;
export const PARTICIPANT_NAME_MAX = 30;
/** D-9.2 명세 §3 — 역할 길이 (선택, 0~40자). */
export const PARTICIPANT_ROLE_MAX = 40;
/** D-9.2 명세 §3 — 인격 프롬프트 길이 (선택, 0~1500자, 추정 17). */
export const PARTICIPANT_SYSTEM_PROMPT_MAX = 1500;

/** D-9.2 명세 §3 — 모델 화이트리스트. */
export const ALLOWED_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-3-5-sonnet-latest",
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];
