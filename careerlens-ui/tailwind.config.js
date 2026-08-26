/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace', 'ui-monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#090b10',
          base: '#06070a',
          card: '#0e121a',
          elevated: '#141a24',
          border: '#20293a',
          'border-subtle': '#18202e',
          'border-active': '#00f0ff50',
          hover: '#1b2331',
        },
        lens: {
          cyan: '#00f0ff',
          'cyan-dim': 'rgba(0, 240, 255, 0.12)',
          'cyan-glow': 'rgba(0, 240, 255, 0.35)',
          sapphire: '#0ea5e9',
          blue: '#3b82f6',
          violet: '#8b5cf6',
          'violet-dim': 'rgba(139, 92, 246, 0.12)',
        },
        focus: {
          locked: '#00e676', // High / success
          'locked-dim': 'rgba(0, 230, 118, 0.12)',
          'locked-glow': 'rgba(0, 230, 118, 0.3)',
          calibrating: '#ffb300', // Mid / warning
          'calibrating-dim': 'rgba(255, 179, 0, 0.12)',
          lost: '#ff3366', // Low / gap
          'lost-dim': 'rgba(255, 51, 102, 0.12)',
        },
        accent: {
          DEFAULT: '#00f0ff',
          hover: '#38bdf8',
          dim: 'rgba(0, 240, 255, 0.12)',
          purple: '#8b5cf6',
        },
        score: {
          high: '#00e676',
          mid: '#ffb300',
          low: '#ff3366',
          'high-dim': 'rgba(0, 230, 118, 0.12)',
          'mid-dim': 'rgba(255, 179, 0, 0.12)',
          'low-dim': 'rgba(255, 51, 102, 0.12)',
        },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(1000%)', opacity: '0' },
        },
        'laser-sweep': {
          '0%': { top: '0%', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        'aperture-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'optical-pulse': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease forwards',
        'fade-in': 'fade-in 0.3s ease forwards',
        'scan-line': 'scan-line 2.4s ease-in-out infinite',
        'laser-sweep': 'laser-sweep 2s ease-in-out infinite',
        'aperture-spin': 'aperture-spin 8s linear infinite',
        'aperture-spin-fast': 'aperture-spin 1.5s linear infinite',
        'optical-pulse': 'optical-pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite linear',
      },
    },
  },
  plugins: [],
};
