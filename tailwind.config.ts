import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "sans-serif"],
      },
      colors: {
        purple: {
          DEFAULT: "#6c47ff",
          light: "#9c7aff",
          dark: "#4a2aff",
        },
        cyan: "#00d4ff",
        background: {
          primary: "#050508",
          secondary: "#0d0d15",
          card: "#12121e",
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "slide-in": "slide-in 0.3s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
