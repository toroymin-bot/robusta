export const robustaTokens = {
  light: {
    canvas: "#FFFCEB",
    ink: "#15140E",
    inkDim: "#5C5849",
    divider: "#EAE3C7",
    accent: "#C9A227",
    accentSoft: "#F1E1A1",
  },
  dark: {
    canvas: "#1A1814",
    ink: "#F1E9CC",
    inkDim: "#A39A7E",
    divider: "#2E2A20",
    accent: "#E2B946",
    accentSoft: "#3A3320",
  },
} as const;

export const PARTICIPANT_HUE_SEEDS = [20, 200, 130, 280, 50, 320] as const;

export type RobustaTheme = typeof robustaTokens;
