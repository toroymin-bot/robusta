import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        robusta: {
          canvas: "var(--robusta-canvas)",
          ink: "var(--robusta-ink)",
          inkDim: "var(--robusta-ink-dim)",
          divider: "var(--robusta-divider)",
          accent: "var(--robusta-accent)",
          accentSoft: "var(--robusta-accent-soft)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
