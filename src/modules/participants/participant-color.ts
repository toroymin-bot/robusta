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
