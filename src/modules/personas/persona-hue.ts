/**
 * persona-hue.ts
 *   - C-D37-4 (D-4 15시 슬롯, 2026-05-04) — Tori spec C-D37-4 (D-D37-1 / 페르소나 hue token map).
 *
 * Why: 페르소나마다 다른 hue token 으로 카드 시각 차별화.
 *   - hash(personaId) % 10 → 결정적 (동일 ID = 동일 색).
 *   - 10 hue Tailwind palette — emerald / sky / violet / rose / amber / teal / indigo / pink / lime / cyan.
 *   - bg / text / border 3 token 동시 반환.
 *
 * 정책:
 *   - 자율 정정 D-37-자-3: 명세 src/lib/persona-hue.ts → src/modules/personas/persona-hue.ts (모듈 그룹 정합).
 *   - 외부 dep 0 / shared 영향 0 (Tailwind utility 만 사용, 신규 클래스 0).
 *   - Tailwind purge safelist — 모든 30개 (10 hue × 3 token) 클래스 본 파일 안 평문 명시.
 *
 * 기존 hue 시스템 (PARTICIPANT_HUE_SEEDS, hsl-기반) 과 별개:
 *   - 기존: hue 0~360 정수 → hsl(_, 65%, 55%) 단일 톤. participant-color.ts.
 *   - 본 신규: personaId → discrete 10-color palette token. carddifferentiation 용.
 *   - 두 시스템 공존 — dot 은 기존, 카드 stripe 는 신규.
 */

/**
 * 10 hue palette — Tailwind 호환.
 *   각 항목은 bg/text/border 3 클래스 평문 (purge safelist 자동 인식).
 *   라이트 모드 기준 — 다크 모드는 호출자가 dark: prefix 추가 (현재 호출자 1건이라 경량).
 */
export const PERSONA_HUE_PALETTE = [
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  { bg: "bg-lime-50", text: "text-lime-700", border: "border-lime-200" },
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
] as const;

export type PersonaHueToken = {
  bg: string;
  text: string;
  border: string;
};

/**
 * personaHue — personaId 결정적 hash → palette idx.
 *   알고리즘: 31-진법 (자바 String.hashCode 패턴) — 충돌 회피 + 빠름.
 *   엣지:
 *     (1) 빈 personaId → palette[0] (deterministic fallback)
 *     (2) 동일 personaId → 동일 결과 (결정적)
 *     (3) 10 페르소나 초과 → 충돌 허용 (사용자 1인 ≤ 10 가정)
 */
export function personaHue(personaId: string): PersonaHueToken {
  if (personaId.length === 0) return PERSONA_HUE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < personaId.length; i++) {
    // (h * 31 + c) >>> 0 — unsigned 32-bit (음수 회피).
    hash = (hash * 31 + personaId.charCodeAt(i)) >>> 0;
  }
  const idx = hash % PERSONA_HUE_PALETTE.length;
  return PERSONA_HUE_PALETTE[idx];
}
