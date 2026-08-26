import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#12121a',
          card: '#1a1a28',
          elevated: '#22223a',
          border: '#2e2e4a',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          dim: 'rgba(99,102,241,0.15)',
        },
        score: {
          high: '#22c55e',
          mid: '#f59e0b',
          low: '#ef4444',
          'high-dim': 'rgba(34,197,94,0.12)',
          'mid-dim': 'rgba(245,158,11,0.12)',
          'low-dim': 'rgba(239,68,68,0.12)',
        },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease forwards',
        'fade-in': 'fade-in 0.3s ease forwards',
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
}

export default config
