/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#4F46E5",
          50: "#EEF2FF",
          100: "#E0E7FF",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
        },
        secondary: {
          DEFAULT: "#06B6D4",
          500: "#06B6D4",
          600: "#0891B2",
        },
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 10px 25px -5px rgba(79, 70, 229, 0.10), 0 8px 10px -6px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};
