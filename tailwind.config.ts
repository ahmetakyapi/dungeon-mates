import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        '3xl': '2560px',
        '4xl': '3840px',
      },
      colors: {
        dm: {
          bg: '#0a0e17',
          surface: '#111827',
          border: '#1f2937',
          accent: '#8b5cf6',
          gold: '#f59e0b',
          health: '#ef4444',
          mana: '#3b82f6',
          xp: '#10b981',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
