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
    },
  },
  plugins: [],
}

export default config
