/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "#0F1B12",
          deep: "#0F1B12",
        },
        canopy: "#1A2E1C",
        accent: "#2ECC71",
        "accent-dim": "#27AE60",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(46, 204, 113, 0.35)",
        card: "0 4px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(46, 204, 113, 0.06)",
      },
      animation: {
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        "shimmer": "shimmer 8s linear infinite",
        "marquee-up": "marquee-up 14s linear infinite",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(46, 204, 113, 0.45)" },
          "50%": { opacity: "0.92", boxShadow: "0 0 0 6px rgba(46, 204, 113, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "marquee-up": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
