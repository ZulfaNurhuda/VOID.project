import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          bg:           "#020617",
          surface:      "#0f172a",
          "surface-2":  "#1e293b",
          border:       "#334155",
          "border-2":   "#475569",
          text:         "#f8fafc",
          muted:        "#94a3b8",
          dim:          "#475569",
          accent:       "#22d3ee",
          "accent-dim": "#06b6d4",
          success:      "#22c55e",
          warning:      "#f59e0b",
          danger:       "#ef4444",
          "danger-dim": "#dc2626",
          "code-bg":    "#020617",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        none:    "0px",
        DEFAULT: "0px",
        sm:      "0px",
        md:      "0px",
        lg:      "0px",
        xl:      "0px",
        "2xl":   "0px",
        "3xl":   "0px",
        full:    "9999px",
      },
      backgroundImage: {
        "space-gradient": "linear-gradient(to bottom right, #020617, #0f172a, #1e1b4b)",
        "grid-pattern":   "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
      },
      animation: {
        "glow-pulse": "glow 3s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%":   { boxShadow: "0 0 5px rgba(34, 211, 238, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(34, 211, 238, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
