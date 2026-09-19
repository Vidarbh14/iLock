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
        background: '#0a0d14',
        surface: '#111520',
        surfaceHover: '#181e2e',
        border: 'rgba(255, 255, 255, 0.08)',
        muted: '#86868b',
        apple: {
          dark: '#0a0d14',
          surface: '#121622',
          surfaceLight: '#181e2e',
          blue: '#2997ff',
          blueHover: '#0071e3',
          gray: '#86868b',
          lightGray: '#a1a1a6',
          text: '#f5f5f7',
          green: '#30d158',
          orange: '#ff9f0a',
          red: '#ff453a',
          purple: '#bf5af2',
        },
        brand: {
          cyan: '#2997ff',
          blue: '#0071e3',
          emerald: '#30d158',
          amber: '#ff9f0a',
          rose: '#ff453a',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'apple-card': '0 20px 40px -15px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'apple-button': '0 4px 14px 0 rgba(41, 151, 255, 0.35)',
        'apple-glow': '0 0 25px rgba(41, 151, 255, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
