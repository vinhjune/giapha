import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f8fafc',
        card: '#ffffff',
        'card-border': '#e2e8f0',
        'card-spouse': '#f1f5f9',
        ink: '#0f172a',
        muted: '#64748b',
        accent: '#4f46e5',
        'accent-soft': '#eef2ff',
        nam: '#0ea5e9',
        nu: '#f43f5e',
      },
    },
  },
  plugins: [],
} satisfies Config
