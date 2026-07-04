// Script kiem thu nhanh (smoke test) cho module "Progress" (Tien do hoc tap).
// Kiem tra: getSummary, getExamHistory, streak, so sanh thang, bieu do xu huong.
//
// Chay: npx tsx src/scripts/smoke-test-progress.ts

import { prisma } from '../lib/prisma.js';
import { progressService } from '../services/progress/progress.service.js';

const PREFIX = '[SMOKE-PROG]';
const SUBJECT = 'TOAN';
const USER_A  = `${PREFIX}-user-a`;  // User co du lieu
const USER_B  = `${PREFIX}-user-b`;  // User chua co du lieu nao

let testPaperId = '';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ THAT BAI: ${message}`);
  console.log(`  ✅ ${message}`);
}

// ---------------------------------------------------------------------------
// Cleanup truoc va sau khi chay
// ---------------------------------------------------------------------------

async function cleanup(): Promise<void> {
  const userIds = [USER_A, USER_B];

  const practiceSessions = await prisma.practiceSession.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const practiceSessionIds = practiceSessions.map((s) => s.id);
  await prisma.practiceAnswer.deleteMany({ where: { sessionId: { in: practiceSessionIds } } });
  await prisma.practiceSession.deleteMany({ where: { id: { in: practiceSessionIds } } });

  const examSessions = await prisma.examSession.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const examSessionIds = examSessions.map((s) => s.id);
  await prisma.examAnswer.deleteMany({ where: { sessionId: { in: examSessionIds } } });
  await prisma.examSession.deleteMany({ where: { id: { in: examSessionIds } } });

  await prisma.examPaper.deleteMany({ where: { title: { startsWith: PREFIX } } });
  await prisma.pointTransaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userPoints.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ---------------------------------------------------------------------------
// Setup: tao user + du lieu gia
// ---------------------------------------------------------------------------

async function setup(): Promise<void> {
  const paper = await prisma.examPaper.create({
    data: { subject: SUBJECT, title: `${PREFIX} Paper`, durationMinutes: 90 },
  });
  testPaperId = paper.id;

  await prisma.user.createMany({
    data: [
      { id: USER_A, firebaseUid: `${PREFIX}-uid-a`, email: 'a@prog.test' },
      { id: USER_B, firebaseUid: `${PREFIX}-uid-b`, email: 'b@prog.test' },
    ],
  });

  // Tao 3 phien on tap da hoan thanh cho USER_A (hom nay, hom qua, 2 ngay truoc)
  const daysAgo = (n: number): Date => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(10, 0, 0, 0);
    return d;
  };

  await prisma.practiceSession.createMany({
    data: [
      { userId: USER_A, subjectId: SUBJECT, questions: [], score: 10, pointsEarned: 10, completedAt: daysAgo(0) },
      { userId: USER_A, subjectId: SUBJECT, questions: [], score: 12, pointsEarned: 12, completedAt: daysAgo(1) },
      { userId: USER_A, subjectId: SUBJECT, questions: [], score: 8,  pointsEarned: 8,  completedAt: daysAgo(2) },
    ],
  });

  // Tao 2 phien thi thu da hoan thanh cho USER_A
  await prisma.examSession.createMany({
    data: [
      {
        userId: USER_A, examPaperId: testPaperId, subjectId: SUBJECT,
        durationMinutes: 90, status: 'COMPLETED', score: 7.5, pointsAwarded: 20,
        completedAt: daysAgo(1),
      },
      {
        userId: USER_A, examPaperId: testPaperId, subjectId: SUBJECT,
        durationMinutes: 90, status: 'COMPLETED', score: 8.0, pointsAwarded: 25,
        completedAt: daysAgo(0),
      },
    ],
  });

  // Tao diem tich luy cho USER_A
  await prisma.userPoints.create({
    data: { userId: USER_A, currentPoints: 500, version: 1 },
  });
}

// ---------------------------------------------------------------------------
// Test 1: getSummary — user co du lieu
// ---------------------------------------------------------------------------

async function testGetSummaryWithData(): Promise<void> {
  console.log('\n[T1] getSummary — user co du lieu...');

  const summary = await progressService.getSummary(USER_A);

  // Tong quan
  assert(summary.overview.totalPracticeSessions === 3, 'totalPracticeSessions = 3');
  assert(summary.overview.totalExamSessions === 2, 'totalExamSessions = 2');
  assert(summary.overview.currentPoints === 500, 'currentPoints = 500');
  assert(summary.overview.currentStreak >= 3, `currentStreak >= 3 (got ${summary.overview.currentStreak})`);
  assert(summary.bestStreak >= 3, `bestStreak >= 3 (got ${summary.bestStreak})`);

  // So sanh thang (thang nay co du lieu)
  assert(summary.monthComparison.thisMonth.practiceSessions >= 1, 'thisMonth.practiceSessions >= 1');

  // Bieu do xu huong
  assert(Array.isArray(summary.scoreTrend), 'scoreTrend la mang');
  assert(summary.scoreTrend.length >= 1, 'scoreTrend co it nhat 1 diem');
  assert(typeof summary.scoreTrend[0]!.score === 'number', 'scoreTrend[0].score la so');
  assert(typeof summary.scoreTrend[0]!.date === 'string', 'scoreTrend[0].date la chuoi ISO');

  // Thong ke theo mon
  assert(Array.isArray(summary.practiceStatsBySubject), 'practiceStatsBySubject la mang');
}

// ---------------------------------------------------------------------------
// Test 2: getSummary — user chua co du lieu
// ---------------------------------------------------------------------------

async function testGetSummaryEmpty(): Promise<void> {
  console.log('\n[T2] getSummary — user chua co du lieu (empty state)...');

  const summary = await progressService.getSummary(USER_B);

  assert(summary.overview.totalPracticeSessions === 0, 'totalPracticeSessions = 0');
  assert(summary.overview.totalExamSessions === 0, 'totalExamSessions = 0');
  assert(summary.overview.currentPoints === 0, 'currentPoints = 0');
  assert(summary.overview.currentStreak === 0, 'currentStreak = 0');
  assert(summary.bestStreak === 0, 'bestStreak = 0');
  assert(summary.monthComparison.thisMonth.practiceSessions === 0, 'thisMonth.practiceSessions = 0');
  assert(summary.monthComparison.thisMonth.examAvgScore === null, 'thisMonth.examAvgScore = null');
  assert(summary.monthComparison.lastMonth.examAvgScore === null, 'lastMonth.examAvgScore = null');
  assert(summary.scoreTrend.length === 0, 'scoreTrend rong');
  assert(summary.practiceStatsBySubject.length === 0, 'practiceStatsBySubject rong');
}

// ---------------------------------------------------------------------------
// Test 3: getExamHistory — phan trang
// ---------------------------------------------------------------------------

async function testGetExamHistory(): Promise<void> {
  console.log('\n[T3] getExamHistory — phan trang...');

  // Happy path: lay toan bo (limit=10)
  const page1 = await progressService.getExamHistory(USER_A, 10, 0);
  assert(page1.total === 2, `total = 2 (got ${page1.total})`);
  assert(page1.items.length === 2, 'items.length = 2');
  assert(page1.limit === 10, 'limit = 10');
  assert(page1.offset === 0, 'offset = 0');
  assert(typeof page1.items[0]!.title === 'string', 'item.title la chuoi');
  assert(typeof page1.items[0]!.score === 'number', 'item.score la so');

  // Edge case: offset vuot qua tong so ban ghi
  const beyond = await progressService.getExamHistory(USER_A, 10, 999);
  assert(beyond.items.length === 0, 'offset qua lon -> items rong');
  assert(beyond.total === 2, 'total van la 2 du offset lon');

  // Edge case: limit ngoai pham vi duoc clamp
  const clamped = await progressService.getExamHistory(USER_A, 200, 0); // limit > 50
  assert(clamped.limit === 50, `limit bi clamp xuong 50 (got ${clamped.limit})`);

  // Edge case: user chua thi lan nao
  const empty = await progressService.getExamHistory(USER_B, 10, 0);
  assert(empty.total === 0, 'user B: total = 0');
  assert(empty.items.length === 0, 'user B: items rong');
}

// ---------------------------------------------------------------------------
// Test 4: streak — chuoi lien tiep 3 ngay
// ---------------------------------------------------------------------------

async function testStreak(): Promise<void> {
  console.log('\n[T4] streak — xac nhan streak lien tiep...');

  const summary = await progressService.getSummary(USER_A);

  // Setup da tao 3 ngay lien tiep (hom nay, hom qua, 2 ngay truoc)
  assert(summary.overview.currentStreak >= 3, `currentStreak >= 3 (actual: ${summary.overview.currentStreak})`);
  assert(summary.bestStreak >= summary.overview.currentStreak, 'bestStreak >= currentStreak');
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SMOKE TEST: Progress (Tien do hoc tap)');
  console.log('='.repeat(60));

  try {
    console.log('\n[SETUP] Dang don dep va tao du lieu test...');
    await cleanup();
    await setup();
    console.log('  ✅ Setup hoan tat');

    await testGetSummaryWithData();
    await testGetSummaryEmpty();
    await testGetExamHistory();
    await testStreak();

    console.log('\n' + '='.repeat(60));
    console.log('✅ TAT CA 4 TEST PASS — Progress module OK');
    console.log('='.repeat(60) + '\n');
  } finally {
    console.log('\n[CLEANUP] Dang xoa du lieu test...');
    await cleanup();
    console.log('  ✅ Cleanup hoan tat');
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ LOI KHONG XU LY DUOC:', err);
  process.exit(1);
});
