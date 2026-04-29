/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        navy: '#0B1D34',
        gold: '#D4962A',
        'gold-pale': '#F2E3C6',

        // Surfaces
        offwhite: '#F0ECE4',
        card: '#FFFFFF',
        ink: '#1C1C1C',
        gray: '#6B6B6B',
        lightgray: '#D5D1CA',
        divider: '#EAE7E0',

        // Accents reused across category badges
        red: '#C0392B',
        teal: '#1A8A7D',
        purple: '#5B3A8C',

        // Semantic (state) tokens — replace the raw hex values that were
        // scattered across error/success/warning surfaces.
        danger: {
          DEFAULT: '#8B1A1A',
          bg: '#F5D5D0',
          border: '#E5B5B0',
        },
        success: {
          DEFAULT: '#0F5E54',
          bg: '#D0EDE9',
        },
        warning: {
          DEFAULT: '#8B6914',
          bg: '#F2E3C6',
        },
      },
      fontFamily: {
        archivo: ['Archivo', 'sans-serif'],
        franklin: ['Libre Franklin', 'sans-serif'],
        // Editorial serif used for profile nameplates, pull quotes, and
        // anywhere else we want a warm, magazine-feature voice. Variable
        // font so optical size and italic axis are free to use.
        editorial: ['Fraunces', 'Georgia', 'serif'],
        // Body serif for post bodies + comment text — pairs with the
        // editorial title font for a newspaper feel. Georgia is shipped
        // with every modern OS, so this adds zero bundle weight while
        // giving us a real serif that reads better than Franklin (sans)
        // for long paragraphs. Charter falls in second (Mac/iOS native);
        // Source Serif Pro third (Google Font, only loaded if added later).
        prose: ['Georgia', 'Charter', '"Source Serif Pro"', 'serif'],
      },
      // Additional fontSize tokens so we stop reaching for arbitrary values
      // like text-[0.62rem] and text-[0.78rem] in every component.
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.95rem' }],   // 10px
        'micro': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
        'mini': ['0.75rem', { lineHeight: '1.05rem' }],   // 12px
      },
    },
  },
  plugins: [],
}
