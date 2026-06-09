// Khoi tao Redis client (ioredis) dung chung cho toan bo backend.
// Hien tai dung cho rate limiting (practice session) va co the mo rong
// cho cache, pub/sub, leaderboard sau nay.
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  // Khong nem loi fatal khi mat ket noi — backend van hoat dong, chi mat rate limit.
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

redis.on('error', (err: Error) => {
  // Log nhung khong crash — rate limit la tinh nang "nice to have", khong phai critical.
  console.warn('[Redis] Loi ket noi Redis (rate limit se bi bo qua):', err.message);
});
