import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm sepia/editorial palette shared with the landing page (see
        // src/styles/gia-pha-theme.css), so /gia-pha and / read as one product.
        canvas: '#f3ead4',
        card: '#fbf7ec',
        'card-hover': '#f1e6d0',
        'card-border': '#e3d5b8',
        'card-spouse': '#efe2c8',
        ink: '#2e281f',
        muted: '#756c5e',
        accent: '#8e342b',
        'accent-soft': '#f3e2c7',
        highlight: '#c18b2c',
        nam: '#7a4a30',
        nu: '#b5793f',
      },
    },
  },
  plugins: [],
} satisfies Config
