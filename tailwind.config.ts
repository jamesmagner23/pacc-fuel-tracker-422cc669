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
        background: "#110B06",
        surface: "#1A1009",
        "surface-raised": "#221408",
        "surface-border": "#2E1C0C",

        accent: {
          DEFAULT: "#FF4D1C",
          hover: "#E63D0F",
          light: "rgba(255,77,28,0.12)",
          text: "#FF7A52",
          foreground: "#ffffff",
        },
        primary: {
          DEFAULT: "#FF4D1C",
          foreground: "#ffffff",
          hover: "#E63D0F",
        },
        "primary-light": "rgba(255,77,28,0.12)",

        foreground: "#F2EDE6",

        card: {
          DEFAULT: "#1A1009",
          foreground: "#F2EDE6",
        },
        popover: {
          DEFAULT: "#221408",
          foreground: "#F2EDE6",
        },
        secondary: {
          DEFAULT: "#221408",
          foreground: "#F2EDE6",
        },
        muted: {
          DEFAULT: "#2E1C0C",
          foreground: "#8B7355",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#ffffff",
        },

        positive: "#10B981",
        negative: "#EF4444",
        warning: "#F59E0B",

        border: "#2E1C0C",
        "border-subtle": "#1E1208",
        input: "#2E1C0C",
        ring: "#FF4D1C",

        sidebar: {
          DEFAULT: "#110B06",
          foreground: "#4A3520",
          primary: "#F2EDE6",
          "primary-foreground": "#F2EDE6",
          accent: "rgba(255,255,255,0.05)",
          "accent-foreground": "#F2EDE6",
          border: "#2E1C0C",
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
