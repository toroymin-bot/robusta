import { robustaTokens } from "./theme";

type TokenKey = keyof typeof robustaTokens.light;

const cssVarNames: Record<TokenKey, string> = {
  canvas: "--robusta-canvas",
  ink: "--robusta-ink",
  inkDim: "--robusta-ink-dim",
  divider: "--robusta-divider",
  accent: "--robusta-accent",
  accentSoft: "--robusta-accent-soft",
};

export function tokenVar(key: TokenKey): string {
  return `var(${cssVarNames[key]})`;
}

export const cssVarMap = cssVarNames;
