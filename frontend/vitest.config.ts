// Cau hinh chay TEST cho frontend (vitest). Chay bang: npm test
//
// De rieng khoi `vite.config.ts` vi `npm run build` chay `tsc` kiem tra vite.config.ts,
// ma kieu cua defineConfig tu 'vite' khong co truong `test` -> se bao loi TS2769.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // jsdom gia lap trinh duyet de test duoc component React
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
