import { defineConfig } from 'vite';

export default defineConfig({
  base: '/glitch-art-converter/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
