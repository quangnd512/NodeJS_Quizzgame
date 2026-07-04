// Script tao du lieu test cho UI leaderboard (khong tu xoa).
// Chay: npx tsx src/scripts/seed-leaderboard-ui.ts
// Xoa: npx tsx src/scripts/seed-leaderboard-ui.ts --cleanup

import { prisma } from '../lib/prisma.js';

const PREFIX = '[UI-LB]';
const SUBJECT = 'TOAN';

const USERS = [
  { id: `${PREFIX}-user-1`,  name: 'Nguyễn Minh An',    email: `${PREFIX}-1@test.com`,  fb: `${PREFIX}-fb-1`  },
  { id: `${PREFIX}-user-2`,  name: 'Trần Thị Bình',     email: `${PREFIX}-2@test.com`,  fb: `${PREFIX}-fb-2`  },
  { id: `${PREFIX}-user-3`,  name: 'Lê Văn Cường',      email: `${PREFIX}-3@test.com`,  fb: `${PREFIX}-fb-3`  },
  { id: `${PREFIX}-user-4`,  name: 'Phạm Thị Dung',     email: `${PREFIX}-4@test.com`,  fb: `${PREFIX}-fb-4`  },
  { id: `${PREFIX}-user-5`,  name: 'Hoàng Minh Đức',    email: `${PREFIX}-5@test.com`,  fb: `${PREFIX}-fb-5`  },
  { id: `${PREFIX}-user-6`,  name: 'Vũ Thị Fân',        email: `${PREFIX}-6@test.com`,  fb: `${PREFIX}-fb-6`  },
  { id: `${PREFIX}-user-7`,  name: 'Đặng Văn Giang',    email: `${PREFIX}-7@test.com`,  fb: `${PREFIX}-fb-7`  },
  { id: `${PREFIX}-user-8`,  name: 'Bùi Thị Hoa',       email: `${PREFIX}-8@test.com`,  fb: `${PREFIX}-fb-8`  },
  { id: `${PREFIX}-user-9`,  name: 'Ngô Văn Inh',       email: `${PREFIX}-9@test.com`,  fb: `${PREFIX}-fb-9`  },
  { id: `${PREFIX}-user-10`, name: 'Đinh Thị Kim',      email: `${PREFIX}-10@test.com`, fb: `${PREFIX}-fb-10` },
  { id: `${PREFIX}-user-11`, name: 'Lý Văn Long',       email: `${PREFIX}-11@test.com`, fb: `${PREFIX}-fb-11` },
  { id: `${PREFIX}-user-12`, name: 'Mai Thị My',        email: `${PREFIX}-12@test.com`, fb: `${PREFIX}-fb-12` },
  { id: `${PREFIX}-user-13`, name: 'Trịnh Văn Nam',     email: `${PREFIX}-13@test.com`, fb: `${PREFIX}-fb-13` },
  { id: `${PREFIX}-user-14`, name: 'Cao Thị Oanh',      email: `${PREFIX}-14@test.com`, fb: `${PREFIX}-fb-14` },
  { id: `${PREFIX}-user-15`, name: 'Phan Văn Phong',    email: `${PREFIX}-15@test.com`, fb: `${PREFIX}-fb-15` },
  { id: `${PREFIX}-user-16`, name: 'Dương Thị Quỳnh',   email: `${PREFIX}-16@test.com`, fb: `${PREFIX}-fb-16` },
  { id: `${PREFIX}-user-17`, name: 'Hồ Văn Rạng',      email: `${PREFIX}-17@test.com`, fb: `${PREFIX}-fb-17` },
  { id: `${PREFIX}-user-18`, name: 'Tô Thị Sen',        email: `${PREFIX}-18@test.com`, fb: `${PREFIX}-fb-18` },
  { id: `${PREFIX}-user-19`, name: 'Châu Văn Tùng',     email: `${PREFIX}-19@test.com`, fb: `${PREFIX}-fb-19` },
  { id: `${PREFIX}-user-20`, name: 'Kiều Thị Uyên',     email: `${PREFIX}-20@test.com`, fb: `${PREFIX}-fb-20` },
  { id: `${PREFIX}-user-21`, name: 'Dư Văn Vinh',       email: `${PREFIX}-21@test.com`, fb: `${PREFIX}-fb-21` },
  { id: `${PREFIX}-user-22`, name: 'Âu Thị Xuân',       email: `${PREFIX}-22@test.com`, fb: `${PREFIX}-fb-22` },
  { id: `${PREFIX}-user-23`, name: 'Liêu Văn Yên',      email: `${PREFIX}-23@test.com`, fb: `${PREFIX}-fb-23` },
  { id: `${PREFIX}-user-24`, name: 'Mạc Thị Zung',      email: `${PREFIX}-24@test.com`, fb: `${PREFIX}-fb-24` },
  { id: `${PREFIX}-user-25`, name: 'Quách Văn Anh',     email: `${PREFIX}-25@test.com`, fb: `${PREFIX}-fb-25` },
];

async function cleanup() {
  const userIds = USERS.map((u) => u.id);
  const sessions = await prisma.examSession.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  await prisma.examAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.examSession.deleteMany({ where: { id: { in: sessionIds } } });
  await prisma.examPaper.deleteMany({ where: { title: { startsWith: PREFIX } } });
  await prisma.pointTransaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userPoints.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log('✅ Đã xóa toàn bộ dữ liệu seed leaderboard UI.');
}

async function seed() {
  await cleanup(); // reset truoc khi seed

  // Tao ExamPaper gia
  const paper = await prisma.examPaper.create({
    data: { subject: SUBJECT, title: `${PREFIX} Paper`, durationMinutes: 90 },
  });

  // Tao users
  await prisma.user.createMany({
    data: USERS.map((u) => ({
      id: u.id,
      firebaseUid: u.fb,
      email: u.email,
      displayName: u.name,
    })),
    skipDuplicates: true,
  });

  const now = new Date();
  const d = (days: number) => new Date(now.getTime() - days * 86400_000);
  const s = { examPaperId: paper.id, durationMinutes: 90, subjectId: SUBJECT, status: 'COMPLETED' as const };

  // User 1: rank 1 — 8 lan thi, diem cao on dinh (~8.5)
  await prisma.examSession.createMany({ data: [
    { ...s, userId: USERS[0].id, score: 9.0, completedAt: d(1) },
    { ...s, userId: USERS[0].id, score: 8.5, completedAt: d(3) },
    { ...s, userId: USERS[0].id, score: 9.5, completedAt: d(7) },
    { ...s, userId: USERS[0].id, score: 8.0, completedAt: d(10) },
    { ...s, userId: USERS[0].id, score: 9.0, completedAt: d(35) },
    { ...s, userId: USERS[0].id, score: 8.5, completedAt: d(40) },
    { ...s, userId: USERS[0].id, score: 9.0, completedAt: d(50) },
    { ...s, userId: USERS[0].id, score: 8.0, completedAt: d(60) },
  ]});

  // User 2: rank 2 — 5 lan thi, diem kha (~7.5)
  await prisma.examSession.createMany({ data: [
    { ...s, userId: USERS[1].id, score: 8.0, completedAt: d(2) },
    { ...s, userId: USERS[1].id, score: 7.5, completedAt: d(5) },
    { ...s, userId: USERS[1].id, score: 7.0, completedAt: d(15) },
    { ...s, userId: USERS[1].id, score: 8.0, completedAt: d(36) },
    { ...s, userId: USERS[1].id, score: 7.5, completedAt: d(45) },
  ]});

  // User 3: rank 3 — 4 lan thi, diem trung binh (~6.5)
  await prisma.examSession.createMany({ data: [
    { ...s, userId: USERS[2].id, score: 7.0, completedAt: d(1) },
    { ...s, userId: USERS[2].id, score: 6.0, completedAt: d(8) },
    { ...s, userId: USERS[2].id, score: 6.5, completedAt: d(38) },
    { ...s, userId: USERS[2].id, score: 7.0, completedAt: d(50) },
  ]});

  // User 4: rank 4 — 3 lan thi, moi thi trong 30 ngay (trend=new)
  await prisma.examSession.createMany({ data: [
    { ...s, userId: USERS[3].id, score: 6.0, completedAt: d(2) },
    { ...s, userId: USERS[3].id, score: 5.5, completedAt: d(10) },
    { ...s, userId: USERS[3].id, score: 6.5, completedAt: d(20) },
  ]});

  // User 5: rank 5 — 2 lan thi, diem thap (~4.0)
  await prisma.examSession.createMany({ data: [
    { ...s, userId: USERS[4].id, score: 4.0, completedAt: d(5) },
    { ...s, userId: USERS[4].id, score: 4.5, completedAt: d(40) },
  ]});

  // User 6-25: moi user 1 lan thi, diem giam dan tu 3.8 xuong 1.0
  for (let i = 5; i < USERS.length; i++) {
    const score = Math.max(1.0, 3.8 - (i - 5) * 0.15);
    await prisma.examSession.create({ data: {
      ...s, userId: USERS[i].id, score: parseFloat(score.toFixed(1)), completedAt: d(i * 2),
    }});
  }

  console.log(`✅ Đã tạo ${USERS.length} user test với ExamSession cho Leaderboard UI.`);
  console.log('\nXóa dữ liệu sau khi test xong:');
  console.log('  npx tsx src/scripts/seed-leaderboard-ui.ts --cleanup');
}

async function main() {
  const isCleanup = process.argv.includes('--cleanup');
  if (isCleanup) {
    await cleanup();
  } else {
    await seed();
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
