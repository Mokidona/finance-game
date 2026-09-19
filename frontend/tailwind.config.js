/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "bg-main": "#000000",
        "accent-mint": "#30D158",
        "accent-red": "#FF453A",
        "text-primary": "#FFFFFF",
        "text-secondary": "#8E8E93",
        "text-tertiary": "#636366",
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["SF Mono", "JetBrains Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
