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
        background: "#0C0C0C",
        surface: "#111111",
        "surface-raised": "#161616",
        "surface-border": "#1a1a1a",

        // Purple is ONLY for buttons, badges, and data highlights — never nav
        accent: {
          DEFAULT: "#7C3AED",
          hover: "#6D28D9",
          light: "rgba(124,58,237,0.12)",
          text: "#A78BFA",
          foreground: "#FFFFFF",
        },
        primary: {
          DEFAULT: "#7C3AED",
          foreground: "#FFFFFF",
          hover: "#6D28D9",
        },
        "primary-light": "rgba(124,58,237,0.12)",

        foreground: "#FFFFFF",

        card: {
          DEFAULT: "#111111",
          foreground: "#FFFFFF",
        },
        popover: {
          DEFAULT: "#161616",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#161616",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#333333",
          foreground: "#666666",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },

        positive: "#10B981",
        negative: "#EF4444",
        warning: "#F59E0B",

        border: "#1a1a1a",
        "border-subtle": "#141414",
        input: "#1a1a1a",
        ring: "#7C3AED",

        // Sidebar — NO purple. White-based active states only.
        sidebar: {
          DEFAULT: "#0C0C0C",
          foreground: "#666666",
          primary: "#FFFFFF", // active text = white, not purple
          "primary-foreground": "#FFFFFF",
          accent: "rgba(255,255,255,0.06)", // active bg = barely visible white
          "accent-foreground": "#FFFFFF",
          border: "#1a1a1a",
          ring: "transparent",
        },
      },
      borderRadius: {
        lg: "10px",
        md: "8px",
        sm: "6px",
      },
      fontSize: {
        // Tighter, more intentional scale
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
