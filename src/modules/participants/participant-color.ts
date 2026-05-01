import { PARTICIPANT_HUE_SEEDS } from "@/modules/ui/theme";

const GOLDEN_ANGLE = 137.508;
const MIN_DELTA = 30;

function normalizeHue(h: number): number {
  if (!Number.isFinite(h)) return 0;
  const mod = ((h % 360) + 360) % 360;
  return mod;
}

function minDistance(target: number, others: number[]): number {
  if (others.length === 0) return 360;
  let best = 360;
  for (const o of others) {
    const diff = Math.abs(normalizeHue(o) - target);
    const d = Math.min(diff, 360 - diff);
    if (d < best) best = d;
  }
  return best;
}

export function nextParticipantHue(existingHues: number[]): number {
  const used = existingHues.map(normalizeHue);

  for (const seed of PARTICIPANT_HUE_SEEDS) {
    if (minDistance(seed, used) >= MIN_DELTA) return seed;
  }

  let candidate = used.length > 0 ? normalizeHue(used[used.length - 1]! + GOLDEN_ANGLE) : 0;
  for (let i = 0; i < 360; i += 1) {
    if (minDistance(candidate, used) >= MIN_DELTA) return candidate;
    candidate = normalizeHue(candidate + GOLDEN_ANGLE);
  }
  return normalizeHue(candidate);
}

export function hueToHsl(hue: number): string {
  return `hsl(${normalizeHue(hue)} 65% 55%)`;
}

export function hueToBubbleBorder(hue: number): string {
  return `hsl(${normalizeHue(hue)} 65% 55% / 0.6)`;
}

const HSL_RE = /^hsl\(\s*(-?\d+(?:\.\d+)?)/;

export function parseHueFromColor(color: string): number | null {
  const match = HSL_RE.exec(color.trim());
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]!);
  if (!Number.isFinite(parsed)) return null;
  return normalizeHue(parsed);
}

/**
 * C-D21-3 (D6 15시 슬롯, 2026-05-01) — D-22 색맹 동반 도형 매핑 (1차 토큰화).
 *
 * 목적: hue 만으로 참여자 구분 시 색맹(deuteranopia/protanopia) 사용자가 구분 불가.
 *      → 5분면 hue bucket 별로 고정 도형 글리프를 반환. 음성 SR · 텍스트 prefix 양쪽에서 사용.
 *
 * 출력 안정성: 0~360 의 어떤 입력도 5개 글리프 중 하나로 결정적 매핑 (boundary 포함).
 *
 * 색맹 동반 글리프 5종 (도형 윤곽 차이가 큰 단색 유니코드):
 *   0  ≤ h <  72 :  ◉ (filled circle dot)
 *   72 ≤ h < 144 :  ◯ (open circle)
 *  144 ≤ h < 216 :  ◇ (open diamond)
 *  216 ≤ h < 288 :  △ (open triangle)
 *  288 ≤ h < 360 :  ◊ (lozenge)
 *
 * 동반 라벨(스크린 리더 / aria-label 보강):
 *   ◉ → "원" / "circle"     (locale 인자로 분기 — 호출자가 i18n 결정)
 *   ◯ → "고리" / "ring"
 *   ◇ → "마름모" / "diamond"
 *   △ → "삼각형" / "triangle"
 *   ◊ → "다이아" / "lozenge"
 *
 * 비-책임: DOM 렌더는 하지 않음. 호출자가 ::before pseudo 또는 aria-label 에 접목.
 */
export type ParticipantShape = "◉" | "◯" | "◇" | "△" | "◊";

export function hueToShape(hue: number): ParticipantShape {
  const h = normalizeHue(hue);
  if (h < 72) return "◉";
  if (h < 144) return "◯";
  if (h < 216) return "◇";
  if (h < 288) return "△";
  return "◊";
}

const SHAPE_LABEL_KO: Record<ParticipantShape, string> = {
  "◉": "원",
  "◯": "고리",
  "◇": "마름모",
  "△": "삼각형",
  "◊": "다이아",
};

const SHAPE_LABEL_EN: Record<ParticipantShape, string> = {
  "◉": "circle",
  "◯": "ring",
  "◇": "diamond",
  "△": "triangle",
  "◊": "lozenge",
};

export function shapeToLabel(
  shape: ParticipantShape,
  locale: "ko" | "en" = "ko",
): string {
  return locale === "en" ? SHAPE_LABEL_EN[shape] : SHAPE_LABEL_KO[shape];
}

/** hue 한 번에 도형 + 라벨 동시 추출 — aria-label 합성 시 1회 호출. */
export function hueToShapeAria(
  hue: number,
  locale: "ko" | "en" = "ko",
): { shape: ParticipantShape; label: string } {
  const shape = hueToShape(hue);
  return { shape, label: shapeToLabel(shape, locale) };
}
