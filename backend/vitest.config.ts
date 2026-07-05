import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Resolve .js extension imports (TypeScript ESM pattern)
    alias: {
      // Không cần alias đặc biệt — vitest tự resolve .js → .ts
    },
  },
  resolve: {
    // Cho phép import foo.js → resolve thành foo.ts khi chạy test
    extensions: ['.ts', '.js'],
  },
});
