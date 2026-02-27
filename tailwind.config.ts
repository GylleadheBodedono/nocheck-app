import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Cores dinamicas baseadas nas variaveis CSS
        page: "var(--bg-page)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          hover: "var(--bg-surface-hover)",
          active: "var(--bg-surface-active)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          hover: "var(--secondary-hover)",
          foreground: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        muted: "var(--text-muted)",
        subtle: "var(--border-subtle)",
        success: "var(--status-success-text)",
        error: "var(--status-error-text)",
        warning: "var(--status-warning-text)",
        info: "var(--status-info-text)",
      },
      borderColor: {
        subtle: "var(--border-subtle)",
        DEFAULT: "var(--border-default)",
        strong: "var(--border-strong)",
      },
      boxShadow: {
        "theme-sm": "var(--shadow-sm)",
        "theme-md": "var(--shadow-md)",
        "theme-lg": "var(--shadow-lg)",
        "theme-xl": "var(--shadow-xl)",
      },
      ringColor: {
        theme: "var(--ring-color)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-20px) translateX(10px)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(15px) translateX(-10px)" },
        },
        "float-slow-reverse": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-12px) translateX(-8px)" },
        },
        "smoke-drift-1": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%":      { transform: "translate(30px, -40px) scale(1.12)" },
          "50%":      { transform: "translate(-20px, -15px) scale(0.92)" },
          "75%":      { transform: "translate(15px, 25px) scale(1.08)" },
        },
        "smoke-drift-2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "30%":      { transform: "translate(-35px, 20px) scale(1.15)" },
          "60%":      { transform: "translate(25px, -30px) scale(0.88)" },
        },
        "smoke-drift-3": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "35%":      { transform: "translate(20px, 35px) scale(1.1)" },
          "65%":      { transform: "translate(-30px, -20px) scale(0.93)" },
        },
        "smoke-pulse": {
          "0%, 100%": { opacity: "0.06" },
          "50%":      { opacity: "0.10" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "float-slow": "float-slow 8s ease-in-out infinite",
        "float-delayed": "float-delayed 10s ease-in-out infinite 2s",
        "float-slow-reverse": "float-slow-reverse 12s ease-in-out infinite 4s",
        "smoke-drift-1": "smoke-drift-1 14s ease-in-out infinite",
        "smoke-drift-2": "smoke-drift-2 18s ease-in-out infinite 3s",
        "smoke-drift-3": "smoke-drift-3 22s ease-in-out infinite 6s",
        "smoke-pulse": "smoke-pulse 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

export default config
