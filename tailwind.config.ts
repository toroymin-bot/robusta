import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        robustaCanvas: "#FFFCEB",
      },
    },
  },
  plugins: [],
};

export default config;
