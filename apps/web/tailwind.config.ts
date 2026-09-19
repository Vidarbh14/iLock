import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#08090d',
        surface: '#0d1017',
        surfaceHover: '#131824',
        border: 'rgba(255, 255, 255, 0.08)',
        muted: '#8b949e',
        cyber: {
          bg: '#08090d',
          card: '#0d111a',
          cardHover: '#121724',
          cardBorder: 'rgba(255, 255, 255, 0.08)',
          cardBorderHover: 'rgba(0, 229, 255, 0.3)',
          blue: '#0066ff',
          cyan: '#00e5ff',
          teal: '#00f2fe',
          purple: '#8b5cf6',
          indigo: '#6366f1',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          text: '#f0f3f6',
          textMuted: '#8b949e',
          textDim: '#4b5563',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'cyber-card': '0 8px 32px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
        'cyber-glow': '0 0 25px -3px rgba(0, 229, 255, 0.25)',
        'cyber-blue-glow': '0 0 25px -3px rgba(0, 102, 255, 0.3)',
        'cyber-emerald-glow': '0 0 20px -3px rgba(16, 185, 129, 0.3)',
        'cyber-rose-glow': '0 0 20px -3px rgba(244, 63, 94, 0.3)',
      },
      animation: {
        'orb-float': 'orbFloat 8s ease-in-out infinite',
        'orb-float-delayed': 'orbFloat 10s ease-in-out 3s infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'ambient-drift-slow': 'ambientDriftSlow 18s ease-in-out infinite alternate',
        'ambient-drift-rev': 'ambientDriftRev 22s ease-in-out infinite alternate',
        'scan-line': 'scanLine 2s ease-in-out infinite',
        'conduit-flow': 'conduitFlow 2.8s linear infinite',
        'ring-expand': 'ringExpand 2s cubic-bezier(0, 0.2, 0.8, 1) infinite',
        'enter-up': 'enterUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        orbFloat: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(6px, -8px) scale(1.05)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '0.9', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(0.98)' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        ambientDriftSlow: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(60px, 40px) scale(1.12)' },
          '100%': { transform: 'translate(-40px, 80px) scale(0.95)' },
        },
        ambientDriftRev: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(-70px, -35px) scale(1.08)' },
          '100%': { transform: 'translate(50px, -60px) scale(0.92)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '30%': { opacity: '0.8' },
          '70%': { opacity: '0.8' },
          '100%': { transform: 'translateY(250%)', opacity: '0' },
        },
        conduitFlow: {
          '0%': { strokeDashoffset: '60' },
          '100%': { strokeDashoffset: '0' },
        },
        ringExpand: {
          '0%': { transform: 'scale(0.8)', opacity: '0.9' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        enterUp: {
          '0%': { opacity: '0', transform: 'translateY(18px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
