import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0a2463",
          blue: "#1e5f9e",
          cyan: "#3e92cc",
          gold: "#c9a227",
          dark: "#1a1a2e",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f7f8fb",
          subtle: "#f1f3f9",
        },
        ink: {
          DEFAULT: "#1a1a2e",
          muted: "#475069",
          faint: "#8b93ab",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "Times", "serif"],
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        eyebrow: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.14em" }],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        cardHover: "0 4px 12px -2px rgb(16 24 40 / 0.10)",
        pop: "0 8px 24px -6px rgb(10 36 99 / 0.18)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out both",
        "scale-in": "scale-in 180ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;