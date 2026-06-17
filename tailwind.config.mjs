import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        cfr: {
          green: {
            50: "#f0f7f1",
            100: "#d9eddb",
            200: "#b5dbb9",
            300: "#85c28e",
            400: "#52a65e",
            500: "#2d8a3e",
            600: "#1f6e2f",
            700: "#1a5a27",
            800: "#174a21",
            900: "#0f3517",
            DEFAULT: "#1a4a3f",
            dark: "#0d2b24",
            accent: "#2d6a4f",
            leaf: "#4a8c5c",
          },
          earth: {
            50: "#faf6f0",
            100: "#f0e8d8",
            200: "#e0ceb0",
            300: "#d0b488",
            400: "#c09a60",
            500: "#b08040",
            600: "#8b5e3c",
            700: "#5c3d2e",
            800: "#3d281e",
            900: "#1e140f",
            DEFAULT: "#5c3d2e",
            dark: "#3d281e",
          },
          sand: {
            50: "#fdfaf5",
            100: "#faf5e8",
            200: "#f5ead0",
            300: "#e8d5b7",
            400: "#d4b890",
            500: "#c4a882",
            600: "#a88c6a",
            700: "#8a7254",
            800: "#6e5a42",
            900: "#4d3e2e",
            DEFAULT: "#e8d5b7",
            warm: "#f5ead0",
          },
          cream: {
            DEFAULT: "#faf8f5",
            dark: "#f0ece4",
          },
        },
      },
      fontFamily: {
        display: ["Playfair Display", ...defaultTheme.fontFamily.serif],
        body: ["Inter", ...defaultTheme.fontFamily.sans],
      },
      backgroundImage: {
        "hero-pattern":
          "linear-gradient(135deg, rgba(26,74,63,0.92) 0%, rgba(13,43,36,0.95) 100%)",
        "card-gradient":
          "linear-gradient(180deg, transparent 0%, rgba(13,43,36,0.85) 100%)",
        "leaf-pattern":
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a4a3f' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        premium:
          "0 4px 24px rgba(13,43,36,0.08), 0 1px 4px rgba(13,43,36,0.04)",
        glow:
          "0 0 24px rgba(45,106,79,0.15), 0 4px 24px rgba(13,43,36,0.08)",
        card: "0 2px 16px rgba(13,43,36,0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out forwards",
        "slide-up": "slideUp 0.8s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(32px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
};
