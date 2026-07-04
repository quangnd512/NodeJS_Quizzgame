// Script kiem thu nhanh (smoke test) cho module "Leaderboard" (Bang xep hang).
// Kiem tra: tinh Diem Uy Tin, phan trang, xu huong (trend), loc mon hoc,
// getMyRank khi co du lieu va khi chua thi.
//
// Chay: npx tsx src/scripts/smoke-test-leaderboard.ts

import { prisma } from '../lib/prisma.js';
import { leaderboardService } from '../services/leaderboard/leaderboard.service.js';

const PREFIX = '[SMOKE-LB]';
const SUBJECT = 'TOAN';
const SUBJECT_OTHER = 'VAN';

// ID gia cho user test (khong can Firebase)
const USER_A = `${PREFIX}-user-a`;
const USER_B = `${PREFIX}-user-b`;
const USER_C = `${PREFIX}-user-c`;
const USER_NEW = `${PREFIX}-user-new`; // Chua thi lan nao

let testPaperId = '';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ THAT BAI: ${message}`);
  console.log(`  ✅ ${message}`);
}

// ---------------------------------------------------------------------------
// Cleanup truoc va sau khi chay
// ---------------------------------------------------------------------------

async function cleanup(): Promise<void> {
  const userIds = [USER_A, USER_B, USER_C, USER_NEW];

  // Xoa theo thu tu FK: answers -> sessions -> papers -> users
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
}

// ---------------------------------------------------------------------------
// Setup: tao user test + ExamSession gia
// ---------------------------------------------------------------------------

async function setup(): Promise<void> {
  // Tao ExamPaper gia de thoa man FK constraint
  const paper = await prisma.examPaper.create({
    data: { subject: SUBJECT, title: `${PREFIX} Paper`, durationMinutes: 90 },
  });
  testPaperId = paper.id;

  // Tao 3 user test + 1 user chua thi
  await prisma.user.createMany({
    data: [
      { id: USER_A, firebaseUid: `${PREFIX}-fb-a`, email: `${PREFIX}-a@test.com`, displayName: 'An Leaderboard' },
      { id: USER_B, firebaseUid: `${PREFIX}-fb-b`, email: `${PREFIX}-b@test.com`, displayName: 'Binh Leaderboard' },
      { id: USER_C, firebaseUid: `${PREFIX}-fb-c`, email: `${PREFIX}-c@test.com`, displayName: 'Chi Leaderboard' },
      { id: USER_NEW, firebaseUid: `${PREFIX}-fb-new`, email: `${PREFIX}-new@test.com`, displayName: 'New User' },
    ],
    skipDuplicates: true,
  });

  const now = new Date();
  const ago35d = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 ngay truoc

  // USER_A: 5 lan thi, diem cao, on dinh
  //   avg=9, stddev=0.5, n=5 -> Diem Uy Tin = (9 - 0.5*0.5) * (1 - 1/6) = 8.75 * 0.8333 = ~7.29
  // Thuc te PostgreSQL tinh chinh xac hon, day chi la uoc tinh

  const s = { examPaperId: testPaperId, durationMinutes: 90 };

  // USER_A: 5 lan thi (3 hien tai + 2 truoc 30 ngay)
  await prisma.examSession.createMany({
    data: [
      { ...s, userId: USER_A, status: 'COMPLETED', score: 9.0, subjectId: SUBJECT, completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      { ...s, userId: USER_A, status: 'COMPLETED', score: 8.5, subjectId: SUBJECT, completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      { ...s, userId: USER_A, status: 'COMPLETED', score: 9.5, subjectId: SUBJECT, completedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { ...s, userId: USER_A, status: 'COMPLETED', score: 9.0, subjectId: SUBJECT, completedAt: ago35d },
      { ...s, userId: USER_A, status: 'COMPLETED', score: 8.5, subjectId: SUBJECT, completedAt: new Date(ago35d.getTime() - 24 * 60 * 60 * 1000) },
    ],
  });

  // USER_B: 3 lan thi (tat ca trong 30 ngay gan day -> trend = "new")
  //   avg=7, stddev=1.0, n=3 -> Diem Uy Tin = (7 - 0.5*1.0) * (1 - 1/4) = 6.5 * 0.75 = ~4.875
  await prisma.examSession.createMany({
    data: [
      { ...s, userId: USER_B, status: 'COMPLETED', score: 8.0, subjectId: SUBJECT, completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      { ...s, userId: USER_B, status: 'COMPLETED', score: 6.0, subjectId: SUBJECT, completedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { ...s, userId: USER_B, status: 'COMPLETED', score: 7.0, subjectId: SUBJECT, completedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
    ],
  });

  // USER_C: 1 lan thi mon VAN (khong phai TOAN) -> khong xuat hien khi filter TOAN
  await prisma.examSession.createMany({
    data: [
      { ...s, userId: USER_C, status: 'COMPLETED', score: 8.0, subjectId: SUBJECT_OTHER, completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    ],
  });
}

// ---------------------------------------------------------------------------
// HAPPY PATH TESTS
// ---------------------------------------------------------------------------

async function testGetLeaderboard(): Promise<void> {
  console.log('\n--- [Happy Path] getLeaderboard khong filter mon hoc ---');

  const result = await leaderboardService.getLeaderboard(1);

  assert(result.page === 1, 'page = 1');
  assert(result.pageSize === 10, 'pageSize = 10');
  assert(result.total >= 3, `total >= 3 (got ${result.total})`);
  assert(result.data.length >= 2, `co it nhat 2 entry (got ${result.data.length})`);

  // User A va B deu co trong bang (thi mon TOAN), User C thi mon VAN nen van co
  const userIds = result.data.map((e) => e.userId);
  assert(userIds.includes(USER_A), 'USER_A co trong bang xep hang');
  assert(userIds.includes(USER_B), 'USER_B co trong bang xep hang');
  assert(userIds.includes(USER_C), 'USER_C (mon VAN) co trong bang xep hang (tat ca mon)');

  // Hang phai tang dan
  const ranks = result.data.map((e) => e.rank);
  for (let i = 1; i < ranks.length; i++) {
    assert(ranks[i]! > ranks[i - 1]!, `rank tang dan: ${ranks[i - 1]} < ${ranks[i]}`);
  }

  // Diem Uy Tin phai giam dan
  const scores = result.data.map((e) => e.reputationScore);
  for (let i = 1; i < scores.length; i++) {
    assert(scores[i]! <= scores[i - 1]!, `reputationScore giam dan: ${scores[i - 1]} >= ${scores[i]}`);
  }

  // User A phai o hang 1 (diem cao nhat)
  const entryA = result.data.find((e) => e.userId === USER_A);
  assert(entryA !== undefined, 'Tim thay entry cua USER_A');
  assert(entryA!.rank === 1, `USER_A o hang 1 (got ${entryA!.rank})`);
  assert(entryA!.examCount === 5, `USER_A co 5 lan thi (got ${entryA!.examCount})`);
  assert(entryA!.reputationScore > 0, `USER_A co reputationScore > 0`);
  assert(typeof entryA!.trend === 'string', 'trend la string');
}

async function testGetLeaderboardFilterSubject(): Promise<void> {
  console.log('\n--- [Happy Path] getLeaderboard loc theo mon hoc ---');

  const result = await leaderboardService.getLeaderboard(1, SUBJECT);

  assert(result.data.length >= 1, 'co it nhat 1 entry khi filter TOAN');
  assert(result.data.every((e) => e.userId !== USER_C), 'USER_C (chi thi VAN) khong xuat hien khi filter TOAN');
  assert(result.data.some((e) => e.userId === USER_A), 'USER_A (thi TOAN) xuat hien khi filter TOAN');
}

async function testGetMyRank_WithData(): Promise<void> {
  console.log('\n--- [Happy Path] getMyRank khi user da co du lieu ---');

  const myRank = await leaderboardService.getMyRank(USER_A);

  assert(myRank.rank !== null, 'rank khong null');
  assert(myRank.rank === 1, `USER_A o hang 1 so voi tat ca mon (got ${myRank.rank})`);
  assert(myRank.examCount === 5, `examCount = 5 (got ${myRank.examCount})`);
  assert(myRank.reputationScore !== null && myRank.reputationScore > 0, 'reputationScore > 0');
  assert(myRank.avgScore !== null && myRank.avgScore > 0, 'avgScore > 0');
  // USER_A co du lieu 30 ngay truoc -> trend khong phai 'new'
  assert(myRank.trend !== null && myRank.trend !== 'new', `trend co du lieu 30 ngay truoc: ${myRank.trend}`);
}

async function testGetMyRank_FilterSubject(): Promise<void> {
  console.log('\n--- [Happy Path] getMyRank voi filter mon hoc ---');

  const myRankToan = await leaderboardService.getMyRank(USER_A, SUBJECT);
  assert(myRankToan.rank !== null, 'USER_A co hang khi filter TOAN');

  // USER_C chi thi VAN, nen khi filter TOAN thi khong co hang
  const myRankToanC = await leaderboardService.getMyRank(USER_C, SUBJECT);
  assert(myRankToanC.rank === null, 'USER_C khong co hang khi filter TOAN');
  assert(myRankToanC.examCount === 0, 'USER_C examCount=0 khi filter TOAN');

  // USER_C co hang khi filter VAN
  const myRankVanC = await leaderboardService.getMyRank(USER_C, SUBJECT_OTHER);
  assert(myRankVanC.rank !== null, 'USER_C co hang khi filter VAN');
}

// ---------------------------------------------------------------------------
// EDGE CASE TESTS
// ---------------------------------------------------------------------------

async function testGetMyRank_NewUser(): Promise<void> {
  console.log('\n--- [Edge Case] getMyRank khi user chua thi lan nao ---');

  const myRank = await leaderboardService.getMyRank(USER_NEW);

  assert(myRank.rank === null, 'rank = null khi chua thi');
  assert(myRank.examCount === 0, 'examCount = 0');
  assert(myRank.reputationScore === null, 'reputationScore = null');
  assert(myRank.avgScore === null, 'avgScore = null');
  assert(myRank.trend === null, 'trend = null');
}

async function testGetMyRank_Trend_New(): Promise<void> {
  console.log('\n--- [Edge Case] Xu huong "new" khi user chua co du lieu 30 ngay truoc ---');

  // USER_B chi co session trong 30 ngay -> xu huong = "new"
  const myRank = await leaderboardService.getMyRank(USER_B);
  assert(myRank.rank !== null, 'USER_B co hang');
  assert(myRank.trend === 'new', `USER_B trend = "new" (got ${myRank.trend})`);
}

async function testGetLeaderboard_EmptySubject(): Promise<void> {
  console.log('\n--- [Edge Case] getLeaderboard voi mon hoc khong co nguoi thi ---');

  // HOA la mon khong co ai thi trong test data
  const result = await leaderboardService.getLeaderboard(1, 'HOA');
  assert(result.data.length === 0, 'Khong co entry khi mon hoc khong co nguoi thi');
  assert(result.total === 0, 'total = 0');
}

async function testPagination(): Promise<void> {
  console.log('\n--- [Edge Case] Phan trang ---');

  const page1 = await leaderboardService.getLeaderboard(1);
  assert(page1.page === 1, 'page 1 tra ve page = 1');

  const page2 = await leaderboardService.getLeaderboard(2);
  assert(page2.page === 2, 'page 2 tra ve page = 2');
  // Neu tong so nguoi <= PAGE_SIZE thi page 2 se rong
  if (page1.total <= 20) {
    assert(page2.data.length === 0, 'page 2 rong khi tong <= 20 nguoi');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== SMOKE TEST: Leaderboard (Bang xep hang) ===\n');

  console.log('[Setup] Dang don dep du lieu cu...');
  await cleanup();

  console.log('[Setup] Dang tao du lieu test...');
  await setup();

  let passed = 0;
  let failed = 0;

  const tests: Array<[string, () => Promise<void>]> = [
    ['getLeaderboard (tat ca mon)', testGetLeaderboard],
    ['getLeaderboard (filter mon hoc)', testGetLeaderboardFilterSubject],
    ['getMyRank (co du lieu)', testGetMyRank_WithData],
    ['getMyRank (filter mon hoc)', testGetMyRank_FilterSubject],
    ['getMyRank (chua thi)', testGetMyRank_NewUser],
    ['getMyRank (trend = new)', testGetMyRank_Trend_New],
    ['getLeaderboard (mon khong co nguoi thi)', testGetLeaderboard_EmptySubject],
    ['Phan trang', testPagination],
  ];

  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
    } catch (err) {
      failed++;
      console.error(`\n❌ TEST THAT BAI: "${name}"\n   ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\n[Cleanup] Dang xoa du lieu test...');
  await cleanup();
  await prisma.$disconnect();

  console.log(`\n=== KET QUA: ${passed} pass, ${failed} fail ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
