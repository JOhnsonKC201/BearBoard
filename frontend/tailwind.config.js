/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Morgan State University colors
        'msu-blue': '#003057',
        'msu-gold': '#E8A825',
        // TODO: Add neutral shades, error/success colors
      },
      // TODO: Add custom fonts (Google Fonts pairing)
    },
  },
  plugins: [],
}
