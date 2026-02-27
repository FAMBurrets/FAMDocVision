/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0f172a',
          'navy-light': '#1e293b',
          red: '#e85a4f',
          'red-dark': '#d14940',
          'red-light': '#fef2f2',
        }
      }
    }
  },
  plugins: [],
}
