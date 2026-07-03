// Script kiem thu nhanh (smoke test) cho module "Thi thu" (Exam) - exam.service.ts.
// - chay truc tiep voi DB that. KHONG phai unit test chinh thuc, chi dung de
//   xac nhan cac luong chinh (cham diem 3 dang cau hoi, chon de cong bang,
//   het gio lam bai, diem thuong) hoat dong dung truoc khi merge.
//
// Chay: npx tsx src/scripts/smoke-test-exam.ts

import { prisma } from '../lib/prisma.js';
import { examService, normalizeAnswer, validateQuestionShape } from '../services/exam/exam.service.js';
import {
  ExamExpiredError,
  ExamInsufficientPointsError,
  ExamInvalidSubjectError,
  ExamPaperEmptyError,
  ExamQuestionInvalidError,
  ExamSessionAlreadyCompletedError,
  ExamSessionNotCompletedError,
  ExamSessionNotFoundError,
  ExamSessionNotOwnedError,
} from '../services/exam/exam.errors.js';
import {
  EXAM_ENTRY_FEE,
  EXAM_GRACE_SECONDS,
  TRUE_FALSE_SCORE_RATIOS,
  getExamBonusPoints,
} from '../services/exam/exam.types.js';
import type { ExamChapterAnalysis, ExamResultResponse } from '../services/exam/exam.types.js';
import { pointsService } from '../services/points/points.service.js';
import { PointReason } from '../services/points/points.types.js';

const TEST_USER = 'smoke-test-exam-user';
const TEST_USER_NO_POINTS = 'smoke-test-exam-user-nopoints';
const TEST_USER_OTHER = 'smoke-test-exam-user-other';
const TITLE_PREFIX = '[SMOKE TEST]';

// pickFairExamPaper() chon NGAU NHIEN giua TAT CA de active cua mon hoc.
// Neu DB dang co san de active khac (vi du de demo do admin tao) cho TOAN/VAN,
// can tam tat (isActive=false) de cac assertion ve "chon dung De A" / "chon
// 1 trong 2 de Fairness" deu xac dinh (deterministic), roi bat lai sau khi xong.
const SUBJECTS_UNDER_TEST = ['TOAN', 'VAN'];

let paperAId = '';
let q1Id = ''; // MCQ_4, chuong "Dai so", 4 diem
let q2Id = ''; // TRUE_FALSE_4, chuong "Hinh hoc", 4 diem
let q3Id = ''; // FILL_BLANK, chuong "Dai so", 2 diem
let paperB1Id = '';
let paperB2Id = '';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ THAT BAI: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function findChapter(result: ExamResultResponse, chapter: string): ExamChapterAnalysis {
  const found = result.chapterAnalysis.find((c) => c.chapter === chapter);
  if (!found) throw new Error(`Khong tim thay chapterAnalysis cho chuong '${chapter}'`);
  return found;
}

async function cleanup(): Promise<void> {
  const papers = await prisma.examPaper.findMany({
    where: { title: { startsWith: TITLE_PREFIX } },
    select: { id: true },
  });
  const paperIds = papers.map((p) => p.id);
  const testUserIds = [TEST_USER, TEST_USER_NO_POINTS, TEST_USER_OTHER];

  const sessions = await prisma.examSession.findMany({
    where: { OR: [{ examPaperId: { in: paperIds } }, { userId: { in: testUserIds } }] },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  await prisma.examAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.examSession.deleteMany({ where: { id: { in: sessionIds } } });
  await prisma.examQuestion.deleteMany({ where: { examPaperId: { in: paperIds } } });
  await prisma.examPaper.deleteMany({ where: { id: { in: paperIds } } });
  await prisma.pointTransaction.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.userPoints.deleteMany({ where: { userId: { in: testUserIds } } });
}

async function deactivateOtherActivePapers(): Promise<string[]> {
  const others = await prisma.examPaper.findMany({
    where: {
      subject: { in: SUBJECTS_UNDER_TEST },
      isActive: true,
      title: { not: { startsWith: TITLE_PREFIX } },
    },
    select: { id: true },
  });
  const ids = others.map((p) => p.id);
  if (ids.length > 0) {
    await prisma.examPaper.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
  }
  return ids;
}

async function reactivatePapers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.examPaper.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
}

async function setup(): Promise<void> {
  // Diem khoi diem cho TEST_USER: 1000 (du cho nhieu lan startExam, moi lan -60).
  await prisma.userPoints.upsert({
    where: { userId: TEST_USER },
    create: { userId: TEST_USER, currentPoints: 1000, version: 0 },
    update: { currentPoints: 1000, version: 0 },
  });

  // --- De A (mon TOAN) - dung de test cham diem 3 dang cau hoi ---
  const paperA = await examService.createExamPaper({
    subject: 'TOAN',
    title: `${TITLE_PREFIX} De Grading`,
    durationMinutes: 60,
  });
  paperAId = paperA.id;

  const q1 = await examService.createExamQuestion(paperAId, {
    chapter: 'Dai so',
    difficulty: 1,
    questionType: 'MCQ_4',
    points: 4,
    questionText: `${TITLE_PREFIX} 1 + 1 = ?`,
    options: ['1', '2', '3', '4'],
    correctAnswer: 1,
  });
  q1Id = q1.id;

  const q2 = await examService.createExamQuestion(paperAId, {
    chapter: 'Hinh hoc',
    difficulty: 2,
    questionType: 'TRUE_FALSE_4',
    points: 4,
    questionText: `${TITLE_PREFIX} Cac phat bieu sau dung hay sai?`,
    options: ['a) Dung', 'b) Sai', 'c) Dung', 'd) Sai'],
    correctAnswer: [true, false, true, false],
  });
  q2Id = q2.id;

  const q3 = await examService.createExamQuestion(paperAId, {
    chapter: 'Dai so',
    difficulty: 1,
    questionType: 'FILL_BLANK',
    points: 2,
    questionText: `${TITLE_PREFIX} Thu do cua Viet Nam la?`,
    correctAnswer: ['Hà Nội'],
  });
  q3Id = q3.id;

  // --- De B1, B2 (mon VAN) - dung de test chon de cong bang ---
  const paperB1 = await examService.createExamPaper({
    subject: 'VAN',
    title: `${TITLE_PREFIX} De Fairness B1`,
    durationMinutes: 30,
  });
  paperB1Id = paperB1.id;
  await examService.createExamQuestion(paperB1Id, {
    chapter: 'Van hoc',
    difficulty: 1,
    questionType: 'MCQ_4',
    points: 10,
    questionText: `${TITLE_PREFIX} Cau hoi de B1`,
    options: ['1', '2', '3', '4'],
    correctAnswer: 0,
  });

  const paperB2 = await examService.createExamPaper({
    subject: 'VAN',
    title: `${TITLE_PREFIX} De Fairness B2`,
    durationMinutes: 30,
  });
  paperB2Id = paperB2.id;
  await examService.createExamQuestion(paperB2Id, {
    chapter: 'Van hoc',
    difficulty: 1,
    questionType: 'MCQ_4',
    points: 10,
    questionText: `${TITLE_PREFIX} Cau hoi de B2`,
    options: ['1', '2', '3', '4'],
    correctAnswer: 0,
  });
}

async function main(): Promise<void> {
  console.log('--- Don dep du lieu test cu (neu co) va tao du lieu moi ---');
  await cleanup();
  const deactivatedPaperIds = await deactivateOtherActivePapers();
  try {
    await runTests();
  } finally {
    await reactivatePapers(deactivatedPaperIds);
  }
}

async function runTests(): Promise<void> {
  await setup();

  console.log('\n--- 1. Ham thuan: getExamBonusPoints / TRUE_FALSE_SCORE_RATIOS / normalizeAnswer ---');
  assert(getExamBonusPoints(6.9) === 0, 'getExamBonusPoints(6.9) = 0 (duoi 7.0)');
  assert(getExamBonusPoints(7) === 10, 'getExamBonusPoints(7) = 10');
  assert(getExamBonusPoints(7.9) === 10, 'getExamBonusPoints(7.9) = 10');
  assert(getExamBonusPoints(8) === 20, 'getExamBonusPoints(8) = 20');
  assert(getExamBonusPoints(8.9) === 20, 'getExamBonusPoints(8.9) = 20');
  assert(getExamBonusPoints(9) === 50, 'getExamBonusPoints(9) = 50');
  assert(getExamBonusPoints(9.9) === 50, 'getExamBonusPoints(9.9) = 50');
  assert(getExamBonusPoints(10) === 120, 'getExamBonusPoints(10) = 120');
  assert(deepEqual(TRUE_FALSE_SCORE_RATIOS, [0, 0.1, 0.25, 0.5, 1]), 'TRUE_FALSE_SCORE_RATIOS = [0, 0.1, 0.25, 0.5, 1]');
  assert(normalizeAnswer('  HÀ   NỘI  ') === 'hà nội', "normalizeAnswer('  HÀ   NỘI  ') = 'hà nội'");
  assert(normalizeAnswer('Hà Nội') === 'hà nội', "normalizeAnswer('Hà Nội') = 'hà nội'");

  console.log('\n--- 2. validateQuestionShape: phat hien du lieu khong hop le ---');
  try {
    validateQuestionShape('MCQ_4', ['1', '2', '3'], 0);
    assert(false, 'MCQ_4 voi 3 options phai nem ExamQuestionInvalidError');
  } catch (err) {
    assert(err instanceof ExamQuestionInvalidError, 'MCQ_4 voi 3 options nem ExamQuestionInvalidError');
  }
  try {
    validateQuestionShape('MCQ_4', ['1', '2', '3', '4'], 5);
    assert(false, 'MCQ_4 voi correctAnswer=5 phai nem ExamQuestionInvalidError');
  } catch (err) {
    assert(err instanceof ExamQuestionInvalidError, 'MCQ_4 voi correctAnswer=5 nem ExamQuestionInvalidError');
  }
  try {
    validateQuestionShape('TRUE_FALSE_4', ['a', 'b', 'c', 'd'], [true, false, true]);
    assert(false, 'TRUE_FALSE_4 voi correctAnswer 3 phan tu phai nem ExamQuestionInvalidError');
  } catch (err) {
    assert(err instanceof ExamQuestionInvalidError, 'TRUE_FALSE_4 voi correctAnswer 3 phan tu nem ExamQuestionInvalidError');
  }
  try {
    validateQuestionShape('FILL_BLANK', null, []);
    assert(false, 'FILL_BLANK voi correctAnswer=[] phai nem ExamQuestionInvalidError');
  } catch (err) {
    assert(err instanceof ExamQuestionInvalidError, 'FILL_BLANK voi correctAnswer=[] nem ExamQuestionInvalidError');
  }

  console.log('\n--- 3. startExam: kiem tra loi dau vao (subject khong hop le / mon chua co de / khong du diem) ---');
  try {
    await examService.startExam(TEST_USER, 'KHONG_TON_TAI');
    assert(false, 'subject khong hop le phai nem ExamInvalidSubjectError');
  } catch (err) {
    assert(err instanceof ExamInvalidSubjectError, 'subject khong hop le nem ExamInvalidSubjectError');
    assert((err as { code?: string }).code === 'EXAM_INVALID_SUBJECT', 'loi co code EXAM_INVALID_SUBJECT');
  }

  const gdcdPaperCount = await prisma.examPaper.count({ where: { subject: 'GDCD', isActive: true } });
  if (gdcdPaperCount === 0) {
    try {
      await examService.startExam(TEST_USER, 'GDCD');
      assert(false, 'mon GDCD chua co de thi phai nem ExamPaperEmptyError');
    } catch (err) {
      assert(err instanceof ExamPaperEmptyError, 'mon GDCD chua co de thi nem ExamPaperEmptyError');
      assert((err as { code?: string }).code === 'EXAM_PAPER_EMPTY', 'loi co code EXAM_PAPER_EMPTY');
    }
  } else {
    console.log(`(bo qua: mon GDCD da co ${gdcdPaperCount} de thi active trong DB)`);
  }

  try {
    await examService.startExam(TEST_USER_NO_POINTS, 'TOAN');
    assert(false, 'user khong du diem phai nem ExamInsufficientPointsError');
  } catch (err) {
    assert(err instanceof ExamInsufficientPointsError, 'user khong du diem nem ExamInsufficientPointsError');
    assert((err as { code?: string }).code === 'EXAM_INSUFFICIENT_POINTS', 'loi co code EXAM_INSUFFICIENT_POINTS');
  }
  const noPointsBalance = await pointsService.getBalance(TEST_USER_NO_POINTS);
  assert(noPointsBalance.currentPoints === 0, 'user khong du diem khong bi tru diem (van = 0) sau khi startExam loi');
  const noPointsSessions = await prisma.examSession.count({ where: { userId: TEST_USER_NO_POINTS } });
  assert(noPointsSessions === 0, 'khong tao ExamSession nao cho user khong du diem (transaction rollback)');

  console.log('\n--- 4. Phien 1: lam DUNG HOAN TOAN -> score=10, pointsAwarded=120 ---');
  const balanceBeforeSession1 = await pointsService.getBalance(TEST_USER);
  const session1 = await examService.startExam(TEST_USER, 'TOAN');
  assert(session1.examPaperId === paperAId, 'Phien 1 chon dung De A (mon TOAN chi co 1 de active)');
  assert(session1.questions.length === 3, 'Phien 1 co 3 cau hoi');
  for (const q of session1.questions) {
    assert(
      (q as unknown as Record<string, unknown>).correctAnswer === undefined,
      `Cau hoi cong khai khong duoc lo dap an dung (cau ${q.id})`,
    );
  }

  const balanceAfterStart1 = await pointsService.getBalance(TEST_USER);
  assert(
    balanceAfterStart1.currentPoints === balanceBeforeSession1.currentPoints - EXAM_ENTRY_FEE,
    `startExam tru ${EXAM_ENTRY_FEE} diem (truoc: ${balanceBeforeSession1.currentPoints}, sau: ${balanceAfterStart1.currentPoints})`,
  );
  const historyAfterStart1 = await pointsService.getHistory(TEST_USER, 1);
  assert(historyAfterStart1.items[0]?.reason === PointReason.THI_THU_ENTRY_FEE, 'Giao dich tru diem vao thi ghi reason=THI_THU_ENTRY_FEE');
  assert(historyAfterStart1.items[0]?.delta === -EXAM_ENTRY_FEE, `Giao dich tru diem co delta=-${EXAM_ENTRY_FEE}`);

  const submit1 = await examService.submitExam(TEST_USER, session1.sessionId, [
    { examQuestionId: q1Id, selectedAnswer: 1 },
    { examQuestionId: q2Id, selectedAnswer: [true, false, true, false] },
    { examQuestionId: q3Id, selectedAnswer: '  HÀ   NỘI  ' },
  ]);
  assert(submit1.score === 10, `Phien 1 dat diem 10 (thuc te: ${submit1.score})`);
  assert(submit1.pointsAwarded === 120, `Phien 1 duoc thuong 120 diem (thuc te: ${submit1.pointsAwarded})`);

  const balanceAfterSubmit1 = await pointsService.getBalance(TEST_USER);
  assert(
    balanceAfterSubmit1.currentPoints === balanceAfterStart1.currentPoints + 120,
    `submitExam cong 120 diem thuong (truoc: ${balanceAfterStart1.currentPoints}, sau: ${balanceAfterSubmit1.currentPoints})`,
  );
  const historyAfterSubmit1 = await pointsService.getHistory(TEST_USER, 1);
  assert(historyAfterSubmit1.items[0]?.reason === PointReason.THI_THU_RESULT, 'Giao dich cong diem thuong ghi reason=THI_THU_RESULT');
  assert(historyAfterSubmit1.items[0]?.delta === 120, 'Giao dich cong diem thuong co delta=120');

  const result1 = await examService.getExamResult(TEST_USER, session1.sessionId);
  assert(result1.status === 'COMPLETED', 'Phien 1: status = COMPLETED');
  assert(result1.score === 10, 'Phien 1: ket qua score = 10');
  assert(result1.pointsAwarded === 120, 'Phien 1: ket qua pointsAwarded = 120');
  assert(result1.wrongAnswers.length === 0, 'Phien 1: khong co cau sai (lam dung het)');
  const chapDaiSo1 = findChapter(result1, 'Dai so');
  assert(chapDaiSo1.totalCount === 2 && chapDaiSo1.correctCount === 2, 'Phien 1: chuong Dai so 2/2 cau dung');
  assert(chapDaiSo1.pointsEarned === 6 && chapDaiSo1.pointsTotal === 6, 'Phien 1: chuong Dai so dat 6/6 diem');
  const chapHinhHoc1 = findChapter(result1, 'Hinh hoc');
  assert(chapHinhHoc1.totalCount === 1 && chapHinhHoc1.correctCount === 1, 'Phien 1: chuong Hinh hoc 1/1 cau dung');
  assert(chapHinhHoc1.pointsEarned === 4 && chapHinhHoc1.pointsTotal === 4, 'Phien 1: chuong Hinh hoc dat 4/4 diem');

  console.log('\n--- 5. Phien 2: lam DUNG MOT PHAN -> score=7.0, pointsAwarded=10 ---');
  const session2 = await examService.startExam(TEST_USER, 'TOAN');
  const balanceAfterStart2 = await pointsService.getBalance(TEST_USER);
  const submit2 = await examService.submitExam(TEST_USER, session2.sessionId, [
    { examQuestionId: q1Id, selectedAnswer: 1 }, // dung -> 4 diem
    { examQuestionId: q2Id, selectedAnswer: [true, true, true, true] }, // 2/4 dung -> 4*0.25=1 diem
    { examQuestionId: q3Id, selectedAnswer: 'Hà Nội' }, // dung -> 2 diem
  ]);
  assert(submit2.score === 7, `Phien 2 dat diem 7.0 (thuc te: ${submit2.score})`);
  assert(submit2.pointsAwarded === 10, `Phien 2 duoc thuong 10 diem (thuc te: ${submit2.pointsAwarded})`);
  const balanceAfterSubmit2 = await pointsService.getBalance(TEST_USER);
  assert(
    balanceAfterSubmit2.currentPoints === balanceAfterStart2.currentPoints + 10,
    `submitExam cong 10 diem thuong (truoc: ${balanceAfterStart2.currentPoints}, sau: ${balanceAfterSubmit2.currentPoints})`,
  );

  const result2 = await examService.getExamResult(TEST_USER, session2.sessionId);
  assert(result2.wrongAnswers.length === 1, 'Phien 2: chi co 1 cau sai (TRUE_FALSE_4 dat 2/4 y)');
  const chapHinhHoc2 = findChapter(result2, 'Hinh hoc');
  assert(chapHinhHoc2.pointsEarned === 1 && chapHinhHoc2.correctCount === 0, 'Phien 2: chuong Hinh hoc dat 1/4 diem, 0 cau dung tron');
  const wrongQ2 = result2.wrongAnswers.find((w) => w.examQuestionId === q2Id);
  assert(!!wrongQ2 && wrongQ2.pointsEarned === 1, 'Phien 2: cau TRUE_FALSE_4 nam trong wrongAnswers voi pointsEarned=1');

  console.log('\n--- 6. Phien 3: KHONG TRA LOI gi (answers=[]) -> score=0, pointsAwarded=0, KHONG doi diem ---');
  const session3 = await examService.startExam(TEST_USER, 'TOAN');
  const balanceAfterStart3 = await pointsService.getBalance(TEST_USER);
  const submit3 = await examService.submitExam(TEST_USER, session3.sessionId, []);
  assert(submit3.score === 0, `Phien 3 dat diem 0 (thuc te: ${submit3.score})`);
  assert(submit3.pointsAwarded === 0, `Phien 3 khong duoc thuong diem (thuc te: ${submit3.pointsAwarded})`);

  const balanceAfterSubmit3 = await pointsService.getBalance(TEST_USER);
  assert(
    balanceAfterSubmit3.currentPoints === balanceAfterStart3.currentPoints,
    `submitExam voi score<7 KHONG thay doi diem (truoc: ${balanceAfterStart3.currentPoints}, sau: ${balanceAfterSubmit3.currentPoints})`,
  );
  const historyAfterSubmit3 = await pointsService.getHistory(TEST_USER, 1);
  assert(
    historyAfterSubmit3.items[0]?.reason === PointReason.THI_THU_ENTRY_FEE,
    'Khong co giao dich THI_THU_RESULT moi duoc ghi (giao dich gan nhat van la THI_THU_ENTRY_FEE cua Phien 3)',
  );

  const result3 = await examService.getExamResult(TEST_USER, session3.sessionId);
  assert(result3.wrongAnswers.length === 3, 'Phien 3: ca 3 cau deu nam trong wrongAnswers');
  for (const w of result3.wrongAnswers) {
    assert(deepEqual(w.selectedAnswer, {}), `Phien 3: cau ${w.examQuestionId} co selectedAnswer = {} (sentinel chua tra loi)`);
    assert(w.pointsEarned === 0, `Phien 3: cau ${w.examQuestionId} dat 0 diem`);
  }

  console.log('\n--- 7. Trang thai phien: cac loi truy cap khong hop le ---');
  try {
    await examService.submitExam(TEST_USER, session1.sessionId, []);
    assert(false, 'nop lai phien da hoan thanh phai nem ExamSessionAlreadyCompletedError');
  } catch (err) {
    assert(err instanceof ExamSessionAlreadyCompletedError, 'nop lai phien da hoan thanh nem ExamSessionAlreadyCompletedError');
    assert((err as { code?: string }).code === 'EXAM_SESSION_ALREADY_COMPLETED', 'loi co code EXAM_SESSION_ALREADY_COMPLETED');
  }

  try {
    await examService.getExamResult(TEST_USER, 'phien-khong-ton-tai');
    assert(false, 'phien khong ton tai phai nem ExamSessionNotFoundError');
  } catch (err) {
    assert(err instanceof ExamSessionNotFoundError, 'phien khong ton tai nem ExamSessionNotFoundError');
    assert((err as { code?: string }).code === 'EXAM_SESSION_NOT_FOUND', 'loi co code EXAM_SESSION_NOT_FOUND');
  }

  try {
    await examService.getExamResult(TEST_USER_OTHER, session1.sessionId);
    assert(false, 'user khac truy cap phien phai nem ExamSessionNotOwnedError');
  } catch (err) {
    assert(err instanceof ExamSessionNotOwnedError, 'user khac truy cap phien nem ExamSessionNotOwnedError');
    assert((err as { code?: string }).code === 'EXAM_SESSION_NOT_OWNED', 'loi co code EXAM_SESSION_NOT_OWNED');
  }

  console.log('\n--- 8. Phien 4: het gio lam bai (qua deadline + grace) -> ExamExpiredError, khong cham diem ---');
  const session4 = await examService.startExam(TEST_USER, 'TOAN');
  const balanceAfterStart4 = await pointsService.getBalance(TEST_USER);

  try {
    await examService.getExamResult(TEST_USER, session4.sessionId);
    assert(false, 'phien dang IN_PROGRESS phai nem ExamSessionNotCompletedError khi xem ket qua');
  } catch (err) {
    assert(err instanceof ExamSessionNotCompletedError, 'phien IN_PROGRESS nem ExamSessionNotCompletedError khi xem ket qua');
    assert((err as { code?: string }).code === 'EXAM_SESSION_NOT_COMPLETED', 'loi co code EXAM_SESSION_NOT_COMPLETED');
  }

  // De qua deadline: lui startedAt ve qua khu (durationMinutes*60 + grace + 60 giay).
  const overdueMs = (session4.durationMinutes * 60 + EXAM_GRACE_SECONDS + 60) * 1000;
  await prisma.examSession.update({
    where: { id: session4.sessionId },
    data: { startedAt: new Date(Date.now() - overdueMs) },
  });

  try {
    await examService.submitExam(TEST_USER, session4.sessionId, [
      { examQuestionId: q1Id, selectedAnswer: 1 },
      { examQuestionId: q2Id, selectedAnswer: [true, false, true, false] },
      { examQuestionId: q3Id, selectedAnswer: 'Hà Nội' },
    ]);
    assert(false, 'nop bai qua gio phai nem ExamExpiredError');
  } catch (err) {
    assert(err instanceof ExamExpiredError, 'nop bai qua gio nem ExamExpiredError');
    assert((err as { code?: string }).code === 'EXAM_EXPIRED', 'loi co code EXAM_EXPIRED');
  }

  const session4Row = await prisma.examSession.findUnique({ where: { id: session4.sessionId } });
  assert(session4Row?.status === 'EXPIRED', 'Phien 4 chuyen sang status=EXPIRED');
  assert(session4Row?.score === null, 'Phien 4 khong co score (chua cham diem)');
  assert(session4Row?.pointsAwarded === 0, 'Phien 4 pointsAwarded = 0');

  const session4Answers = await prisma.examAnswer.count({ where: { sessionId: session4.sessionId } });
  assert(session4Answers === 0, 'Phien 4 khong tao ExamAnswer nao (khong cham diem)');

  const balanceAfterExpiredSubmit = await pointsService.getBalance(TEST_USER);
  assert(
    balanceAfterExpiredSubmit.currentPoints === balanceAfterStart4.currentPoints,
    `Phien 4 het gio: khong hoan/doi diem da tru (truoc: ${balanceAfterStart4.currentPoints}, sau: ${balanceAfterExpiredSubmit.currentPoints})`,
  );

  // Nop lai lan 2 tren phien da EXPIRED -> van nem ExamExpiredError (qua nhanh kiem tra status dau ham).
  try {
    await examService.submitExam(TEST_USER, session4.sessionId, []);
    assert(false, 'nop lai phien da EXPIRED phai nem ExamExpiredError');
  } catch (err) {
    assert(err instanceof ExamExpiredError, 'nop lai phien da EXPIRED van nem ExamExpiredError');
  }

  const result4 = await examService.getExamResult(TEST_USER, session4.sessionId);
  assert(result4.status === 'EXPIRED', 'Phien 4 (ket qua): status = EXPIRED');
  assert(result4.score === 0, 'Phien 4 (ket qua): score = 0');
  assert(result4.wrongAnswers.length === 3, 'Phien 4 (ket qua): ca 3 cau deu nam trong wrongAnswers');
  for (const w of result4.wrongAnswers) {
    assert(w.selectedAnswer === null, `Phien 4: cau ${w.examQuestionId} co selectedAnswer = null (khong co ExamAnswer)`);
  }
  const chapDaiSo4 = findChapter(result4, 'Dai so');
  assert(chapDaiSo4.pointsEarned === 0, 'Phien 4: chuong Dai so dat 0 diem');

  console.log('\n--- 9. Chon de cong bang (pickFairExamPaper) qua nhieu lan startExam (mon VAN, 2 de) ---');
  const sessionVan1 = await examService.startExam(TEST_USER, 'VAN');
  const sessionVan2 = await examService.startExam(TEST_USER, 'VAN');
  assert(
    [paperB1Id, paperB2Id].includes(sessionVan1.examPaperId),
    'Lan 1: chon 1 trong 2 de Fairness (B1/B2)',
  );
  assert(
    sessionVan2.examPaperId !== sessionVan1.examPaperId,
    `Lan 2: PHAI chon de KHAC voi lan 1 (de chua co lan thi nao) - lan1=${sessionVan1.examPaperId}, lan2=${sessionVan2.examPaperId}`,
  );
  assert(
    [paperB1Id, paperB2Id].includes(sessionVan2.examPaperId),
    'Lan 2: chon 1 trong 2 de Fairness (B1/B2)',
  );

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
