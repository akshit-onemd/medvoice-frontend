/** @type {import('tailwindcss').Config} */
// Design tokens. Everything in the UI is built from these names, so the
// look of the whole app can be changed here.
//   ink / clinical : brand navy and indigo, taken from the OneMD mark
//   ok / amber / alert : meaning only (fine, needs review, danger)
//   red (Tailwind default) : reserved for the record control
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F3F4F8",
        ink: "#1B1D36",
        muted: "#5E627A",
        line: "#E0E2EB",
        surface: "#FFFFFF",
        clinical: {
          50: "#EFF1FB",
          100: "#DDE1F6",
          200: "#C2C8EE",
          400: "#5A66CC",
          500: "#2F3A9E",
          600: "#262F85",
          700: "#1D2468",
        },
        ok: {
          50: "#E7F5EE",
          500: "#1F8A5B",
          600: "#17704A",
        },
        alert: {
          50: "#FCECEA",
          400: "#D0503F",
          500: "#B53A2C",
        },
        amber: {
          50: "#FDF4E3",
          100: "#FAE6C0",
          400: "#D9982B",
          500: "#B97D14",
          600: "#96630C",
          700: "#7A4F08",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "'IBM Plex Sans Devanagari'", "system-ui", "sans-serif"],
        display: ["'IBM Plex Sans'", "'IBM Plex Sans Devanagari'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(27, 29, 54, 0.04), 0 10px 24px -16px rgba(27, 29, 54, 0.18)",
        pop: "0 2px 6px rgba(27, 29, 54, 0.06), 0 24px 48px -16px rgba(27, 29, 54, 0.28)",
        record: "0 10px 24px -10px rgba(220, 38, 38, 0.55)",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "14px",
        lg: "12px",
        xl: "18px",
      },
    },
  },
  plugins: [],
};
