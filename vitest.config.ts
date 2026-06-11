import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./__tests__/setup.ts'],
    // e2e/ は Playwright (npm run test:e2e) 専用。vitest が拾うと dev サーバー不在で落ちる
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
