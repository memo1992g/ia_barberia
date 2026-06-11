/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        evo: {
          black: "#050507",
          charcoal: "#111116",
          gold: "#c8a96a",
          goldSoft: "#f0ddba",
          smoke: "#1c1d24",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(200, 169, 106, 0.18), 0 20px 80px rgba(0, 0, 0, 0.55)",
      },
      backgroundImage: {
        "evo-radial":
          "radial-gradient(circle at top, rgba(200,169,106,0.18), transparent 35%), radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 30%)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.98)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        bars: {
          "0%, 100%": { transform: "scaleY(0.45)" },
          "50%": { transform: "scaleY(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.8s ease-in-out infinite",
        bars: "bars 1.1s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
