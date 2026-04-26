export const robustaTheme = {
  canvas: "#FFFCEB",
  ink: "#1A1A1A",
  accent: "#F4B400",
  participantHues: {
    human: "#1A1A1A",
    tori: "#7C9EFF",
    komi: "#FFB37C",
  },
} as const;

export type RobustaTheme = typeof robustaTheme;
