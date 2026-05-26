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
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "surface-border": "var(--surface-border)",

        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          light: "var(--accent-light)",
          text: "var(--accent-text)",
          foreground: "var(--primary-foreground, #0E1F10)",
        },
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--primary-foreground, #ffffff)",
          hover: "var(--accent-hover)",
        },
        "primary-light": "var(--accent-light)",

        foreground: "var(--foreground)",

        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive, #FF6B5E)",
          foreground: "var(--destructive-foreground, #ffffff)",
        },

        positive: "var(--positive, #C8F26A)",
        negative: "var(--negative, #FF6B5E)",
        warning: "var(--warning, #F5C25B)",

        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        input: "var(--input)",
        ring: "var(--ring)",

        sidebar: {
          DEFAULT: "var(--background)",
          foreground: "var(--text-muted)",
          primary: "var(--text-primary)",
          "primary-foreground": "var(--text-primary)",
          accent: "rgba(255,255,255,0.06)",
          "accent-foreground": "var(--text-primary)",
          border: "var(--border)",
          ring: "transparent",
        },
      },
      borderRadius: {
        lg: "16px",
        md: "12px",
        sm: "6px",
        pill: "9999px",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "22px" }],
        md: ["15px", { lineHeight: "24px" }],
        lg: ["16px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "30px" }],
        "3xl": ["32px", { lineHeight: "38px" }],
        "4xl": ["40px", { lineHeight: "44px" }],
        "5xl": ["52px", { lineHeight: "56px" }],
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
