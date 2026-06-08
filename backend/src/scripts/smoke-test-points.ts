// Script kiem thu nhanh (smoke test) cho PointsService - chay truc tiep voi DB that.
// KHONG phai unit test chinh thuc (se duoc viet bang Vitest/Jest sau), chi dung de
// xac nhan cac luong chinh hoat dong dung truoc khi merge.
//
// Chay: npx tsx src/scripts/smoke-test-points.ts

import { prisma } from '../lib/prisma.js';
import { PointsService } from '../services/points/points.service.js';
import {
  InvalidPointsAmountError,
  PointsInsufficientError,
} from '../services/points/points.errors.js';
import { PointReason } from '../services/points/points.types.js';

const service = new PointsService();

const USER_A = 'smoke-test-user-a';
const USER_B = 'smoke-test-user-b';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ THAT BAI: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function cleanup(): Promise<void> {
  await prisma.pointTransaction.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  await prisma.userPoints.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
}

async function main(): Promise<void> {
  console.log('--- Don dep du lieu test cu (neu co) ---');
  await cleanup();

  console.log('\n--- 1. addPoints: cong diem cho user moi ---');
  const afterAdd = await service.addPoints(USER_A, 10, PointReason.ON_TAP_CORRECT);
  assert(afterAdd.currentPoints === 10, `So du sau khi cong 10 diem phai la 10 (thuc te: ${afterAdd.currentPoints})`);

  console.log('\n--- 2. deductPoints: tru diem hop le ---');
  const afterDeduct = await service.deductPoints(USER_A, 4, PointReason.THI_THU_ENTRY_FEE);
  assert(afterDeduct.currentPoints === 6, `So du sau khi tru 4 diem phai la 6 (thuc te: ${afterDeduct.currentPoints})`);

  console.log('\n--- 3. deductPoints: tru qua so du -> phai nem PointsInsufficientError ---');
  try {
    await service.deductPoints(USER_A, 100, PointReason.THI_THU_ENTRY_FEE);
    assert(false, 'Phai nem loi PointsInsufficientError nhung khong thay');
  } catch (err) {
    assert(err instanceof PointsInsufficientError, `Loi nem ra phai la PointsInsufficientError (thuc te: ${(err as Error).constructor.name})`);
  }

  console.log('\n--- 4. addPoints: tu choi amount khong hop le (so am / so 0) ---');
  for (const invalidAmount of [0, -5, 1.5]) {
    try {
      await service.addPoints(USER_A, invalidAmount, PointReason.ON_TAP_CORRECT);
      assert(false, `Phai nem loi voi amount = ${invalidAmount}`);
    } catch (err) {
      assert(err instanceof InvalidPointsAmountError, `amount = ${invalidAmount} phai nem InvalidPointsAmountError`);
    }
  }

  console.log('\n--- 5. transferPoints: chuyen diem giua 2 user (atomic) ---');
  await service.addPoints(USER_B, 5, PointReason.ON_TAP_CORRECT);
  const transferResult = await service.transferPoints(USER_A, USER_B, 6, PointReason.PVP_WIN);
  assert(transferResult.fromBalanceAfter === 0, `Nguoi gui phai con 0 diem (thuc te: ${transferResult.fromBalanceAfter})`);
  assert(transferResult.toBalanceAfter === 11, `Nguoi nhan phai co 11 diem (thuc te: ${transferResult.toBalanceAfter})`);

  console.log('\n--- 6. transferPoints: nguoi gui khong du diem -> phai nem loi va KHONG thay doi so du ---');
  try {
    await service.transferPoints(USER_A, USER_B, 50, PointReason.PVP_WIN);
    assert(false, 'Phai nem loi PointsInsufficientError nhung khong thay');
  } catch (err) {
    assert(err instanceof PointsInsufficientError, 'Phai nem PointsInsufficientError khi nguoi gui khong du diem');
  }
  const balanceAfterFailedTransfer = await service.getBalance(USER_A);
  assert(balanceAfterFailedTransfer.currentPoints === 0, 'So du nguoi gui KHONG duoc thay doi sau giao dich that bai (van la 0)');

  console.log('\n--- 7. getBalance: user chua tung giao dich -> tra ve 0 ---');
  const neverExisted = await service.getBalance('user-chua-bao-gio-ton-tai');
  assert(neverExisted.currentPoints === 0, 'User chua ton tai phai co so du = 0');

  console.log('\n--- 8. getHistory: kiem tra phan trang va thu tu (moi nhat truoc) ---');
  const history = await service.getHistory(USER_A, 2, 0);
  assert(history.items.length === 2, `Phai tra ve dung 2 ban ghi (limit=2) (thuc te: ${history.items.length})`);
  // USER_A co dung 3 giao dich thanh cong: +10 (addPoints), -4 (deductPoints), -6 (transferPoints).
  // Cac lan thu that bai (deductPoints qua tay, transferPoints khong du diem) KHONG ghi log,
  // dung nhu thiet ke "chi ghi log khi giao dich thuc su xay ra".
  assert(history.total === 3, `Tong so giao dich cua USER_A phai la 3 (thuc te: ${history.total})`);
  assert(
    history.items[0].createdAt.getTime() >= history.items[1].createdAt.getTime(),
    'Lich su phai duoc sap xep moi nhat truoc (createdAt giam dan)',
  );

  console.log('\n--- 9. Khong bao gio de diem am: kiem tra truc tiep trong DB ---');
  const rawA = await prisma.userPoints.findUnique({ where: { userId: USER_A } });
  const rawB = await prisma.userPoints.findUnique({ where: { userId: USER_B } });
  assert(!!rawA && rawA.currentPoints >= 0, 'Diem cua USER_A trong DB khong duoc am');
  assert(!!rawB && rawB.currentPoints >= 0, 'Diem cua USER_B trong DB khong duoc am');

  console.log('\n--- Don dep du lieu test ---');
  await cleanup();

  console.log('\n🎉 TAT CA KIEM TRA DEU PASS!');
}

main()
  .catch((err) => {
    console.error('\n💥 SMOKE TEST THAT BAI:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
