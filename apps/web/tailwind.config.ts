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
        background: '#f5f5f7',
        surface: '#ffffff',
        surfaceHover: '#f0f0f2',
        border: 'rgba(0, 0, 0, 0.08)',
        muted: '#6e6e73',
        apple: {
          canvas: '#f5f5f7',
          surface: '#ffffff',
          surfaceLight: '#fafafa',
          blue: '#0071e3',
          blueHover: '#0077ed',
          gray: '#6e6e73',
          lightGray: '#86868b',
          text: '#1d1d1f',
          green: '#34c759',
          orange: '#ff9500',
          red: '#ff3b30',
          purple: '#af52de',
        },
        brand: {
          cyan: '#0071e3',
          blue: '#0071e3',
          emerald: '#34c759',
          amber: '#ff9500',
          rose: '#ff3b30',
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
        'apple-card': '0 4px 24px -2px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'apple-button': '0 2px 8px 0 rgba(0, 113, 227, 0.3)',
        'apple-glow': '0 0 20px rgba(0, 113, 227, 0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
