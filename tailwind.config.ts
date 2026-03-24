import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        background: "#3D2B1A",
        surface: "#4A3525",
        "surface-raised": "#56402E",
        "surface-border": "#6B5240",

        accent: {
          DEFAULT: "#E8461E",
          hover: "#D13A14",
          light: "rgba(232,70,30,0.15)",
          text: "#FF6B42",
          foreground: "#ffffff",
        },
        primary: {
          DEFAULT: "#E8461E",
          foreground: "#ffffff",
          hover: "#D13A14",
        },
        "primary-light": "rgba(232,70,30,0.15)",

        foreground: "#F5E6D0",

        card: {
          DEFAULT: "#4A3525",
          foreground: "#F5E6D0",
        },
        popover: {
          DEFAULT: "#56402E",
          foreground: "#F5E6D0",
        },
        secondary: {
          DEFAULT: "#56402E",
          foreground: "#F5E6D0",
        },
        muted: {
          DEFAULT: "#6B5240",
          foreground: "#C4A882",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#ffffff",
        },

        positive: "#10B981",
        negative: "#EF4444",
        warning: "#F59E0B",

        border: "#6B5240",
        "border-subtle": "#56402E",
        input: "#6B5240",
        ring: "#E8461E",

        sidebar: {
          DEFAULT: "#3D2B1A",
          foreground: "#8B7355",
          primary: "#F5E6D0",
          "primary-foreground": "#F5E6D0",
          accent: "rgba(255,255,255,0.06)",
          "accent-foreground": "#F5E6D0",
          border: "#6B5240",
          ring: "transparent",
        },
      },
      borderRadius: {
        lg: "10px",
        md: "8px",
        sm: "6px",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["13px", { lineHeight: "20px" }],
        md: ["14px", { lineHeight: "22px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["36px", { lineHeight: "42px" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out forwards",
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
