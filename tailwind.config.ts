import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Node/card backgrounds (canvas, card, card-spouse, nam, nu, accent)
        // are restored to the original bright/high-contrast palette so
        // gender (nam/nu) and clan-membership (card vs card-spouse) stay
        // easy to tell apart at a glance. Text colors (ink, muted) keep the
        // warm sepia tone shared with the landing page header.
        canvas: '#f8fafc',
        card: '#ffffff',
        'card-hover': '#f8fafc',
        'card-border': '#e2e8f0',
        'card-spouse': '#f1f5f9',
        ink: '#2e281f',
        muted: '#756c5e',
        accent: '#4f46e5',
        'accent-soft': '#eef2ff',
        highlight: '#60a5fa',
        nam: '#0ea5e9',
        nu: '#f43f5e',
      },
    },
  },
  plugins: [],
} satisfies Config
