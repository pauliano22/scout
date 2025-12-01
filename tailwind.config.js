/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cornell-red': '#B31B1B',
        'cornell-red-light': '#e63946',
      },
      fontFamily: {
        'display': ['Playfair Display', 'serif'],
        'sans': ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
