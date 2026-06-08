// Kiem tra race condition CHO RIENG transferPoints - tinh huong sat voi
// thuc te nhat trong GDD: "Thi dau PvP - Winner takes all" (chuyen diem cuoc
// giua 2 nguoi choi ngay khi tran dau ket thuc).
//
// Kich ban: ban song song NHIEU giao dich chuyen diem giua A và B theo
// CA HAI CHIEU cung luc (A->B va B->A xen ke) - day la tinh huong de gay
// deadlock nhat neu khong khoa ban ghi theo thu tu co dinh.
//
// Ki vong:
//   - Khong co giao dich nao bi mat / nhan doi (tong diem A + B luon khong doi).
//   - Khong co deadlock (tat ca request deu ket thuc, khong bi "treo").
//   - Khong bao gio co so du am.
//
// Chay: npx tsx src/scripts/smoke-test-points-transfer-race.ts

import { prisma } from '../lib/prisma.js';
import { PointsService } from '../services/points/points.service.js';
import { PointsInsufficientError } from '../services/points/points.errors.js';
import { PointReason } from '../services/points/points.types.js';

const service = new PointsService();
const USER_A = 'smoke-test-race-user-a';
const USER_B = 'smoke-test-race-user-b';

const STARTING_BALANCE = 100;
const TRANSFER_AMOUNT = 10;
const ROUNDS = 15; // Moi vong ban 1 giao dich A->B va 1 giao dich B->A song song

async function cleanup(): Promise<void> {
  await prisma.pointTransaction.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  await prisma.userPoints.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
}

async function main(): Promise<void> {
  await cleanup();

  console.log(`Khoi tao so du ban dau: ${USER_A} va ${USER_B} deu co ${STARTING_BALANCE} diem.`);
  await service.addPoints(USER_A, STARTING_BALANCE, PointReason.ADMIN_ADJUSTMENT);
  await service.addPoints(USER_B, STARTING_BALANCE, PointReason.ADMIN_ADJUSTMENT);

  const totalBefore =
    (await service.getBalance(USER_A)).currentPoints + (await service.getBalance(USER_B)).currentPoints;

  console.log(
    `\nBan song song ${ROUNDS * 2} giao dich chuyen diem (${ROUNDS} vong, moi vong ca 2 chieu A<->B)...`,
  );

  const startedAt = Date.now();

  const tasks: Promise<unknown>[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    tasks.push(
      service.transferPoints(USER_A, USER_B, TRANSFER_AMOUNT, PointReason.PVP_WIN, { round, direction: 'A_TO_B' }),
    );
    tasks.push(
      service.transferPoints(USER_B, USER_A, TRANSFER_AMOUNT, PointReason.PVP_WIN, { round, direction: 'B_TO_A' }),
    );
  }

  const results = await Promise.allSettled(tasks);
  const elapsedMs = Date.now() - startedAt;

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const insufficientFailures = results.filter(
    (r) => r.status === 'rejected' && r.reason instanceof PointsInsufficientError,
  ).length;
  const unexpectedFailures = results.filter(
    (r) => r.status === 'rejected' && !(r.reason instanceof PointsInsufficientError),
  );

  console.log(`-> Hoan tat trong ${elapsedMs}ms (khong bi "treo" -> KHONG co deadlock).`);
  console.log(`-> Thanh cong: ${succeeded}/${tasks.length}`);
  console.log(`-> That bai do khong du diem (hop le, co the xay ra do thu tu thuc thi): ${insufficientFailures}`);
  console.log(`-> That bai KHONG mong muon: ${unexpectedFailures.length}`);
  unexpectedFailures.forEach((f) => {
    if (f.status === 'rejected') console.error('   Loi khong mong muon:', f.reason);
  });

  if (unexpectedFailures.length > 0) {
    throw new Error('❌ THAT BAI: Co loi khong mong muon xay ra (khong phai PointsInsufficientError).');
  }

  const balanceA = await service.getBalance(USER_A);
  const balanceB = await service.getBalance(USER_B);
  const totalAfter = balanceA.currentPoints + balanceB.currentPoints;

  console.log(`\nSo du cuoi cung: ${USER_A} = ${balanceA.currentPoints}, ${USER_B} = ${balanceB.currentPoints}`);
  console.log(`Tong diem truoc: ${totalBefore}, sau: ${totalAfter}`);

  if (totalAfter !== totalBefore) {
    throw new Error(
      `❌ THAT BAI: Tong diem thay doi sau khi chuyen (truoc=${totalBefore}, sau=${totalAfter}). ` +
        `Co diem bi "sinh ra" hoac "bien mat" - vi pham nguyen tac bao toan!`,
    );
  }
  console.log('✅ Tong diem duoc bao toan tuyet doi (khong sinh ra / mat di diem nao).');

  if (balanceA.currentPoints < 0 || balanceB.currentPoints < 0) {
    throw new Error('❌ THAT BAI: Phat hien so du am!');
  }
  console.log('✅ Khong user nao co so du am.');

  await cleanup();
  console.log('\n🎉 KIEM TRA RACE CONDITION CHO transferPoints PASS!');
}

main()
  .catch((err) => {
    console.error('\n💥 SMOKE TEST TRANSFER RACE THAT BAI:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
