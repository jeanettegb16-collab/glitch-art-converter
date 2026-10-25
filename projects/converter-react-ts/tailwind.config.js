/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#070700',
          bg2: '#040400',
          fg: '#39ff14',
          dim: 'rgba(57,255,20,0.35)',
        }
      },
      fontFamily: {
        mono: ["'VT323'", "'Courier New'", 'monospace'],
        ui: ["'Courier New'", 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
};
