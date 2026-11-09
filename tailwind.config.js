/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pageBg: "#1B1B1F",
        panel: "#2A2B32",
        tile: "#34353D",
        tileHover: "#3A3B44",
        borderSubtle: "#3A3B44",
        textPrimary: "#EDEDED",
        textMuted: "#9A9BA5",
        accent: "#E8404F",
        accentHover: "#D63846",
        essential: "#22C55E",
        essentialBg: "rgba(34,197,94,0.15)",
        useful: "#EDEDED",
        optional: "#E8404F",
        easy: "#22C55E",
        normal: "#EAB308",
        hard: "#E8404F",
        defender: "#3DD6B6",
        attacker: "#E8404F",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "8px",
        pill: "9999px",
      },
      transitionDuration: {
        ui: "150ms",
      },
    },
  },
  plugins: [],
};
