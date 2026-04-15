/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0B1D34',
        gold: '#D4962A',
        'gold-pale': '#F2E3C6',
        offwhite: '#F0ECE4',
        ink: '#1C1C1C',
        gray: '#6B6B6B',
        lightgray: '#D5D1CA',
        card: '#FFFFFF',
        red: '#C0392B',
        teal: '#1A8A7D',
        purple: '#5B3A8C',
      },
      fontFamily: {
        archivo: ['Archivo', 'sans-serif'],
        franklin: ['Libre Franklin', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
