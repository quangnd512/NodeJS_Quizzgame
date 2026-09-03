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
    coverage: {
      provider: 'v8',
      // 'json-summary' sinh ra coverage/coverage-summary.json — CI đọc file này
      // để hiện bảng % độ phủ trong tab Summary (xem .github/workflows/ci.yml).
      // 'text' để xem ngay trên terminal khi chạy tại máy.
      reporter: ['text', 'json-summary', 'html'],
      // Chỉ đo code nghiệp vụ, bỏ qua file cấu hình/khởi tạo và chính các file test
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/scripts/**',
        'src/index.ts',
      ],
    },
  },
  resolve: {
    // Cho phép import foo.js → resolve thành foo.ts khi chạy test
    extensions: ['.ts', '.js'],
  },
});
