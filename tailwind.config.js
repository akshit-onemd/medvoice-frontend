/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F7F4",
        ink: "#1C2A28",
        muted: "#5C6B67",
        line: "#DFE3DD",
        surface: "#FFFFFF",
        clinical: {
          50: "#EEF4F1",
          100: "#D7E5DE",
          400: "#4C8577",
          500: "#2F6F62",
          600: "#255A50",
          700: "#1C443C",
        },
        alert: {
          50: "#FBECE9",
          400: "#C1554B",
          500: "#A8453C",
        },
        amber: {
          50: "#FBF3E7",
          400: "#B8823C",
        },
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(28, 42, 40, 0.06)",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
