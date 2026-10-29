/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3525CD",
          hover: "#2A1CB5",
          light: "#EEF2FF",
          dark: "#1E1B4B"
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F8F9FE",
          muted: "#F0F2FA",
          dark: "#0F172A",
          darkCard: "#1E293B"
        },
        accent: {
          green: "#10B981",
          greenLight: "#ECFDF5",
          amber: "#F59E0B"
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      }
    },
  },
  plugins: [],
};
