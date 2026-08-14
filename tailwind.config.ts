import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Only the node/card colors (card, card-spouse, nam, nu, accent) are
        // restored to the original bright/high-contrast palette so gender
        // (nam/nu) and clan-membership (card vs card-spouse) stay easy to
        // tell apart. Canvas background, text colors (ink, muted), and font
        // stay on the warm sepia theme shared with the landing page.
        canvas: '#f3ead4',
        // Slightly warm (not pure) white: keeps the bright/high-contrast
        // node look, but avoids the ink text reading as near-black that
        // pure #ffffff causes via simultaneous-contrast with the dark
        // sepia ink color.
        card: '#fefcf6',
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
