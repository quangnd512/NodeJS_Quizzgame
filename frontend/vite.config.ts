/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Cau hinh chay test (vitest). Chay bang: npm test
  test: {
    globals: true,
    // jsdom gia lap trinh duyet de test duoc component React
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    // Lang nghe ca IPv4 (127.0.0.1) lan IPv6 (::1) - mac dinh Vite chi bind
    // "localhost" (co the chi phan giai IPv6 tren mot so may), khien trinh
    // duyet/OS uu tien IPv4 khong ket noi duoc ("khong vao duoc").
    host: true,
    // Proxy cac request /api sang backend Express de tranh loi CORS khi dev
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Proxy ket noi Socket.io (Feature 016 - Thi dau doi khang) - can `ws: true`
      // de proxy dung ca WebSocket upgrade, khong chi HTTP polling ban dau.
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
