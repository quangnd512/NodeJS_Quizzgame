// Kiem tra OPTIMISTIC LOCKING: ban song song nhieu giao dich cong diem cho
// CUNG MOT user, ki vong tong so du cuoi cung phai CHINH XAC bang tong cac
// khoan da cong - khong bi "mat" giao dich nao do race condition.
//
// Day la kich ban de gay loi nhat trong thuc te: vi du 1 hoc sinh vua hoan
// thanh On tap (+1 diem/cau, ban song song) vua nhan thuong rewarded-video.
//
// Chay: npx tsx src/scripts/smoke-test-points-concurrency.ts

import { prisma } from '../lib/prisma.js';
import { PointsService } from '../services/points/points.service.js';
import { PointReason } from '../services/points/points.types.js';

const service = new PointsService();
const USER = 'smoke-test-concurrency-user';
const CONCURRENT_REQUESTS = 20;
const AMOUNT_PER_REQUEST = 1;

async function cleanup(): Promise<void> {
  await prisma.pointTransaction.deleteMany({ where: { userId: USER } });
  await prisma.userPoints.deleteMany({ where: { userId: USER } });
}

async function main(): Promise<void> {
  await cleanup();

  console.log(`Ban song song ${CONCURRENT_REQUESTS} request addPoints(+${AMOUNT_PER_REQUEST}) cho cung 1 user...`);

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
      service.addPoints(USER, AMOUNT_PER_REQUEST, PointReason.ON_TAP_CORRECT, { requestIndex: i }),
    ),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected');

  console.log(`-> Thanh cong: ${succeeded}/${CONCURRENT_REQUESTS}, that bai: ${failed.length}`);
  failed.forEach((f) => {
    if (f.status === 'rejected') console.error('   Loi:', f.reason);
  });

  const finalBalance = await service.getBalance(USER);
  const expected = CONCURRENT_REQUESTS * AMOUNT_PER_REQUEST;

  console.log(`So du cuoi cung: ${finalBalance.currentPoints} (ki vong: ${expected})`);

  const history = await service.getHistory(USER, 100, 0);
  console.log(`So dong log da ghi: ${history.total} (ki vong: ${expected})`);

  if (finalBalance.currentPoints !== expected) {
    throw new Error(
      `❌ THAT BAI: So du cuoi cung (${finalBalance.currentPoints}) khong khop tong da cong (${expected}). ` +
        `Co the dang xay ra LOST UPDATE - optimistic locking chua hoat dong dung!`,
    );
  }

  if (history.total !== expected) {
    throw new Error(
      `❌ THAT BAI: So dong log (${history.total}) khong khop so giao dich thanh cong (${expected}).`,
    );
  }

  console.log('✅ Khong co giao dich nao bi "mat" - optimistic locking hoat dong chinh xac!');

  await cleanup();
  console.log('🎉 KIEM TRA CONCURRENCY PASS!');
}

main()
  .catch((err) => {
    console.error('\n💥 SMOKE TEST CONCURRENCY THAT BAI:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
