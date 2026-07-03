// Kiem tra RACE CONDITION cho module Thi thu (Exam):
//   A. startExam: nhieu request CUNG LUC cho 1 user chi du diem cho DUNG 1 lan
//      thi -> ki vong CHI 1 thanh cong (tru diem dung 1 lan), cac request con
//      lai nhan ExamInsufficientPointsError (KHONG bi 500 do P2002/optimistic
//      lock retry "vo tinh" thanh cong nhieu lan).
//   B. submitExam: nhieu request CUNG LUC nop CUNG 1 phien, diem < 7.0
//      (pointsAwarded = 0, khong di qua optimistic lock cua PointsService) ->
//      ki vong CHI 1 thanh cong, cac request con lai nhan
//      ExamSessionAlreadyCompletedError - khong duoc ca 2 deu tra ve 200.
//   C. submitExam: tuong tu B nhung diem >= 7.0 (pointsAwarded > 0, CO di qua
//      optimistic lock cua PointsService) -> ki vong CHI 1 thanh cong va CHI
//      1 lan duoc thuong diem (khong cong diem thuong 2 lan).
//
// Chay: npx tsx src/scripts/smoke-test-exam-concurrency.ts

import { prisma } from '../lib/prisma.js';
import { examService } from '../services/exam/exam.service.js';
import { ExamInsufficientPointsError, ExamSessionAlreadyCompletedError } from '../services/exam/exam.errors.js';
import { EXAM_ENTRY_FEE } from '../services/exam/exam.types.js';
import { pointsService } from '../services/points/points.service.js';

const TITLE_PREFIX = '[SMOKE TEST CONCURRENCY]';
const SUBJECT = 'HOA'; // Mon hoc chua co de active nao trong DB -> chon de deterministic.
const CONCURRENT_REQUESTS = 5;

const USER_A = 'smoke-test-exam-concurrency-user-a';
const USER_B = 'smoke-test-exam-concurrency-user-b';
const USER_C = 'smoke-test-exam-concurrency-user-c';
const ALL_USERS = [USER_A, USER_B, USER_C];

let paperId = '';
let questionId = '';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ THAT BAI: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function cleanup(): Promise<void> {
  const papers = await prisma.examPaper.findMany({
    where: { title: { startsWith: TITLE_PREFIX } },
    select: { id: true },
  });
  const paperIds = papers.map((p) => p.id);

  const sessions = await prisma.examSession.findMany({
    where: { OR: [{ examPaperId: { in: paperIds } }, { userId: { in: ALL_USERS } }] },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  await prisma.examAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.examSession.deleteMany({ where: { id: { in: sessionIds } } });
  await prisma.examQuestion.deleteMany({ where: { examPaperId: { in: paperIds } } });
  await prisma.examPaper.deleteMany({ where: { id: { in: paperIds } } });
  await prisma.pointTransaction.deleteMany({ where: { userId: { in: ALL_USERS } } });
  await prisma.userPoints.deleteMany({ where: { userId: { in: ALL_USERS } } });
}

/** Tao 1 de thi + 1 cau hoi MCQ_4 (10 diem, dap an dung = phan tu dau tien). */
async function setup(): Promise<void> {
  const paper = await examService.createExamPaper({
    subject: SUBJECT,
    title: `${TITLE_PREFIX} De rieng cho test rang buoc`,
    durationMinutes: 60,
  });
  paperId = paper.id;

  const question = await examService.createExamQuestion(paperId, {
    chapter: 'Chuong test',
    difficulty: 1,
    questionType: 'MCQ_4',
    points: 10,
    questionText: `${TITLE_PREFIX} Cau hoi MCQ`,
    options: ['Dung', 'Sai 1', 'Sai 2', 'Sai 3'],
    correctAnswer: 0,
  });
  questionId = question.id;

  // Moi user chi du diem cho DUNG 1 lan thi (EXAM_ENTRY_FEE = 60).
  for (const userId of ALL_USERS) {
    await prisma.userPoints.upsert({
      where: { userId },
      create: { userId, currentPoints: EXAM_ENTRY_FEE, version: 0 },
      update: { currentPoints: EXAM_ENTRY_FEE, version: 0 },
    });
  }
}

/** Tach ket qua Promise.allSettled thanh 2 nhom: thanh cong / loi theo `ErrorClass`. */
function splitSettled<T>(
  results: PromiseSettledResult<T>[],
  ErrorClass: new (...args: never[]) => Error,
): { fulfilled: T[]; matchedErrors: number; otherErrors: unknown[] } {
  const fulfilled: T[] = [];
  let matchedErrors = 0;
  const otherErrors: unknown[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      fulfilled.push(r.value);
    } else if (r.reason instanceof ErrorClass) {
      matchedErrors += 1;
    } else {
      otherErrors.push(r.reason);
    }
  }

  return { fulfilled, matchedErrors, otherErrors };
}

async function testStartExamRace(): Promise<void> {
  console.log(`\n--- A. ${CONCURRENT_REQUESTS} request startExam() dong thoi, user chi du diem cho 1 lan ---`);

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENT_REQUESTS }, () => examService.startExam(USER_A, SUBJECT)),
  );

  const { fulfilled, matchedErrors, otherErrors } = splitSettled(results, ExamInsufficientPointsError);
  otherErrors.forEach((e) => console.error('   Loi khong mong doi:', e));

  assert(fulfilled.length === 1, `chi DUNG 1 request startExam thanh cong (thuc te: ${fulfilled.length})`);
  assert(
    matchedErrors === CONCURRENT_REQUESTS - 1,
    `${CONCURRENT_REQUESTS - 1} request con lai deu nhan ExamInsufficientPointsError (thuc te: ${matchedErrors})`,
  );
  assert(otherErrors.length === 0, 'khong co loi nao khac ngoai du kien');

  const balance = await pointsService.getBalance(USER_A);
  assert(balance.currentPoints === 0, `so du USER_A sau khi tru phi = 0 (thuc te: ${balance.currentPoints})`);

  const sessionCount = await prisma.examSession.count({ where: { userId: USER_A } });
  assert(sessionCount === 1, `CHI tao 1 ExamSession cho USER_A (thuc te: ${sessionCount})`);

  const feeTxCount = await prisma.pointTransaction.count({
    where: { userId: USER_A, reason: 'THI_THU_ENTRY_FEE' },
  });
  assert(feeTxCount === 1, `CHI ghi 1 giao dich tru phi thi (thuc te: ${feeTxCount})`);
}

/** Tao 1 phien thi cho `userId` (startExam tuan tu, khong dong thoi). */
async function startSession(userId: string): Promise<string> {
  const session = await examService.startExam(userId, SUBJECT);
  return session.sessionId;
}

async function testSubmitExamRaceNoBonus(): Promise<void> {
  console.log(`\n--- B. ${CONCURRENT_REQUESTS} request submitExam() dong thoi, CUNG 1 phien, diem < 7 (pointsAwarded=0) ---`);

  const sessionId = await startSession(USER_B);
  // Chon dap an SAI (correctAnswer = 0, chon index 1) -> score = 0, pointsAwarded = 0.
  const answers = [{ examQuestionId: questionId, selectedAnswer: 1 }];

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENT_REQUESTS }, () => examService.submitExam(USER_B, sessionId, answers)),
  );

  const { fulfilled, matchedErrors, otherErrors } = splitSettled(results, ExamSessionAlreadyCompletedError);
  otherErrors.forEach((e) => console.error('   Loi khong mong doi:', e));

  assert(fulfilled.length === 1, `chi DUNG 1 request submitExam thanh cong (thuc te: ${fulfilled.length})`);
  assert(
    matchedErrors === CONCURRENT_REQUESTS - 1,
    `${CONCURRENT_REQUESTS - 1} request con lai deu nhan ExamSessionAlreadyCompletedError (thuc te: ${matchedErrors})`,
  );
  assert(otherErrors.length === 0, 'khong co loi nao khac ngoai du kien');
  assert(fulfilled[0]?.score === 0 && fulfilled[0]?.pointsAwarded === 0, 'ket qua thanh cong co score=0, pointsAwarded=0');

  const answerCount = await prisma.examAnswer.count({ where: { sessionId } });
  assert(answerCount === 1, `CHI co 1 ban ghi ExamAnswer cho phien (thuc te: ${answerCount})`);

  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  assert(session?.status === 'COMPLETED', `phien chuyen sang COMPLETED (thuc te: ${session?.status})`);

  const balance = await pointsService.getBalance(USER_B);
  assert(balance.currentPoints === 0, `so du USER_B khong doi vi pointsAwarded=0 (thuc te: ${balance.currentPoints})`);
}

async function testSubmitExamRaceWithBonus(): Promise<void> {
  console.log(`\n--- C. ${CONCURRENT_REQUESTS} request submitExam() dong thoi, CUNG 1 phien, diem = 10 (pointsAwarded=120) ---`);

  const sessionId = await startSession(USER_C);
  // Chon dap an DUNG (correctAnswer = 0) -> score = 10, pointsAwarded = 120.
  const answers = [{ examQuestionId: questionId, selectedAnswer: 0 }];

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENT_REQUESTS }, () => examService.submitExam(USER_C, sessionId, answers)),
  );

  const { fulfilled, matchedErrors, otherErrors } = splitSettled(results, ExamSessionAlreadyCompletedError);
  otherErrors.forEach((e) => console.error('   Loi khong mong doi:', e));

  assert(fulfilled.length === 1, `chi DUNG 1 request submitExam thanh cong (thuc te: ${fulfilled.length})`);
  assert(
    matchedErrors === CONCURRENT_REQUESTS - 1,
    `${CONCURRENT_REQUESTS - 1} request con lai deu nhan ExamSessionAlreadyCompletedError (thuc te: ${matchedErrors})`,
  );
  assert(otherErrors.length === 0, 'khong co loi nao khac ngoai du kien');
  assert(
    fulfilled[0]?.score === 10 && fulfilled[0]?.pointsAwarded === 120,
    'ket qua thanh cong co score=10, pointsAwarded=120',
  );

  const answerCount = await prisma.examAnswer.count({ where: { sessionId } });
  assert(answerCount === 1, `CHI co 1 ban ghi ExamAnswer cho phien (thuc te: ${answerCount})`);

  // So du: 60 - 60 (phi vao thi) + 120 (thuong) = 120. Phai CHI duoc cong 1 lan
  // (neu cong 2 lan se ra 240).
  const balance = await pointsService.getBalance(USER_C);
  assert(balance.currentPoints === 120, `so du USER_C duoc cong dung 1 lan 120 diem thuong (thuc te: ${balance.currentPoints})`);

  const bonusTxCount = await prisma.pointTransaction.count({
    where: { userId: USER_C, reason: 'THI_THU_RESULT' },
  });
  assert(bonusTxCount === 1, `CHI ghi 1 giao dich cong diem thuong (thuc te: ${bonusTxCount})`);
}

async function main(): Promise<void> {
  await cleanup();
  await setup();

  try {
    await testStartExamRace();
    await testSubmitExamRaceNoBonus();
    await testSubmitExamRaceWithBonus();
  } finally {
    await cleanup();
  }

  console.log('\n🎉 TAT CA KIEM TRA RACE CONDITION DEU PASS!');
}

main()
  .catch((err) => {
    console.error('\n💥 SMOKE TEST CONCURRENCY (EXAM) THAT BAI:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
