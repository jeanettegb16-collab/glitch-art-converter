/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { 0: '#0a0a0f', 1: '#13131f', 2: '#1e1e2e', 3: '#2a2a3e' },
        accent: '#a78bfa',
        success: '#4ade80',
        danger: '#f87171',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
