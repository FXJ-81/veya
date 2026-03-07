/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
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
    },
  },
  plugins: [],
};
