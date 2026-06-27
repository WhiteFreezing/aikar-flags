import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0c0d0f",
        surface: "#15171a",
        muted: "#1d1f23",
        border: "#2a2d33",
        text: "#e6e8ec",
        dim: "#8b9099",
        brand: { DEFAULT: "#f97316", soft: "#fb923c", deep: "#c2410c" },
        accent: "#22c55e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
