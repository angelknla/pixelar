import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'coverage'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['app/**', 'components/**', 'hooks/**', 'utils/**', 'lib/**'],
      exclude: ['**/*.test.*'],
    },
  },
  resolve: {
    alias: {
      '@components': new URL('./components/', import.meta.url).pathname,
      '@hooks': new URL('./hooks/', import.meta.url).pathname,
      '@assets': new URL('./assets/', import.meta.url).pathname,
      '@contexts': new URL('./contexts/', import.meta.url).pathname,
      '@data': new URL('./data/', import.meta.url).pathname,
      '@utils': new URL('./utils/', import.meta.url).pathname,
      '@/lib': new URL('./lib/', import.meta.url).pathname,
      '@/types': new URL('./types/', import.meta.url).pathname,
      '@/app': new URL('./app/', import.meta.url).pathname,
      '@/styles': new URL('./styles/', import.meta.url).pathname,
    },
  },
});
