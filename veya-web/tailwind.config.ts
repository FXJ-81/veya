import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08080f",
        "background-secondary": "#0d0d14",
        surface: "#1a1a26",
        card: "#111118",
        border: "#2a2a3a",
        accent: "#5b6ef5",
        "accent-2": "#a78bfa",
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#f87171",
        "text-primary": "#f8f8ff",
        "text-secondary": "#b0b0c8",
        "text-tertiary": "#9090aa",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
