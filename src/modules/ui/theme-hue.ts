/**
 * theme-hue.ts
 *   - C-D26-5 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-5 (B-65/F-65/D-65).
 *
 * Why 분리: theme.ts 본체는 다크모드 store + 부트 cookie 등 layout.tsx 가 정적 import 하는 핵심.
 *   PERSONA_COLOR_TOKEN_TO_HUE 매핑은 picker-modal / persona-card-color-dot 등 _카드 표시_ 전용 —
 *   메인 번들에서 분리해 lazy chunk 로 옮겨 168 kB 회복 (KQ_20 (d)+(a) 결합).
 *
 * 호출처: persona-picker-modal.tsx, persona-card-color-dot.tsx 직접 import.
 *   theme.ts 는 본 모듈을 직접 import 하지 않음 (메인 번들 분리 의무).
 *
 * OCP: 외부 의존 0. 순수 매핑 + 1 함수.
 */

import type { PersonaColorToken } from "@/modules/personas/persona-types";

export const PERSONA_COLOR_TOKEN_TO_HUE: Record<PersonaColorToken, number> = {
  "robusta-color-participant-1": 20,
  "robusta-color-participant-2": 50,
  "robusta-color-participant-3": 150,
  "robusta-color-participant-4": 200,
  "robusta-color-participant-5": 280,
  "robusta-color-participant-human-1": 200,
  "robusta-color-participant-human-2": 280,
} as const satisfies Record<PersonaColorToken, number>;

export function personaColorTokenToHue(token: PersonaColorToken): number {
  return PERSONA_COLOR_TOKEN_TO_HUE[token];
}
